const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/firebase', async (req, res) => {
  // ... (The top part of the function remains the same: getting the token, verifying it, finding/creating the user)

  try {
    // ... (The logic to verify the token and get/create the 'user' object is the same)
    
    // --- START OF DEFINITIVE FIX ---

    // 1. Fetch the full user profile data, which may have non-standard dates
    const fullProfileQuery = `
      SELECT
        u.id, u.phone_number, u.full_name, u.created_at,
        a.six_d_code, a.locality_suffix, a.region, a.city, a.district, a.neighborhood, a.registered_at,
        ST_X(a.location) as lng, ST_Y(a.location) as lat
      FROM users u LEFT JOIN addresses a ON u.id = a.user_id
      WHERE u.id = $1;
    `;
    const fullProfileResult = await db.query(fullProfileQuery, [uid]);
    
    if (fullProfileResult.rows.length === 0) {
        return res.status(404).json({ error: 'Could not retrieve user profile.' });
    }
    
    const fullUserProfile = fullProfileResult.rows[0];

    // 2. Generate the session token (this is safe)
    const sessionToken = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 3. Manually construct a clean, safe JSON string.
    // This bypasses any and all global prototype pollution or serialization bugs.
    const jsonResponse = JSON.stringify({
        token: sessionToken,
        user: {
            id: fullUserProfile.id,
            phone_number: fullUserProfile.phone_number,
            full_name: fullUserProfile.full_name,
            created_at: new Date(fullUserProfile.created_at).toISOString(), // Force ISO format
            six_d_code: fullUserProfile.six_d_code,
            locality_suffix: fullUserProfile.locality_suffix,
            region: fullUserProfile.region,
            city: fullUserProfile.city,
            district: fullUserProfile.district,
            neighborhood: fullUserProfile.neighborhood,
            registered_at: fullUserProfile.registered_at ? new Date(fullUserProfile.registered_at).toISOString() : null, // Force ISO format
            lng: fullUserProfile.lng,
            lat: fullUserProfile.lat
        }
    });

    // 4. Send the manually constructed JSON string with the correct header.
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(jsonResponse);

    // --- END OF DEFINITIVE FIX ---

  } catch (error) {
    console.error('Authentication process failed:', error);
    res.status(401).json({ error: 'Authentication failed.' });
  }
});

module.exports = router;