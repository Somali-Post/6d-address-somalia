'use strict';

import { GOOGLE_MAPS_API_KEY, somaliAdministrativeHierarchy } from './config.js';
import { loadGoogleMapsAPI } from './utils.js';
import * as MapCore from './map-core.js';
import { setupRecaptcha, sendOtp, verifyOtp } from './firebase.js';

// --- State ---
let map, geocoder, placesService;
let drawnMapObjects = [];
let currentAddress = null;
let confirmationResult = null; // To store the Firebase confirmation result

// --- DOM Elements ---
const DOM = {
    mapElement: document.getElementById('map'),
    infoPanelInitial: document.getElementById('info-panel-initial'),
    infoPanelLoading: document.getElementById('info-panel-loading'),
    infoPanelAddress: document.getElementById('info-panel-address'),
    findMyLocationBtn: document.getElementById('find-my-location-btn'),
    codeDisplay: document.querySelector('#info-panel-address .code-display'),
    locationText: document.querySelector('#info-panel-address .location-text'),
    registerThisAddressBtn: document.getElementById('register-this-address-btn'),
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
    // OTP Modal Elements
    otpModalOverlay: document.getElementById('otp-modal-overlay'),
    otpModal: document.getElementById('otp-modal'),
    otpForm: document.getElementById('otp-form'),
    otpPhoneDisplay: document.getElementById('otp-phone-display'),
    otpError: document.getElementById('otp-error'),
};

async function init() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY);
        map = new google.maps.Map(DOM.mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13, disableDefaultUI: true, zoomControl: true, clickableIcons: false, draggableCursor: 'default' });
        geocoder = new google.maps.Geocoder();
        placesService = new google.maps.places.PlacesService(map);
        setupRecaptcha('recaptcha-container');
        addEventListeners();
    } catch (error) {
        console.error("Initialization Error:", error);
        document.body.innerHTML = `<div>Error: Could not load the map.</div>`;
    }
}

function addEventListeners() {
    map.addListener('click', (e) => processLocation(e.latLng));
    DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
    DOM.registerThisAddressBtn.addEventListener('click', handleShowRegistrationSheet);
    DOM.closeSheetBtn.addEventListener('click', closeRegistrationSheet);
    DOM.bottomSheetOverlay.addEventListener('click', closeRegistrationSheet);
    DOM.regRegion.addEventListener('change', () => populateCities(DOM.regRegion.value));
    DOM.regCity.addEventListener('change', () => populateDistricts(DOM.regRegion.value, DOM.regCity.value));
    DOM.regDistrict.addEventListener('change', () => populateNeighborhoods(DOM.regRegion.value, DOM.regCity.value, DOM.regDistrict.value));
    DOM.regNeighborhood.addEventListener('change', () => DOM.regNeighborhoodManualWrapper.classList.toggle('hidden', DOM.regNeighborhood.value !== 'Other'));
    DOM.registrationForm.addEventListener('submit', handleRegistrationSubmit);
    DOM.otpForm.addEventListener('submit', handleOtpSubmit);
}

