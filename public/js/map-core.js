/**
 * Generates a 6D Code and Locality Suffix from coordinates.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @returns {{sixDCode: string, localitySuffix: string}}
 */
export function generate6DCode(lat, lon) {
    const absLat = Math.abs(lat);
    const absLon = Math.abs(lon);
    const lat_d1 = Math.floor(absLat * 10) % 10;
    const lat_d2 = Math.floor(absLat * 100) % 10;
    const lat_d3 = Math.floor(absLat * 1000) % 10;
    const lat_d4 = Math.floor(absLat * 10000) % 10;
    const lon_d1 = Math.floor(absLon * 10) % 10;
    const lon_d2 = Math.floor(absLon * 100) % 10;
    const lon_d3 = Math.floor(absLon * 1000) % 10;
    const lon_d4 = Math.floor(absLon * 10000) % 10;
    const sixDCode = `${lat_d2}${lon_d2}-${lat_d3}${lon_d3}-${lat_d4}${lon_d4}`;
    const localitySuffix = `${lat_d1}${lon_d1}`;
    return { sixDCode, localitySuffix };
}

/**
 * Draws the three colored, concentric 6D boxes on the map.
 * @param {google.maps.Map} map The map instance.
 * @param {google.maps.LatLng} latLng The selected location.
 * @param {Array} drawnObjectsRef A reference to an array to store drawn objects.
 */
export function drawAddressBoxes(map, latLng, drawnObjectsRef) {
    // Clear any previously drawn boxes
    drawnObjectsRef.forEach(obj => obj.setMap(null));
    drawnObjectsRef.length = 0;

    const lat = latLng.lat();
    const lon = latLng.lng();
    const boxStyles = {
        '6d': { color: '#1976D2', zIndex: 3, scale: 10000, fillOpacity: 0.15 }, // Blue
        '4d': { color: '#388E3C', zIndex: 2, scale: 1000, fillOpacity: 0.0 },  // Green
        '2d': { color: '#D32F2F', zIndex: 1, scale: 100, fillOpacity: 0.0 }   // Red
    };

    for (const key in boxStyles) {
        const style = boxStyles[key];
        const scale = style.scale;
        const cellSize = 1 / scale;
        const swLat = Math.floor(lat * scale) / scale;
        const swLng = Math.floor(lon * scale) / scale;
        const bounds = { south: swLat, west: swLng, north: swLat + cellSize, east: swLng + cellSize };
        
        const rect = new google.maps.Rectangle({
            strokeColor: style.color, strokeWeight: 2, strokeOpacity: 0.8,
            fillColor: style.color, fillOpacity: style.fillOpacity,
            map: map, bounds: bounds, zIndex: style.zIndex, clickable: false
        });
        drawnObjectsRef.push(rect);
    }
}