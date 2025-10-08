'use strict';
console.log("Executing main.js version 2");

import { GOOGLE_MAPS_API_KEY, somaliAdministrativeHierarchy, API_BASE_URL, SOMALIA_BOUNDS } from './config.js';
import { loadGoogleMapsAPI } from './utils.js';
import * as MapCore from './map-core.js';
import { setupRecaptcha, sendOtp, verifyOtp } from './firebase.js'; // Import Firebase functions
import { locales } from './locales.js';
import { safeJsonParse } from './json-sanitizer.js'; // Import the safe JSON parser

// --- State ---
let map, geocoder, placesService;
let drawnMapObjects = [];
let gridLines = [];
let homeMarker = null; // To hold the user's home marker
let currentAddress = null;
let confirmationResult = null;
let appState = {
    isLoggedIn: false,
    user: null, // Will hold the complete user data object from our backend
    sessionToken: null, // Our backend's JWT
    isUpdateMode: false, // ADD THIS LINE
    currentLanguage: 'so', // Default to Somali
    authFlow: null, // 'login' or 'register'
};
let resendTimerInterval = null;

// --- DOM Elements ---
const DOM = {
    mapElement: document.getElementById('map'),
    infoPanelInitial: document.getElementById('info-panel-initial'),
    infoPanelLoading: document.getElementById('info-panel-loading'),
    infoPanelAddress: document.getElementById('info-panel-address'),
    findMyLocationBtn: document.getElementById('find-my-location-btn'),
    registerThisAddressBtn: document.getElementById('register-this-address-btn'),
    gpsAccuracyDisplay: document.getElementById('gps-accuracy-display'),
    codePillSpans: document.querySelectorAll('.code-pill span'),
    addressDistrict: document.getElementById('address-district'),
    addressRegion: document.getElementById('address-region'),
    copyBtn: document.getElementById('copy-btn'),
    shareBtn: document.getElementById('share-btn'),
    recenterBtn: document.getElementById('recenter-btn'),
    bottomSheetOverlay: document.getElementById('bottom-sheet-overlay'),
    bottomSheetModal: document.getElementById('bottom-sheet-modal'),
    closeSheetBtn: document.getElementById('close-sheet-btn'),
    registrationForm: document.getElementById('registration-form'),
    regCodeDisplay: document.getElementById('reg-6d-code-display'),
    regRegion: document.getElementById('reg-region'),
    regCity: document.getElementById('reg-city'),
    regDistrict: document.getElementById('reg-district'),
    regNeighborhood: document.getElementById('reg-neighborhood'),
    regNeighborhoodManualWrapper: document.getElementById('reg-neighborhood-manual-wrapper'),
    otpModalOverlay: document.getElementById('otp-modal-overlay'),
    otpModal: document.getElementById('otp-modal'),
    otpForm: document.getElementById('otp-form'),
    otpPhoneDisplay: document.getElementById('otp-phone-display'),
    otpError: document.getElementById('otp-error'),
    logoutBtn: document.getElementById('logout-btn'),
    loginModalOverlay: document.getElementById('login-modal-overlay'),
    loginModal: document.getElementById('login-modal'),
    closeLoginModalBtn: document.getElementById('close-login-modal-btn'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    authLink: document.getElementById('auth-link'),
    authLinkText: document.getElementById('auth-link-text'),
    closeOtpModalBtn: document.getElementById('close-otp-modal-btn'),
    resendOtpBtn: document.getElementById('resend-otp-btn'),
    resendTimer: document.getElementById('resend-timer'),
    toast: document.getElementById('toast-notification'),
    settingsProfileManagement: document.getElementById('settings-profile-management'),
    settingsAppPreferences: document.getElementById('settings-app-preferences'),
    settingsDangerZone: document.getElementById('settings-danger-zone'),
    dashboardUpdateBtn: document.getElementById('dashboard-update-btn'),
    profileForm: document.getElementById('profile-form'),
    profileNameInput: document.getElementById('profile-name'),
    profilePhoneInput: document.getElementById('profile-phone'),
    historyContent: document.getElementById('history-content'),
    languageSelect: document.getElementById('language-select'),
    themeToggle: document.getElementById('theme-toggle'),
};

// --- Helper Functions ---
const normalize = (str) => (str || '').toLowerCase().replace(/ region| city| district/g, '').trim();

async function init() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY);
        map = new google.maps.Map(DOM.mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13, disableDefaultUI: true, zoomControl: true, clickableIcons: false, draggableCursor: 'default' });
        geocoder = new google.maps.Geocoder();
        placesService = new google.maps.places.PlacesService(map);
        setupRecaptcha('recaptcha-container'); // Initialize Firebase reCAPTCHA
        addEventListeners();
        MapCore.updateDynamicGrid(map, gridLines); // Initial grid draw
        const savedLanguage = localStorage.getItem('preferredLanguage') || 'so';
        appState.currentLanguage = savedLanguage;
        DOM.languageSelect.value = savedLanguage;
        applyTranslations(); // Apply initial translations on page load
        const savedTheme = localStorage.getItem('preferredTheme') || 'dark'; // Default to dark
        applyTheme(savedTheme);
        checkSession(); // This should be the last call before hiding the loader

        // --- NEW LOADER HIDE LOGIC ---
        const loaderWrapper = document.getElementById('loader-wrapper');
        if (loaderWrapper) {
            loaderWrapper.style.opacity = '0';
            // Wait for the fade-out transition to finish before removing the element
            setTimeout(() => {
                loaderWrapper.style.display = 'none';
            }, 500); // This duration must match the transition time in the CSS
        }
        // --- END OF NEW LOGIC ---

    } catch (error) {
        console.error("Initialization Error:", error);
        document.body.innerHTML = `<div>Error: Could not load the map.</div>`;
    }
}

