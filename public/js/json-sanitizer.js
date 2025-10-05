/**
 * This module provides a "clean room" implementation of JSON.parse.
 * It is a defense against the global JSON object being polluted by a
 * transitive dependency, which is the suspected root cause of a deep,
 * persistent bug with the Google Maps API.
 */

let pristineJsonParse;

/**
 * Initializes the module by creating a temporary iframe to capture the
 * original, unpolluted JSON.parse method.
 */
function initialize() {
    try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        // Capture the pristine JSON.parse method from the iframe's contentWindow
        pristineJsonParse = iframe.contentWindow.JSON.parse;
        
        // Clean up the iframe from the DOM
        document.body.removeChild(iframe);

        if (typeof pristineJsonParse !== 'function') {
            throw new Error("Failed to capture pristine JSON.parse.");
        }
        console.log("JSON sanitizer initialized successfully.");
    } catch (error) {
        console.error("Could not initialize JSON sanitizer. Falling back to global JSON.parse.", error);
        // Fallback to the potentially polluted global method if the iframe trick fails
        pristineJsonParse = JSON.parse;
    }
}

/**
 * Parses a JSON string using the pristine, unpolluted JSON.parse method.
 * @param {string} text The JSON string to parse.
 * @returns {object} The parsed object.
 */
export function safeJsonParse(text) {
    if (!pristineJsonParse) {
        // Initialize on first use if not already initialized
        initialize();
    }
    return pristineJsonParse(text);
}

// Initialize the module as soon as it's loaded.
initialize();
