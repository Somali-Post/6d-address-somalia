/**
 * Dynamically loads the Google Maps JavaScript API script.
 * This modern approach uses a Promise and avoids global callbacks.
 * @param {string} apiKey Your Google Maps API key.
 * @returns {Promise<void>} A promise that resolves when the API is ready.
 */
export function loadGoogleMapsAPI(apiKey) {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            // API is already loaded
            return resolve();
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google Maps script failed to load.'));

        document.head.appendChild(script);
    });
}