/**
 * Applies translations to all elements with a data-i18n-key attribute.
 */
function applyTranslations() {
    const language = appState.currentLanguage;
    const translations = locales[language];
    if (!translations) return;

    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.dataset.i18nKey;
        if (translations[key]) {
            element.textContent = translations[key];
        }
    });

    // Handle language direction for Arabic
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
}

/**
 * Sets the application's language, saves the preference, and applies translations.
 * @param {string} langCode The language code (e.g., 'en', 'so', 'ar').
 */
function setLanguage(langCode) {
    appState.currentLanguage = langCode;
    localStorage.setItem('preferredLanguage', langCode); // Save preference
    applyTranslations();
}

/**
 * Applies the theme by adding/removing a class on the html element.
 * @param {string} theme The theme to apply ('light' or 'dark').
 */
function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.classList.add('light-mode');
        DOM.themeToggle.checked = true;
    } else {
        document.documentElement.classList.remove('light-mode');
        DOM.themeToggle.checked = false;
    }
}

/**
 * Sets the application's theme and saves the preference to localStorage.
 * @param {string} theme The theme to set ('light' or 'dark').
 */
function setTheme(theme) {
    applyTheme(theme);
    localStorage.setItem('preferredTheme', theme);
}

function addEventListeners() {
    map.addListener('click', (e) => processLocation(e.latLng));
    map.addListener('dragend', () => {
        if (currentAddress) DOM.recenterBtn.classList.remove('hidden');
        MapCore.updateDynamicGrid(map, gridLines); // Redraw grid on pan
    });
    map.addListener('zoom_changed', () => {
        MapCore.updateDynamicGrid(map, gridLines); // Redraw grid on zoom
    });
    DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
    DOM.registerThisAddressBtn.addEventListener('click', handlePrimaryInfoPanelAction);
    DOM.closeSheetBtn.addEventListener('click', closeRegistrationSheet);
    DOM.bottomSheetOverlay.addEventListener('click', closeRegistrationSheet);
    DOM.copyBtn.addEventListener('click', handleCopyAddress);
    DOM.shareBtn.addEventListener('click', handleShareAddress);
    DOM.recenterBtn.addEventListener('click', handleRecenterMap);
    DOM.regRegion.addEventListener('change', () => populateCities(DOM.regRegion.value));
    DOM.regCity.addEventListener('change', () => populateDistricts(DOM.regRegion.value, DOM.regCity.value));
    DOM.regDistrict.addEventListener('change', () => populateNeighborhoods(DOM.regRegion.value, DOM.regCity.value, DOM.regDistrict.value));
    DOM.regNeighborhood.addEventListener('change', () => DOM.regNeighborhoodManualWrapper.classList.toggle('hidden', DOM.regNeighborhood.value !== 'Other'));
    DOM.registrationForm.addEventListener('submit', handleRegistrationSubmit);
    DOM.otpForm.addEventListener('submit', handleOtpSubmit);
    // This is now handled by the navLinks loop below
    // DOM.authLink.addEventListener('click', handleAuthClick); 
    DOM.closeLoginModalBtn.addEventListener('click', () => toggleLoginModal(false));
    DOM.loginModalOverlay.addEventListener('click', () => toggleLoginModal(false));
    DOM.loginForm.addEventListener('submit', handleLoginSubmit);
    DOM.closeOtpModalBtn.addEventListener('click', () => toggleOtpModal(false));
    DOM.resendOtpBtn.addEventListener('click', async () => {
    if (DOM.resendOtpBtn.disabled) return;
    console.log("Resending OTP...");
    const fullPhoneNumber = DOM.otpPhoneDisplay.textContent;
    try {
        confirmationResult = await sendOtp(fullPhoneNumber);
        startResendTimer(); // Restart the timer on success
    } catch (error) {
        console.error("Error resending OTP:", error);
        DOM.otpError.textContent = t('error_resend_otp');
        DOM.otpError.classList.remove('hidden');
    }
});
    DOM.languageSelect.addEventListener('change', (e) => setLanguage(e.target.value));
    DOM.themeToggle.addEventListener('change', (e) => {
        setTheme(e.target.checked ? 'light' : 'dark');
    });

    // --- Bottom Navigation Logic ---
    const navLinks = document.querySelectorAll('#bottom-nav .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Special handling for the auth link
            if (link.id === 'auth-link') {
                handleAuthClick(e);
                return;
            }

            const viewName = link.dataset.view;
            if (!viewName) return;

            // --- PERMISSION CHECK ---
            const isProtectedView = (viewName === 'dashboard' || viewName === 'history');
            if (isProtectedView && !appState.isLoggedIn) {
                showToast("toast_please_login");
                return; // Stop the navigation
            }
            // --- END OF CHECK ---
            navigateToView(viewName);
            if (viewName === 'history') {
                renderHistory();
            }
        });
    });

    // --- Wire up the new Update Address button ---
    DOM.dashboardUpdateBtn.addEventListener('click', handleUpdateAddressClick);

    // Connect the real logout button
    DOM.logoutBtn.addEventListener('click', () => {
        if (confirm(t('confirm_logout'))) {
            logout({ shouldReload: true });
        }
    });
    DOM.profileForm.addEventListener('submit', handleProfileUpdate);
    const registerNowLink = document.getElementById('register-now-link');
    if (registerNowLink) {
        registerNowLink.addEventListener('click', handleRegisterNowClick);
    }
}

