const admin = require('../firebaseAdmin');
const jwt = require('jsonwebtoken'); // MAKE SURE TO REQUIRE THIS

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

// NEW: Middleware to verify our own internal JWT
function verifySessionToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Unauthorized: No session token provided.' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // IMPORTANT: We are attaching our own user ID, not the full Firebase token
    req.user = { uid: decoded.userId }; 
    next();
  } catch (error) {
    console.error('Invalid session token:', error);
    res.status(403).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
}

module.exports = { verifyFirebaseToken, verifySessionToken }; // EXPORT THE NEW FUNCTION
