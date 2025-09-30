// This script runs on the Netlify server during the build process.
const fs = require('fs');

const configPath = './public/js/config.js';
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  throw new Error("Google Maps API key not found in environment variables.");
}

// Read the config.js file
let configFileContent = fs.readFileSync(configPath, 'utf8');

// Replace the placeholder with the actual API key
configFileContent = configFileContent.replace(
  'YOUR_GOOGLE_MAPS_API_KEY_HERE',
  apiKey
);

// Write the updated content back to the file
fs.writeFileSync(configPath, configFileContent);

console.log('Successfully injected Google Maps API key.');