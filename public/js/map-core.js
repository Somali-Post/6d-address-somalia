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

/**
 * CRITICAL FIX: This function was missing.
 * Draws a dynamic grid on the map that adapts to the zoom level.
 * @param {google.maps.Map} map The map instance.
 * @param {Array} gridLinesRef A reference to an array to store drawn grid lines.
 */
export function updateDynamicGrid(map, gridLinesRef) {
    // Clear any previously drawn grid lines
    gridLinesRef.forEach(line => line.setMap(null));
    gridLinesRef.length = 0;

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    if (!bounds) return;

    let spacing = null;
    if (zoom >= 17) {
        spacing = 0.0001; // 11m grid
    } else if (zoom >= 13) {
        spacing = 0.01; // 1.1km grid
    }

    if (spacing === null) return; // No grid at this zoom level

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const gridStyle = {
    strokeColor: '#000000',    // Black lines work well on both light and dark maps
    strokeOpacity: 0.2,      // Very transparent
    strokeWeight: 0.5,       // Very thin
    clickable: false
};

    // Draw latitude lines
    for (let lat = Math.floor(sw.lat() / spacing) * spacing; lat < ne.lat(); lat += spacing) {
        const line = new google.maps.Polyline({ ...gridStyle, path: [{ lat, lng: sw.lng() }, { lat, lng: ne.lng() }], map });
        gridLinesRef.push(line);
    }

    // Draw longitude lines
    for (let lng = Math.floor(sw.lng() / spacing) * spacing; lng < ne.lng(); lng += spacing) {
        const line = new google.maps.Polyline({ ...gridStyle, path: [{ lat: sw.lat(), lng }, { lat: ne.lat(), lng }], map });
        gridLinesRef.push(line);
    }
}