/**
 * Handles the "Register now" link click from the login modal.
 * Closes the modal and initiates the new user registration flow.
 */
function handleRegisterNowClick(e) {
    e.preventDefault();
    toggleLoginModal(false); // Close the login modal
    
    // A small delay to allow the modal to close before starting the animation
    setTimeout(() => {
        handleFindMyLocation(); // Trigger the GPS location flow
    }, 350); // Duration should be slightly longer than the modal's CSS transition
}

/**
 * Fetches and renders the user's address history.
 */
async function renderHistory() {
    if (!appState.isLoggedIn) return;

    DOM.historyContent.innerHTML = `<p class="loading-message">${t('history_loading')}</p>`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me/history`, {
            headers: { 'Authorization': `Bearer ${appState.sessionToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch history.');

        const history = await response.json();

        if (history.length === 0) {
            DOM.historyContent.innerHTML = `<p class="loading-message">${t('history_empty')}</p>`;
            return;
        }

        DOM.historyContent.innerHTML = ''; // Clear loading message
        history.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-item';
            
            const registeredDate = new Date(item.registered_at).toLocaleDateString();
            const archivedDate = new Date(item.archived_at).toLocaleDateString();
            const addressParts = [item.neighborhood, item.district, item.city, item.region].filter(Boolean).join(', ');

            itemEl.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-code">${item.six_d_code}</span>
                    <span class="history-item-dates">${t('history_used')}: ${registeredDate} - ${archivedDate}</span>
                </div>
                <p class="history-item-address">${addressParts}</p>
            `;
            DOM.historyContent.appendChild(itemEl);
        });

    } catch (error) {
        console.error("Failed to render history:", error);
        DOM.historyContent.innerHTML = `<p class="loading-message">${t('history_error')}</p>`;
    }
}

/**
 * Handles the submission of the profile update form.
 */
async function handleProfileUpdate(event) {
    event.preventDefault();
    const newFullName = DOM.profileNameInput.value.trim();
    if (newFullName === appState.user.full_name) {
        showToast("toast_no_changes");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appState.sessionToken}`
            },
            body: JSON.stringify({ fullName: newFullName })
        });

        if (!response.ok) throw new Error('Failed to update profile.');

        const result = await response.json();
        
        // Update the local state with the new name
        appState.user.full_name = result.updatedUser.full_name;
        
        showToast("toast_profile_updated");

    } catch (error) {
        console.error("Profile update failed:", error);
        showToast("toast_profile_update_error");
    }
}

/**
 * A simple translation function (t-function).
 * @param {string} key The i18n key.
 * @returns {string} The translated string or the key itself if not found.
 */
function t(key) {
    return locales[appState.currentLanguage]?.[key] || key;
}

/**
 * Displays a short-lived toast notification message.
 * @param {string} key The i18n key for the message to display.
 */
function showToast(key) {
    DOM.toast.textContent = t(key);
    DOM.toast.classList.add('show');
    setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}

/**
 * Shows or hides sections within the Settings page based on login state.
 */
function updateSettingsView() {
    const isLoggedIn = appState.isLoggedIn;
    DOM.settingsProfileManagement.classList.toggle('hidden', !isLoggedIn);
    DOM.settingsDangerZone.classList.toggle('hidden', !isLoggedIn);
}

/**
 * Handles clicks on the main auth link in the bottom nav.
 * If logged out, it opens the login modal.
 * If logged in, it logs the user out.
 */
function handleAuthClick(e) {
    e.preventDefault();
    if (appState.isLoggedIn) {
        // User is logged in, so this is a logout button
        if (confirm(t('confirm_logout'))) {
            logout({ shouldReload: true });
        }
    } else {
        // User is logged out, so this is a login button
        toggleLoginModal(true);
    }
}

/**
 * Updates the auth link's text and icon based on login state.
 */
