'use strict';

import { GOOGLE_MAPS_API_KEY, somaliAdministrativeHierarchy } from './config.js';
import { loadGoogleMapsAPI } from './utils.js';
import * as MapCore from './map-core.js';

// --- State ---
let map, geocoder, placesService;
let drawnMapObjects = [];
let currentAddress = null;

// --- DOM Elements (Updated) ---
const DOM = {
    mapElement: document.getElementById('map'),
    // Info Panel
    infoPanelInitial: document.getElementById('info-panel-initial'),
    infoPanelLoading: document.getElementById('info-panel-loading'),
    infoPanelAddress: document.getElementById('info-panel-address'),
    findMyLocationBtn: document.getElementById('find-my-location-btn'),
    registerThisAddressBtn: document.getElementById('register-this-address-btn'),
    // New Info Panel Content
    gpsAccuracyDisplay: document.getElementById('gps-accuracy-display'),
    codePillSpans: document.querySelectorAll('.code-pill span'),
    addressDistrict: document.getElementById('address-district'),
    addressRegion: document.getElementById('address-region'),
    copyBtn: document.getElementById('copy-btn'),
    shareBtn: document.getElementById('share-btn'),
    recenterBtn: document.getElementById('recenter-btn'),
    // Bottom Sheet
    bottomSheetOverlay: document.getElementById('bottom-sheet-overlay'),
    bottomSheetModal: document.getElementById('bottom-sheet-modal'),
    closeSheetBtn: document.getElementById('close-sheet-btn'),
    // ... (rest of form selectors)
};

async function init() { /* ... unchanged ... */ }

function addEventListeners() {
    map.addListener('click', (e) => processLocation(e.latLng));
    map.addListener('dragend', () => {
        if (currentAddress) DOM.recenterBtn.classList.remove('hidden');
    });
    DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
    DOM.registerThisAddressBtn.addEventListener('click', handleShowRegistrationSheet);
    DOM.closeSheetBtn.addEventListener('click', closeRegistrationSheet);
    DOM.bottomSheetOverlay.addEventListener('click', closeRegistrationSheet);
    // New Action Button Listeners
    DOM.copyBtn.addEventListener('click', handleCopyAddress);
    DOM.shareBtn.addEventListener('click', handleShareAddress);
    DOM.recenterBtn.addEventListener('click', handleRecenterMap);
    // ... (rest of form listeners)
}

function handleFindMyLocation() {
    if (!navigator.geolocation) return alert("Geolocation is not supported.");
    switchInfoPanelView('loading');
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
            const accuracy = position.coords.accuracy; // Get accuracy
            animateToLocation(map, latLng, (finalLatLng) => processLocation(finalLatLng, accuracy));
        },
        () => { /* ... error handling ... */ }
    );
}

async function processLocation(latLng, accuracy = null) {
    switchInfoPanelView('loading');
    DOM.recenterBtn.classList.add('hidden'); // Hide recenter on new selection
    
    const { sixDCode, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    MapCore.drawAddressBoxes(map, latLng, drawnMapObjects);
    
    try {
        const [geo, place] = await Promise.all([getReverseGeocode(latLng), getPlaceDetails(latLng)]);
        const finalAddress = parseAddressComponents(geo, place);
        currentAddress = { sixDCode, localitySuffix, lat: latLng.lat(), lng: latLng.lng(), ...finalAddress };
        
        updateInfoPanel(currentAddress, accuracy); // Pass accuracy to update function
        switchInfoPanelView('address');
    } catch (error) { /* ... error handling ... */ }
}

/** REFACTORED: updateInfoPanel now handles the new structure and accuracy */
function updateInfoPanel(data, accuracy) {
    // 1. Populate the 6D Code Pill
    const codeParts = data.sixDCode.split('-');
    if (DOM.codePillSpans.length === 3) {
        DOM.codePillSpans[0].textContent = codeParts[0]; // Red
        DOM.codePillSpans[1].textContent = codeParts[1]; // Green
        DOM.codePillSpans[2].textContent = codeParts[2]; // Blue
    }

    // 2. Populate the address text
    DOM.addressDistrict.textContent = data.district || '';
    DOM.addressRegion.textContent = `${data.region || ''} ${data.localitySuffix || ''}`.trim();

    // 3. Handle the GPS accuracy display
    if (accuracy) {
        DOM.gpsAccuracyDisplay.textContent = `Location accuracy: ±${Math.round(accuracy)}m`;
        DOM.gpsAccuracyDisplay.classList.remove('hidden');
    } else {
        DOM.gpsAccuracyDisplay.classList.add('hidden');
    }
}

// --- NEW ACTION HANDLERS ---
function handleCopyAddress() {
    if (!currentAddress) return;
    const addressString = `${currentAddress.sixDCode}\n${currentAddress.district}, ${currentAddress.region} ${currentAddress.localitySuffix}`;
    navigator.clipboard.writeText(addressString).then(() => {
        alert("Address copied to clipboard!"); // Replace with a better notification later
    });
}

function handleShareAddress() {
    if (!currentAddress || !navigator.share) return;
    const addressString = `${currentAddress.sixDCode}, ${currentAddress.district}, ${currentAddress.region} ${currentAddress.localitySuffix}`;
    navigator.share({
        title: '6D Address',
        text: `My 6D Address is: ${addressString}`,
        url: window.location.href,
    });
}

function handleRecenterMap() {
    if (!currentAddress) return;
    map.panTo({ lat: currentAddress.lat, lng: currentAddress.lng });
    DOM.recenterBtn.classList.add('hidden');
}

// --- All other functions (init, geocoding, form population, etc.) remain the same ---
// ... (paste the rest of your working main.js functions here)

document.addEventListener('DOMContentLoaded', init);
