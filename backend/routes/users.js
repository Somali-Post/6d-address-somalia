const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
// IMPORT BOTH MIDDLEWARE FUNCTIONS
const { verifyFirebaseToken, verifySessionToken } = require('../middleware/auth');

const router = express.Router();

// The /register endpoint is special. It uses the Firebase token.
router.post('/register', verifyFirebaseToken, async (req, res) => {
  const { uid, phone_number } = req.user; // From the verified token
  const {
    fullName,
    sixDCode,
    localitySuffix,
    region,
    city,
    district,
    neighborhood,
    lat,
    lng
  } = req.body;

  if (!fullName || !sixDCode || !region || !city || !district || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required registration fields.' });
  }

  try {
    // Use a database transaction to ensure atomicity
    await db.query('BEGIN');

    // 1. Check if user already exists, if not, create them
    let userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
    let user = userResult.rows[0];

    if (!user) {
      const newUserResult = await db.query(
        'INSERT INTO users(id, phone_number, full_name) VALUES($1, $2, $3) RETURNING *',
        [uid, phone_number, fullName]
      );
      user = newUserResult.rows[0];
    } else {
        // Optional: Update user's full name if it has changed
        if (user.full_name !== fullName) {
            await db.query('UPDATE users SET full_name = $1 WHERE id = $2', [fullName, uid]);
        }
    }

    // 2. Insert or update the address
const addressResult = await db.query(
  `INSERT INTO addresses(user_id, six_d_code, locality_suffix, region, city, district, neighborhood, location)
   VALUES($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))
   ON CONFLICT (user_id) DO UPDATE SET
     six_d_code = EXCLUDED.six_d_code,
     locality_suffix = EXCLUDED.locality_suffix,
     region = EXCLUDED.region,
     city = EXCLUDED.city,
     district = EXCLUDED.district,
     neighborhood = EXCLUDED.neighborhood,
     location = EXCLUDED.location,
     registered_at = NOW()
   RETURNING *`,
  [uid, sixDCode, localitySuffix, region, city, district, neighborhood, lng, lat] // IMPORTANT: Note the order is lng, then lat for PostGIS
);
    
    await db.query('COMMIT');

    // 3. Generate our internal session token
    const sessionToken = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 4. Send back a standardized response with the token and the full user profile.
    const combinedUser = {
      ...user,
      ...addressResult.rows[0]
    };
    // We need to map the PostGIS 'location' object to lat/lng for consistency
    combinedUser.lat = addressResult.rows[0].location.y;
    combinedUser.lng = addressResult.rows[0].location.x;
    delete combinedUser.location;

    res.status(201).json({
      token: sessionToken,
      user: combinedUser
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});


// --- ALL OTHER USER ROUTES ---
// All subsequent routes for a logged-in user must be protected by our internal session token.

// GET /api/users/me
router.get('/me', verifySessionToken, async (req, res) => {
  // The user's UID is available from our verifySessionToken middleware
  const { uid } = req.user;

  try {
    // We need to fetch data from two tables: 'users' and 'addresses'.
    // A JOIN query is the most efficient way to do this in a single database call.
    const query = `
      SELECT
        u.id,
        u.phone_number,
        u.full_name,
        u.created_at,
        a.six_d_code,
        a.locality_suffix,
        a.region,
        a.city,
        a.district,
        a.neighborhood,
        a.registered_at,
        ST_X(a.location) as lng, -- Extract longitude from the PostGIS point
        ST_Y(a.location) as lat  -- Extract latitude from the PostGIS point
      FROM
        users u
      JOIN
        addresses a ON u.id = a.user_id
      WHERE
        u.id = $1;
    `;

    const result = await db.query(query, [uid]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const userData = result.rows[0];

    // Respond with the combined user and address data
    res.status(200).json(userData);

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'An error occurred while fetching user data.' });
  }
});

// PUT /api/users/me/address
router.put('/me/address', verifySessionToken, async (req, res) => {
  // The user's UID is available from our verifySessionToken middleware
  const { uid } = req.user;
  const {
    sixDCode,
    localitySuffix,
    region,
    city,
    district,
    neighborhood,
    lat,
    lng
  } = req.body;

  // Basic validation
  if (!sixDCode || !region || !city || !district || !lat || !lng) {
    return res.status(400).json({ error: 'Missing required address fields.' });
  }

  try {
    // Use a database transaction for atomicity
    await db.query('BEGIN');

    // 1. Get the user's current address to check the registration date
    const currentAddressResult = await db.query('SELECT * FROM addresses WHERE user_id = $1 FOR UPDATE', [uid]);

    if (currentAddressResult.rows.length === 0) {
      // This case should not happen if a user is updating, but we handle it.
      // We can treat this as an error or proceed as a first-time registration.
      // For now, we'll send an error.
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'No existing address found to update.' });
    }
    
    const currentAddress = currentAddressResult.rows[0];
    const lastRegisteredDate = new Date(currentAddress.registered_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Enforce the 30-day business rule
    if (lastRegisteredDate > thirtyDaysAgo) {
      await db.query('ROLLBACK'); // Abort the transaction
      const nextUpdateDate = new Date(lastRegisteredDate.setDate(lastRegisteredDate.getDate() + 30));
      return res.status(403).json({ 
        error: 'Address can only be updated once every 30 days.',
        nextUpdateAvailable: nextUpdateDate.toISOString()
      });
    }

    // 3. If the check passes, archive the old address
    const archiveQuery = `
      INSERT INTO address_history(user_id, six_d_code, locality_suffix, region, city, district, neighborhood, location, registered_at)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    await db.query(archiveQuery, [
      uid,
      currentAddress.six_d_code,
      currentAddress.locality_suffix,
      currentAddress.region,
      currentAddress.city,
      currentAddress.district,
      currentAddress.neighborhood,
      currentAddress.location,
      currentAddress.registered_at
    ]);

    // 4. Update the existing address record with the new information
    const updateQuery = `
      UPDATE addresses 
      SET 
        six_d_code = $1,
        locality_suffix = $2,
        region = $3,
        city = $4,
        district = $5,
        neighborhood = $6,
        location = ST_SetSRID(ST_MakePoint($7, $8), 4326),
        registered_at = NOW()
      WHERE user_id = $9
      RETURNING *;
    `;
    const updatedAddressResult = await db.query(updateQuery, [sixDCode, localitySuffix, region, city, district, neighborhood, lng, lat, uid]);

    await db.query('COMMIT');
    
    res.status(200).json({ success: true, newAddress: updatedAddressResult.rows[0] });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'An error occurred while updating the address.' });
  }
});

// PUT /api/users/me
router.put('/me', verifySessionToken, async (req, res) => {
  const { uid } = req.user; // From our verifySessionToken middleware
  const { fullName } = req.body;

  if (!fullName || fullName.trim().length < 3) {
    return res.status(400).json({ error: 'A valid full name is required.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, updated_at',
      [fullName.trim(), uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ success: true, updatedUser: result.rows[0] });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'An error occurred while updating your profile.' });
  }
});

// GET /api/users/me/history
router.get('/me/history', verifySessionToken, async (req, res) => {
  const { uid } = req.user; // From our verifySessionToken middleware

  try {
    const query = `
      SELECT 
        six_d_code,
        region,
        city,
        district,
        neighborhood,
        registered_at,
        archived_at
      FROM 
        address_history
      WHERE 
        user_id = $1
      ORDER BY 
        archived_at DESC; -- Show the most recently archived address first
    `;

    const result = await db.query(query, [uid]);

    res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching address history:', error);
    res.status(500).json({ error: 'An error occurred while fetching address history.' });
  }
});

module.exports = router;