function updateAuthLink() {
    if (appState.isLoggedIn) {
        DOM.authLinkText.textContent = t('nav_logout');
        // Optional: Change the icon to a "logout" icon
        DOM.authLink.querySelector('svg').innerHTML = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>';
    } else {
        DOM.authLinkText.textContent = t('nav_login');
        // Optional: Change the icon back to a "login" icon
        DOM.authLink.querySelector('svg').innerHTML = '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    }
}

/**
 * Toggles the visibility of the new Login Modal.
 * @param {boolean} show True to show, false to hide.
 */
function toggleLoginModal(show = false) {
    DOM.loginModalOverlay.classList.toggle('is-open', show);
    DOM.loginModal.classList.toggle('is-open', show);
    DOM.loginModalOverlay.classList.toggle('hidden', !show);
    DOM.loginModal.classList.toggle('hidden', !show);
    if (show) {
        DOM.loginError.classList.add('hidden');
        document.getElementById('login-phone').value = '';
        applyTranslations(); // Re-apply translations to the newly visible elements
    }
}

/**
 * Handles the submission of the new Login Modal form.
 */
async function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const phoneNumber = document.getElementById('login-phone').value;

    if (!/^[6-9]\d{8}$/.test(phoneNumber)) {
        DOM.loginError.textContent = t('error_invalid_phone');
        DOM.loginError.classList.remove('hidden');
        return;
    }
    
    submitButton.disabled = true;
    submitButton.textContent = t('sending_code');
    DOM.loginError.classList.add('hidden');

    try {
        const fullPhoneNumber = `+252${phoneNumber}`;
        appState.authFlow = 'login'; // Set the context to login
        confirmationResult = await sendOtp(fullPhoneNumber);
        console.log("OTP sent successfully for login.");
        toggleLoginModal(false); // Close the login modal
        toggleOtpModal(true, fullPhoneNumber); // Open the OTP modal
    } catch (error) {
        console.error("Error sending OTP for login:", error);
        DOM.loginError.textContent = t('error_send_code');
        DOM.loginError.classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = t('login_button');
    }
}

/**
 * Updates the initial info panel view based on login state.
 */
function updateInitialInfoPanel() {
    if (appState.isLoggedIn) {
        DOM.findMyLocationBtn.textContent = t('info_show_my_address');
    } else {
        DOM.findMyLocationBtn.textContent = t('info_find_my_address');
    }
}

/**
 * Checks for a session token in localStorage, verifies it with the backend,
 * and fetches the user's data to initiate the logged-in state.
 */
async function checkSession() {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
        console.log("No session token found. User is logged out.");
        updateAuthLink();
        return;
    }

    console.log("Session token found. Verifying with backend...");
    appState.sessionToken = token;

    try {
        // --- NEW: Add a timeout controller ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            signal: controller.signal // Attach the controller to the fetch request
        });

        clearTimeout(timeoutId); // Clear the timeout if the request succeeds

        if (!response.ok) {
            throw new Error('Invalid or expired session token.');
        }

        const responseData = await response.json();
        console.log("checkSession responseData:", responseData); // <-- Add this line
        
        // --- START OF FIX ---
        // Defensively get the user object, whether it's nested or the root of the response.
        const user = responseData.user || responseData; 

        // Check for a valid user object.
        if (!user || !user.id) {
            throw new Error('User data not found in server response.');
        }
        console.log("User data fetched successfully:", user);
        transitionToLoggedInState(user);
        // --- END OF FIX ---

    } catch (error) {
        console.error("Session check failed:", error);
        if (error.name === 'AbortError') {
            alert(t('error_server_timeout'));
        }
        logout();
    }
}

/**
 * Transitions the UI to the logged-in state and populates the dashboard,
 * correctly handling the map's asynchronous loading.
 */
function transitionToLoggedInState(userData) {
    console.log("Step 1: Entering transitionToLoggedInState. User data received:", userData);
    if (!userData) {
        console.error("transitionToLoggedInState called with null or undefined userData.");
        logout({ shouldReload: true });
        return;
    }
    appState.isLoggedIn = true;
    appState.user = userData;

    // --- Step 2: Populate all NON-MAP elements immediately ---
    document.getElementById('hero-user-name').textContent = userData.full_name;
    
    const dashboard6dCode = document.getElementById('dashboard-6d-code');
    if (dashboard6dCode && userData.six_d_code) {
        const codeParts = userData.six_d_code.split('-');
        dashboard6dCode.innerHTML = `
            <span class="code-part-red">${codeParts[0]}</span>-<span class="code-part-green">${codeParts[1]}</span>-<span class="code-part-blue">${codeParts[2]}</span>
        `;
    }

    document.getElementById('plaque-name').textContent = userData.full_name;
    const neighborhoodLine = document.getElementById('plaque-neighborhood');
    if (userData.neighborhood) {
        neighborhoodLine.textContent = userData.neighborhood;
        neighborhoodLine.style.display = 'block';
    } else {
        neighborhoodLine.style.display = 'none';
    }
    document.getElementById('plaque-district-region').textContent = `${userData.district}, ${userData.region} ${userData.locality_suffix || ''}`.trim();
    document.getElementById('plaque-city-country').textContent = `${userData.city}, Somalia`;

    console.log("Step 2: Dashboard text populated successfully.");
    
    // --- Step 4: Update all other non-map UI elements immediately ---
    // ... (The rest of the function remains the same)
    
    navigateToView('dashboard');
    updateAuthLink();
    updateSettingsView();
    updateInitialInfoPanel();
    console.log("Step 4: Final non-map UI state updated.");
}

