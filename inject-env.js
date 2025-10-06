const fs = require('fs');

// --- File Paths ---
const configTemplatePath = './public/js/config.template.js'; // Assuming you create a template for this too
const configPath = './public/js/config.js';
const firebaseTemplatePath = './public/js/firebase.template.js';
const firebasePath = './public/js/firebase.js';

// --- Create config.js from template ---
let configContent = fs.readFileSync(configTemplatePath, 'utf8');
configContent = configContent.replace('__GOOGLE_MAPS_API_KEY__', process.env.GOOGLE_MAPS_API_KEY);
fs.writeFileSync(configPath, configContent);
console.log('Successfully created js/config.js');

// --- Create firebase.js from template ---
let firebaseContent = fs.readFileSync(firebaseTemplatePath, 'utf8');
firebaseContent = firebaseContent.replace('__FIREBASE_API_KEY__', process.env.FIREBASE_API_KEY);
firebaseContent = firebaseContent.replace('__FIREBASE_AUTH_DOMAIN__', process.env.FIREBASE_AUTH_DOMAIN);
firebaseContent = firebaseContent.replace('__FIREBASE_PROJECT_ID__', process.env.FIREBASE_PROJECT_ID);
firebaseContent = firebaseContent.replace('__FIREBASE_STORAGE_BUCKET__', process.env.FIREBASE_STORAGE_BUCKET);
firebaseContent = firebaseContent.replace('__FIREBASE_MESSAGING_SENDER_ID__', process.env.FIREBASE_MESSAGING_SENDER_ID);
firebaseContent = firebaseContent.replace('__FIREBASE_APP_ID__', process.env.FIREBASE_APP_ID);
firebaseContent = firebaseContent.replace('__FIREBASE_MEASUREMENT_ID__', process.env.FIREBASE_MEASUREMENT_ID);

fs.writeFileSync(firebasePath, firebaseContent);
console.log('Successfully created js/firebase.js');