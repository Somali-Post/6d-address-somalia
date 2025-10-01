const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// The endpoint our frontend will call
// POST /api/auth/firebase
router.post('/firebase', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'Firebase ID token is required.' });
  }

  try {
    // 1. Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;

    // 2. Check if the user exists in our PostgreSQL database
    let userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
    let user = userResult.rows[0];

    // 3. If the user does not exist, create them
    if (!user) {
      // For a new user, the frontend must provide the full name
      const { fullName } = req.body;
      if (!fullName) {
        return res.status(400).json({ error: 'Full name is required for new user registration.' });
      }
      const newUserResult = await db.query(
        'INSERT INTO users(id, phone_number, full_name) VALUES($1, $2, $3) RETURNING *',
        [uid, phone_number, fullName]
      );
      user = newUserResult.rows[0];
    }

    // 4. Generate our own internal session token (JWT)
    const sessionToken = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Token expires in 7 days
    );

    // 5. Send the session token back to the frontend
    res.status(200).json({ token: sessionToken });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed. Invalid token.' });
  }
});

module.exports = router;