/**
 * Logs the user out, clears the session, and resets the UI.
 * @param {object} options - Optional parameters.
 * @param {boolean} options.shouldReload - If true, the page will reload after logout.
 */
function logout(options = {}) {
    const { shouldReload = false } = options;

    localStorage.removeItem('sessionToken');
    appState.isLoggedIn = false;
    appState.user = null;
    appState.sessionToken = null;

    // Reset UI to logged-out state
    updateAuthLink();
    updateSettingsView();
    updateInitialInfoPanel(); 
    navigateToView('map'); // Go back to the default view

    if (shouldReload) {
        window.location.reload();
    }
}

/**
 * Initiates the address update flow.
 */
function handleUpdateAddressClick() {
    if (!appState.isLoggedIn || appState.user.updateLocked) return;

    appState.isUpdateMode = true;
    
    // Update the info panel's initial button text for the new context
    DOM.findMyLocationBtn.textContent = t('cancel_update');
    
    // Navigate to the map view
    navigateToView('map');
}

function navigateToView(viewName) {
    document.querySelectorAll('.main-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    document.querySelectorAll('#bottom-nav .nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`#bottom-nav .nav-link[data-view="${viewName}"]`);
    if (navLink) navLink.classList.add('active');

    // This is the fix for the translation bug.
    applyTranslations();
}

function toggleOtpModal(show = false, phoneNumber = '') {
    // These two lines handle the display: none / display: block
    DOM.otpModalOverlay.classList.toggle('hidden', !show);
    DOM.otpModal.classList.toggle('hidden', !show);

    // This timeout allows the 'display' to apply before starting the animation
    setTimeout(() => {
        // These two lines handle the opacity/transform animation
        DOM.otpModalOverlay.classList.toggle('is-open', show);
        DOM.otpModal.classList.toggle('is-open', show);
    }, 10);

    if (show) {
        DOM.otpPhoneDisplay.textContent = phoneNumber;
        DOM.otpError.classList.add('hidden');
        document.getElementById('otp-input').value = '';
        startResendTimer(); // START THE TIMER
        applyTranslations(); // Re-apply translations to the newly visible elements
    }
}

function startResendTimer() {
    let countdown = 60;
    DOM.resendOtpBtn.disabled = true;
    DOM.resendTimer.textContent = `(${countdown}s)`;

    if (resendTimerInterval) clearInterval(resendTimerInterval);

    resendTimerInterval = setInterval(() => {
        countdown--;
        DOM.resendTimer.textContent = `(${countdown}s)`;
        if (countdown <= 0) {
            clearInterval(resendTimerInterval);
            DOM.resendOtpBtn.disabled = false;
            DOM.resendTimer.textContent = '';
        }
    }, 1000);
}

function openRegistrationSheet() {
    DOM.bottomSheetOverlay.classList.remove('hidden');
    DOM.bottomSheetModal.classList.remove('hidden');
    setTimeout(() => {
        DOM.bottomSheetOverlay.classList.add('is-open');
        DOM.bottomSheetModal.classList.add('is-open');
        applyTranslations(); // Re-apply translations to the newly visible elements
    }, 10);
}

function closeRegistrationSheet() {
    DOM.bottomSheetOverlay.classList.remove('is-open');
    DOM.bottomSheetModal.classList.remove('is-open');
    setTimeout(() => {
        DOM.bottomSheetOverlay.classList.add('hidden');
        DOM.bottomSheetModal.classList.add('hidden');
    }, 300);
}

/**
 * Handles the main info panel button click.
 * Behavior is different for logged-in vs. logged-out users.
 */
function handleFindMyLocation() {
    if (appState.isLoggedIn && appState.user) {
        // --- LOGGED-IN USER: "Show My Registered Address" ---
        // PROACTIVE FIX: Defensively parse floats to prevent latent bug.
        const lat = parseFloat(appState.user.lat);
        const lng = parseFloat(appState.user.lng);
        const homePosition = new google.maps.LatLng(lat, lng);
        animateToLocation(map, homePosition, (finalLatLng) => {
            processLocation(finalLatLng); // Re-process the home location
        });
    } else {
        // --- LOGGED-OUT USER: "Find My 6D Address" (GPS) ---
        if (!navigator.geolocation) {
            alert(t('error_geolocation_unsupported'));
            return;
        }
        
        switchInfoPanelView('loading');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // --- START OF IMPROVED CODE ---
                // Check 1: Is it within the broad rectangle containing all of Somalia?
                if (lat < SOMALIA_BOUNDS.minLat || lat > SOMALIA_BOUNDS.maxLat || lng < SOMALIA_BOUNDS.minLng || lng > SOMALIA_BOUNDS.maxLng) {
                    showToast('toast_area_not_supported');
                    switchInfoPanelView('initial'); // Reset the UI
                    return; // Stop processing
                }
                // Check 2: Is it in the large, empty ocean area in the southeast?
                if (lat < 4.5 && lng > 48.0) {
                    showToast('toast_area_not_supported');
                    switchInfoPanelView('initial'); // Reset the UI
                    return; // Stop processing
                }
                // --- END OF IMPROVED CODE ---

                const latLng = new google.maps.LatLng(lat, lng);
                const accuracy = position.coords.accuracy;
                animateToLocation(map, latLng, (finalLatLng) => processLocation(finalLatLng, accuracy));
            },
            () => {
                alert(t('error_geolocation_failed'));
                switchInfoPanelView('initial');
            }
        );
    }
}

