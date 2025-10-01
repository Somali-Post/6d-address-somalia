const admin = require('firebase-admin');

try {
  // 1. Get the Base64 encoded string from the environment variable.
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!serviceAccountBase64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found.');
  }

  // 2. Decode the Base64 string back into a normal JSON string.
  const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');

  // 3. Parse the decoded JSON string into an object.
  const serviceAccount = JSON.parse(serviceAccountJson);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("Firebase Admin SDK initialized successfully.");

} catch (error) {
  console.error("Firebase Admin SDK initialization failed:", error);
  process.exit(1);
}

module.exports = admin;