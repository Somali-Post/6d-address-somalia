const express = require('express');
const admin = require('../firebaseAdmin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

// The endpoint our frontend will call
// POST /api/auth/firebase
router.post('/firebase', async (req, res) => {
  // Diagnostic Log to see what's arriving
  console.log('Incoming Headers on /api/auth/firebase:', req.headers);

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
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [uid]);
    const user = userResult.rows[0];

    // 3. If the user does not exist in our system, they must register first.
    // This endpoint is for logging in only.
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found. Please complete the registration process.' 
      });
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
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ 
      error: 'Authentication failed. Invalid token.',
      firebaseError: error.message // Send the specific error back in the response
    });
  }
});

module.exports = router;