async function processLocation(latLng, accuracy = null) {
    const lat = latLng.lat();
    const lng = latLng.lng();

    // Check 1: Is it within the broad rectangle containing all of Somalia?
    if (lat < SOMALIA_BOUNDS.minLat || lat > SOMALIA_BOUNDS.maxLat || lng < SOMALIA_BOUNDS.minLng || lng > SOMALIA_BOUNDS.maxLng) {
        showToast('toast_area_not_supported');
        return; // Stop processing
    }
    // Check 2: Is it in the large, empty ocean area in the southeast? (This creates a more accurate boundary)
    if (lat < 4.5 && lng > 48.0) {
        showToast('toast_area_not_supported');
        return; // Stop processing
    }
    switchInfoPanelView('loading');
    DOM.recenterBtn.classList.add('hidden');
    const { sixDCode, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    MapCore.drawAddressBoxes(map, latLng, drawnMapObjects);
    try {
        const [geo, place] = await Promise.all([getReverseGeocode(latLng), getPlaceDetails(latLng)]);
        const finalAddress = parseAddressComponents(geo, place);
        currentAddress = { sixDCode, localitySuffix, lat: latLng.lat(), lng: latLng.lng(), ...finalAddress };
        updateInfoPanel(currentAddress, accuracy);
        switchInfoPanelView('address');
    } catch (error) {
        console.error("Geocoding failed:", error);
        updateInfoPanel({ sixDCode, district: t('error_geocoding'), region: "", localitySuffix }, accuracy);
        switchInfoPanelView('address');
    }
}

/**
 * Calculates the distance in kilometers between two LatLng points.
 * @param {google.maps.LatLng} point1
 * @param {google.maps.LatLng} point2
 * @returns {string} A formatted distance string (e.g., "5.2 km").
 */
function calculateDistance(point1, point2) {
    if (google.maps.geometry) {
        const distanceInMeters = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
        return `${(distanceInMeters / 1000).toFixed(1)} km`;
    }
    return ''; // Return empty if geometry library isn't loaded
}

function updateInfoPanel(data, accuracy) {
    const codeParts = (data.sixDCode || '').split('-');
    if (DOM.codePillSpans.length === 3) {
        DOM.codePillSpans[0].textContent = codeParts[0] || '';
        DOM.codePillSpans[1].textContent = codeParts[1] || '';
        DOM.codePillSpans[2].textContent = codeParts[2] || '';
    }
    DOM.addressDistrict.textContent = data.district || '';
    DOM.addressRegion.textContent = `${data.region || ''} ${data.localitySuffix || ''}`.trim();

    if (appState.isLoggedIn && appState.user) {
        // --- LOGGED-IN "EXPLORATION" MODE ---
        DOM.registerThisAddressBtn.classList.add('hidden'); // Hide the register button

        // Calculate and display the distance from their home address
        // PROACTIVE FIX: Defensively parse floats to prevent latent bug.
        const homeLat = parseFloat(appState.user.lat);
        const homeLng = parseFloat(appState.user.lng);
        const homePosition = new google.maps.LatLng(homeLat, homeLng);
        const selectedPosition = new google.maps.LatLng(data.lat, data.lng);
        const distance = calculateDistance(homePosition, selectedPosition);
        
        if (DOM.gpsAccuracyDisplay) { // Reuse the accuracy display for distance
            DOM.gpsAccuracyDisplay.textContent = `${t('distance_from_home')}: ${distance}`;
            DOM.gpsAccuracyDisplay.classList.remove('hidden');
        }

    } else {
        // --- LOGGED-OUT "REGISTRATION" MODE ---
        DOM.registerThisAddressBtn.classList.remove('hidden'); // Show the register button
        
        if (accuracy) {
            DOM.gpsAccuracyDisplay.textContent = `${t('location_accuracy')}: ±${Math.round(accuracy)}m`;
            DOM.gpsAccuracyDisplay.classList.remove('hidden');
        } else {
            DOM.gpsAccuracyDisplay.classList.add('hidden');
        }
    }
}

function handleCopyAddress() {
    if (!currentAddress) return;
    const addressString = `${currentAddress.sixDCode}\n${currentAddress.district}, ${currentAddress.region} ${currentAddress.localitySuffix}`;
    navigator.clipboard.writeText(addressString).then(() => showToast("toast_address_copied"));
}

function handleShareAddress() {
    if (!currentAddress || !navigator.share) return;
    const addressString = `${currentAddress.sixDCode}, ${currentAddress.district}, ${currentAddress.region} ${currentAddress.localitySuffix}`;
    navigator.share({ title: '6D Address', text: `${t('share_text')}: ${addressString}`, url: window.location.href });
}

function handleRecenterMap() {
    if (!currentAddress) return;
    map.panTo({ lat: currentAddress.lat, lng: currentAddress.lng });
    DOM.recenterBtn.classList.add('hidden');
}

function animateToLocation(map, latLng, onComplete) {
    map.setZoom(12);
    google.maps.event.addListenerOnce(map, 'idle', () => {
        map.panTo(latLng);
        google.maps.event.addListenerOnce(map, 'idle', () => {
            map.setZoom(18);
            if (onComplete) {
                google.maps.event.addListenerOnce(map, 'idle', () => onComplete(latLng));
            }
        });
    });
}

function getReverseGeocode(latLng) { return new Promise((resolve, reject) => geocoder.geocode({ location: latLng }, (results, status) => (status === 'OK' && results[0]) ? resolve(results[0].address_components) : reject(new Error(status)))); }
function getPlaceDetails(latLng) { return new Promise((resolve) => placesService.nearbySearch({ location: latLng, rankBy: google.maps.places.RankBy.DISTANCE, type: 'sublocality' }, (results, status) => resolve((status === 'OK' && results[0]) ? results[0] : null))); }

function parseAddressComponents(geocodeComponents, placeResult) {
    const getComponent = (type) => {
        const component = geocodeComponents.find(c => c.types.includes(type));
        return component ? component.long_name : null;
    };
    let district = '';
    if (placeResult && placeResult.name && !placeResult.types.includes('route')) {
        district = placeResult.name;
    } else {
        district = getComponent('sublocality_level_1') || getComponent('locality') || getComponent('administrative_area_level_2') || t('unknown_district');
    }
    const region = getComponent('administrative_area_level_1') || t('unknown_region');
    const city = getComponent('locality') || getComponent('administrative_area_level_2') || region;
    return { district, region, city };
}

function switchInfoPanelView(viewName) {
    ['initial', 'loading', 'address'].forEach(v => {
        const el = DOM[`infoPanel${v.charAt(0).toUpperCase() + v.slice(1)}`];
        if (el) el.classList.remove('active');
    });
    const viewToShow = DOM[`infoPanel${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`];
    if (viewToShow) viewToShow.classList.add('active');
}

/**
 * Handles the primary action from the info panel.
 * If in update mode, it confirms the new address.
 * If not, it opens the registration sheet.
 */
async function handlePrimaryInfoPanelAction() {
    if (!currentAddress) return;

    if (appState.isUpdateMode) {
        // --- UPDATE FLOW ---
        if (confirm(`${t('confirm_update_address_1')}\n\n${currentAddress.sixDCode}\n${currentAddress.district}, ${currentAddress.region}`)) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users/me/address`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${appState.sessionToken}`
                    },
                    body: JSON.stringify(currentAddress)
                });

                if (!response.ok) throw new Error('Failed to update address.');

                showToast("toast_address_updated");
                appState.isUpdateMode = false; // Exit update mode
                setTimeout(() => window.location.reload(), 2000); // Reload the page to reflect the new address

            } catch (error) {
                console.error("Address update failed:", error);
                alert(t('error_address_update'));
            }
        }
    } else {
        // --- REGISTRATION FLOW ---
        populateRegistrationForm();
        openRegistrationSheet();
    }
}

