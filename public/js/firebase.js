// Import the necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// Your web app's Firebase configuration
// IMPORTANT: In a real app, these would be loaded from environment variables, not hardcoded.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage(); // Use the device's language for SMS messages

/**
 * Sets up the reCAPTCHA verifier. This is required by Firebase for phone auth.
 * @param {string} containerId The ID of the HTML element to render the reCAPTCHA in.
 */
export function setupRecaptcha(containerId) {
    window.recaptchaVerifier = new RecaptchaVerifier(containerId, {
        'size': 'invisible',
        'callback': (response) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber.
            console.log("reCAPTCHA solved.");
        }
    }, auth);
}

/**
 * Sends an OTP code to the provided phone number.
 * @param {string} phoneNumber The full phone number (e.g., +25261xxxxxxx).
 * @returns {Promise<any>} A promise that resolves with the confirmation result object.
 */
export function sendOtp(phoneNumber) {
    const appVerifier = window.recaptchaVerifier;
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

/**
 * Verifies the OTP code entered by the user.
 * @param {any} confirmationResult The object received from sendOtp.
 * @param {string} otpCode The 6-digit code from the user.
 * @returns {Promise<any>} A promise that resolves with the user's credentials on success.
 */
export function verifyOtp(confirmationResult, otpCode) {
    return confirmationResult.confirm(otpCode);
}