const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// POST /api/auth/firebase
// This is the single endpoint for both login and the final step of registration.
router.post('/firebase', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, phone_number } = decodedToken;

    // 2. Check if the user exists in our PostgreSQL database
    let userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
    let user = userResult.rows[0];

    // 3. If the user does NOT exist, create them.
    // This handles the final step of registration automatically.
    if (!user) {
      // The frontend MUST provide the full name for a new user.
      const { fullName } = req.body;
      if (!fullName) {
        // This is a special case: a valid Firebase user who is not in our DB and didn't provide a name.
        // This could happen if they deleted their account and are trying to log in again.
        // We'll treat it as an error and ask them to re-register.
        return res.status(400).json({ error: 'User profile not found. Please complete the registration process.' });
      }
      const newUserResult = await db.query(
        'INSERT INTO users(id, phone_number, full_name) VALUES($1, $2, $3) RETURNING *',
        [uid, phone_number, fullName]
      );
      user = newUserResult.rows[0];
    }

    // 4. By this point, we are guaranteed to have a user record.
    // Generate our own internal session token (JWT).
    const sessionToken = jwt.sign(
      { userId: user.id, phone: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Send the session token back to the frontend.
    res.status(200).json({ token: sessionToken });

  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ 
      error: 'Authentication failed. Invalid token.',
      firebaseError: error.message
    });
  }
});

module.exports = router;