function populateRegistrationForm() {
    DOM.regCodeDisplay.textContent = currentAddress.sixDCode;
    const regionKey = populateRegions(currentAddress.region);
    const cityKey = populateCities(regionKey, currentAddress.city);
    const districtKey = populateDistricts(regionKey, cityKey, currentAddress.district);
    populateNeighborhoods(regionKey, cityKey, districtKey);
}

function findKeyByAlias(obj, valueToMatch) {
    if (!obj || !valueToMatch) return '';
    const normalizedValue = normalize(valueToMatch);
    // This assumes the new config structure with aliases
    return Object.keys(obj).find(key => {
        const item = obj[key];
        if (typeof item !== 'object' || !item.aliases) { // Fallback for simple key-value
            return normalize(key) === normalizedValue;
        }
        return item.aliases.includes(normalizedValue);
    }) || '';
}

function populateRegions(selectedValue) {
    DOM.regRegion.innerHTML = `<option value="">${t('select_region')}</option>`;
    const matchedKey = findKeyByAlias(somaliAdministrativeHierarchy, selectedValue);
    Object.keys(somaliAdministrativeHierarchy).forEach(key => {
        const region = somaliAdministrativeHierarchy[key];
        DOM.regRegion.add(new Option(region.displayName, key));
    });
    if (matchedKey) DOM.regRegion.value = matchedKey;
    return DOM.regRegion.value;
}