function openRegistrationSheet() {
    DOM.bottomSheetOverlay.classList.remove('hidden');
    DOM.bottomSheetModal.classList.remove('hidden');
    setTimeout(() => {
        DOM.bottomSheetOverlay.classList.add('is-open');
        DOM.bottomSheetModal.classList.add('is-open');
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

function toggleOtpModal(show = false, phoneNumber = '') {
    DOM.otpModalOverlay.classList.toggle('is-open', show);
    DOM.otpModal.classList.toggle('is-open', show);
    DOM.otpModalOverlay.classList.toggle('hidden', !show);
    DOM.otpModal.classList.toggle('hidden', !show);
    if (show) {
        DOM.otpPhoneDisplay.textContent = phoneNumber;
        DOM.otpError.classList.add('hidden');
        document.getElementById('otp-input').value = '';
    }
}

async function handleRegistrationSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending Code...';

    const phoneNumber = `+252${document.getElementById('reg-phone').value}`;

    try {
        confirmationResult = await sendOtp(phoneNumber);
        console.log("OTP sent. Confirmation result stored.");
        closeRegistrationSheet();
        toggleOtpModal(true, phoneNumber);
    } catch (error) {
        console.error("Error sending OTP:", error);
        alert("Failed to send verification code. Please check the phone number and try again.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Verify Phone Number';
    }
}

async function handleOtpSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const otpCode = document.getElementById('otp-input').value;
    
    if (!confirmationResult || !/^\d{6}$/.test(otpCode)) {
        DOM.otpError.textContent = "Please enter a valid 6-digit code.";
        DOM.otpError.classList.remove('hidden');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Verifying...';
    DOM.otpError.classList.add('hidden');

    try {
        const result = await verifyOtp(confirmationResult, otpCode);
        const user = result.user;
        console.log("Phone number verified! User UID:", user.uid);
        
        toggleOtpModal(false);
        alert(`Registration successful! Welcome, user ${user.uid}. Next step: Save data to Firestore and show dashboard.`);
        // Here we will save data to Firestore and transition to the dashboard view.

    } catch (error) {
        console.error("Error verifying OTP:", error);
        DOM.otpError.textContent = "The code you entered is incorrect. Please try again.";
        DOM.otpError.classList.remove('hidden');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Verify & Proceed';
    }
}

// --- All other functions (processLocation, populateDropdowns, etc.) are unchanged ---
const normalize = (str) => (str || '').toLowerCase().replace(/ region| city| district/g, '').trim();

function handleFindMyLocation() {
    if (!navigator.geolocation) return alert("Geolocation is not supported.");
    switchInfoPanelView('loading');
    navigator.geolocation.getCurrentPosition(
        (pos) => animateToLocation(map, new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude), (latLng) => processLocation(latLng)),
        () => { alert("Unable to retrieve your location."); switchInfoPanelView('initial'); }
    );
}

async function processLocation(latLng) {
    switchInfoPanelView('loading');
    const { sixDCode, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    MapCore.drawAddressBoxes(map, latLng, drawnMapObjects);
    try {
        const [geo, place] = await Promise.all([getReverseGeocode(latLng), getPlaceDetails(latLng)]);
        const finalAddress = parseAddressComponents(geo, place);
        currentAddress = { sixDCode, localitySuffix, lat: latLng.lat(), lng: latLng.lng(), ...finalAddress };
        updateInfoPanel(currentAddress);
        switchInfoPanelView('address');
    } catch (error) {
        updateInfoPanel({ sixDCode, district: "Could not find address", region: "", localitySuffix });
        switchInfoPanelView('address');
    }
}

function handleShowRegistrationSheet() {
    if (!currentAddress) return alert("Please select a location on the map first.");
    populateRegistrationForm();
    openRegistrationSheet();
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
    return Object.keys(obj).find(key => {
        const item = obj[key];
        return item.aliases && item.aliases.includes(normalizedValue);
    }) || '';
}

function populateRegions(selectedValue) {
    DOM.regRegion.innerHTML = '<option value="">Select Region</option>';
    const matchedKey = findKeyByAlias(somaliAdministrativeHierarchy, selectedValue);
    Object.keys(somaliAdministrativeHierarchy).forEach(key => {
        const region = somaliAdministrativeHierarchy[key];
        DOM.regRegion.add(new Option(region.displayName, key));
    });
    if (matchedKey) {
        DOM.regRegion.value = matchedKey;
    }
    return DOM.regRegion.value;
}

function populateCities(regionKey, selectedValue) {
    DOM.regCity.innerHTML = '<option value="">Select City</option>';
    if (!regionKey) return '';
    const cities = somaliAdministrativeHierarchy[regionKey]?.cities || {};
    const matchedKey = findKeyByAlias(cities, selectedValue);
    Object.keys(cities).forEach(key => {
        const city = cities[key];
        DOM.regCity.add(new Option(city.displayName, key));
    });
    if (matchedKey) {
        DOM.regCity.value = matchedKey;
    }
    return DOM.regCity.value;
}

function populateDistricts(regionKey, cityKey, selectedValue) {
    DOM.regDistrict.innerHTML = '<option value="">Select District</option>';
    if (!regionKey || !cityKey) return '';
    const districts = somaliAdministrativeHierarchy[regionKey]?.cities?.[cityKey]?.districts || {};
    const matchedKey = findKeyByAlias(districts, selectedValue);
    Object.keys(districts).forEach(key => {
        const district = districts[key];
        DOM.regDistrict.add(new Option(district.displayName, key));
    });
    if (matchedKey) {
        DOM.regDistrict.value = matchedKey;
    }
    return DOM.regDistrict.value;
}

function populateNeighborhoods(regionKey, cityKey, districtKey) {
    DOM.regNeighborhood.innerHTML = '<option value="">Select Neighborhood (Optional)</option>';
    if (!regionKey || !cityKey || !districtKey) {
        DOM.regNeighborhood.add(new Option("Other...", "Other"));
        return;
    };
    const neighborhoods = somaliAdministrativeHierarchy[regionKey]?.cities?.[cityKey]?.districts?.[districtKey]?.neighborhoods || [];
    neighborhoods.forEach(n => DOM.regNeighborhood.add(new Option(n, n)));
    DOM.regNeighborhood.add(new Option("Other...", "Other"));
}

function getReverseGeocode(latLng) { return new Promise((resolve, reject) => geocoder.geocode({ location: latLng }, (results, status) => (status === 'OK' && results[0]) ? resolve(results[0].address_components) : reject(new Error(status)))); }
function getPlaceDetails(latLng) { return new Promise((resolve) => placesService.nearbySearch({ location: latLng, rankBy: google.maps.places.RankBy.DISTANCE, type: 'sublocality' }, (results, status) => resolve((status === 'OK' && results[0]) ? results[0] : null))); }
function parseAddressComponents(geo, place) { const get = (t) => { const c = geo.find(c => c.types.includes(t)); return c ? c.long_name : null; }; let district = (place && place.name && !place.types.includes('route')) ? place.name : (get('sublocality_level_1') || get('locality') || get('administrative_area_level_2') || 'Unknown District'); const region = get('administrative_area_level_1') || 'Unknown Region'; const city = get('locality') || get('administrative_area_level_2') || region; return { district, region, city }; }
function switchInfoPanelView(viewName) { ['initial', 'loading', 'address'].forEach(v => DOM[`infoPanel${v.charAt(0).toUpperCase() + v.slice(1)}`].classList.toggle('active', v === viewName)); }
function updateInfoPanel(data) { DOM.codeDisplay.textContent = data.sixDCode; DOM.locationText.textContent = `${data.district}, ${data.region} ${data.localitySuffix}`; }
function animateToLocation(map, latLng, onComplete) { map.setZoom(12); google.maps.event.addListenerOnce(map, 'idle', () => { map.panTo(latLng); google.maps.event.addListenerOnce(map, 'idle', () => { map.setZoom(18); if (onComplete) google.maps.event.addListenerOnce(map, 'idle', () => onComplete(latLng)); }); }); }

document.addEventListener('DOMContentLoaded', init);