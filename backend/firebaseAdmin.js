const admin = require('firebase-admin');
try {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!serviceAccountBase64) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 not found.");
  
  const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('ascii');
  const serviceAccount = JSON.parse(serviceAccountJson);

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Firebase Admin SDK initialization failed:", error);
  process.exit(1);
}
module.exports = admin;