function populateCities(regionKey, selectedValue) {
    DOM.regCity.innerHTML = `<option value="">${t('select_city')}</option>`;
    if (!regionKey) return '';
    const cities = somaliAdministrativeHierarchy[regionKey]?.cities || {};
    const matchedKey = findKeyByAlias(cities, selectedValue);
    Object.keys(cities).forEach(key => {
        const city = cities[key];
        DOM.regCity.add(new Option(city.displayName, key));
    });
    if (matchedKey) DOM.regCity.value = matchedKey;
    return DOM.regCity.value;
}

function populateDistricts(regionKey, cityKey, selectedValue) {
    DOM.regDistrict.innerHTML = `<option value="">${t('select_district')}</option>`;
    if (!regionKey || !cityKey) return '';
    const districts = somaliAdministrativeHierarchy[regionKey]?.cities?.[cityKey]?.districts || {};
    const matchedKey = findKeyByAlias(districts, selectedValue);
    Object.keys(districts).forEach(key => {
        const district = districts[key];
        DOM.regDistrict.add(new Option(district.displayName, key));
    });
    if (matchedKey) DOM.regDistrict.value = matchedKey;
    return DOM.regDistrict.value;
}

function populateNeighborhoods(regionKey, cityKey, districtKey) {
    DOM.regNeighborhood.innerHTML = `<option value="">${t('select_neighborhood')}</option>`;
    if (!regionKey || !cityKey || !districtKey) {
        DOM.regNeighborhood.add(new Option(t('other'), "Other"));
        return;
    };
    const neighborhoods = somaliAdministrativeHierarchy[regionKey]?.cities?.[cityKey]?.districts?.[districtKey]?.neighborhoods || [];
    neighborhoods.forEach(n => DOM.regNeighborhood.add(new Option(n, n)));
    DOM.regNeighborhood.add(new Option(t('other'), "Other"));
}

async function handleRegistrationSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = t('sending_code');

    const phoneNumber = `+252${document.getElementById('reg-phone').value}`;

    try {
        // This function is imported from firebase.js
        appState.authFlow = 'register'; // Set the context to registration
        confirmationResult = await sendOtp(phoneNumber);
        console.log("OTP sent successfully. Confirmation result stored.");
        
        closeRegistrationSheet(); // Close the form sheet
        toggleOtpModal(true, phoneNumber); // Open the stylish OTP modal

    } catch (error) {
        console.error("Error sending OTP:", error);
        alert(t('error_send_code'));
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = t('reg_button');
    }
}

async function handleOtpSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const otpCode = document.getElementById('otp-input').value;
    
    if (!confirmationResult || !/^\d{6}$/.test(otpCode)) {
        DOM.otpError.textContent = t('error_invalid_otp');
        DOM.otpError.classList.remove('hidden');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = t('verifying');
    DOM.otpError.classList.add('hidden');

    try {
        const result = await verifyOtp(confirmationResult, otpCode);
        const firebaseUser = result.user;
        const idToken = await firebaseUser.getIdToken();

        const requestBody = { token: idToken };
        
        if (appState.authFlow === 'register') {
            requestBody.fullName = document.getElementById('reg-name').value;
            
            // --- THIS IS THE MISSING CODE ---
            requestBody.address = {
                sixDCode: currentAddress.sixDCode,
                localitySuffix: currentAddress.localitySuffix,
                region: DOM.regRegion.options[DOM.regRegion.selectedIndex].text,
                city: DOM.regCity.options[DOM.regCity.selectedIndex].text,
                district: DOM.regDistrict.options[DOM.regDistrict.selectedIndex].text,
                neighborhood: DOM.regNeighborhood.value === 'Other' 
                    ? document.getElementById('reg-neighborhood-manual').value 
                    : DOM.regNeighborhood.value,
                lat: currentAddress.lat,
                lng: currentAddress.lng
            };
            // --- END OF MISSING CODE ---
        }

        // Call our SINGLE, UNIFIED auth endpoint for both login and registration.
        const authResponse = await fetch(`${API_BASE_URL}/api/auth/firebase`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}` // Still needed for middleware
            },
            body: JSON.stringify(requestBody),
        });

        if (!authResponse.ok) {
            const errorData = await authResponse.json();
            throw new Error(errorData.error || 'Backend authentication failed.');
        }
        
        const authData = await authResponse.json();
        localStorage.setItem('sessionToken', authData.token);
        appState.sessionToken = authData.token;
        console.log("Backend session token received.");

        toggleOtpModal(false);
        showToast("toast_reg_success");
        // Transition to the dashboard using the complete user data returned from the auth endpoint.
        transitionToLoggedInState(authData.user);

    } catch (error) {
        console.error("Final authentication step failed:", error);
        DOM.otpError.textContent = t('error_auth_failed');
        DOM.otpError.classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = t('otp_button');
    }
}

document.addEventListener('DOMContentLoaded', init);

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully with scope: ', registration.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed: ', err);
      });
  });
}
