const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/firebase', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;

    let userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
    let user = userResult.rows[0];

    if (!user) {
      const { fullName } = req.body;
      if (!fullName) {
        return res.status(400).json({ error: 'User profile not found. Please complete the registration process.' });
      }
      const newUserResult = await db.query(
        'INSERT INTO users(id, phone_number, full_name) VALUES($1, $2, $3) RETURNING *',
        [uid, phone_number, fullName]
      );
      user = newUserResult.rows[0];
    }

    // --- DEFINITIVE FIX: ALWAYS fetch the full address data ---
    // After getting or creating the user, we now fetch their complete profile.
    const fullProfileQuery = `
      SELECT
        u.id, u.phone_number, u.full_name, u.created_at,
        a.six_d_code, a.locality_suffix, a.region, a.city, a.district, a.neighborhood, a.registered_at,
        ST_X(a.location) as lng,
        ST_Y(a.location) as lat
      FROM users u
      LEFT JOIN addresses a ON u.id = a.user_id
      WHERE u.id = $1;
    `;
    const fullProfileResult = await db.query(fullProfileQuery, [uid]);

    if (fullProfileResult.rows.length === 0) {
        // This should never happen if we just created the user, but it's a good safety check.
        return res.status(404).json({ error: 'Could not retrieve user profile after login/registration.' });
    }
    
    let fullUserProfile = fullProfileResult.rows[0];

    // Manually format the date fields to ISO strings to prevent parsing errors
    fullUserProfile.created_at = new Date(fullUserProfile.created_at).toISOString();
    if (fullUserProfile.registered_at) {
      fullUserProfile.registered_at = new Date(fullUserProfile.registered_at).toISOString();
    }

    const sessionToken = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send back the token AND the complete, formatted user data object
    res.status(200).json({ 
        token: sessionToken,
        user: fullUserProfile 
    });

  } catch (error) {
    console.error('Authentication process failed:', error);
    res.status(401).json({ error: 'Authentication failed.' });
  }
});

module.exports = router;