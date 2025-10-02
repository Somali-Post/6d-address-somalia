const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify Firebase ID token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Add user info to the request object
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ 
      error: 'Authentication failed. Invalid token.',
      firebaseError: error.message
    });
  }
};

// POST /api/users/register
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

    // 4. Send back the session token and success message
    res.status(201).json({ 
        message: 'User registered successfully.',
        token: sessionToken,
        user: user,
        address: addressResult.rows[0]
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'An error occurred during registration.' });
  }
});


// GET /api/users/me
// Fetches the profile and current address for the authenticated user.
router.get('/me', verifyFirebaseToken, async (req, res) => {
  // The user's UID is available from our verifyFirebaseToken middleware
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
// Updates the authenticated user's current address.
// Enforces the 30-day update limit.
router.put('/me/address', verifyFirebaseToken, async (req, res) => {
  const { uid } = req.user; // From our verifyFirebaseToken middleware
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
    const currentAddressResult = await db.query('SELECT * FROM addresses WHERE user_id = $1', [uid]);

    if (currentAddressResult.rows.length === 0) {
      // This case should ideally not happen for an existing user, but we handle it.
      // We can proceed with the insert as if it's their first address.
    } else {
      const currentAddress = currentAddressResult.rows[0];
      const lastRegisteredDate = new Date(currentAddress.registered_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (lastRegisteredDate > thirtyDaysAgo) {
        await db.query('ROLLBACK'); // Abort the transaction
        return res.status(403).json({ 
          error: 'Address can only be updated once every 30 days.',
          nextUpdateAvailable: new Date(lastRegisteredDate.setDate(lastRegisteredDate.getDate() + 30))
        });
      }

      // 2. If the check passes, archive the old address
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
    }

    // 3. "Upsert" the new address. This will update the existing record.
    const updateQuery = `
      INSERT INTO addresses(user_id, six_d_code, locality_suffix, region, city, district, neighborhood, location, registered_at)
      VALUES($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        six_d_code = EXCLUDED.six_d_code,
        locality_suffix = EXCLUDED.locality_suffix,
        region = EXCLUDED.region,
        city = EXCLUDED.city,
        district = EXCLUDED.district,
        neighborhood = EXCLUDED.neighborhood,
        location = EXCLUDED.location,
        registered_at = NOW()
      RETURNING *;
    `;
    const updatedAddressResult = await db.query(updateQuery, [uid, sixDCode, localitySuffix, region, city, district, neighborhood, lng, lat]);

    await db.query('COMMIT');
    
    res.status(200).json({ success: true, newAddress: updatedAddressResult.rows[0] });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'An error occurred while updating the address.' });
  }
});

module.exports = router;
