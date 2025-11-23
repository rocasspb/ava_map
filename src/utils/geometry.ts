export interface Point {
    x: number;
    y: number;
}

/**
 * Checks if a point is inside a polygon using the Ray Casting algorithm.
 * @param point The point to check [longitude, latitude]
 * @param polygon The polygon coordinates (GeoJSON format: array of rings, where each ring is an array of [lng, lat])
 * @returns true if the point is inside the polygon
 */
export function isPointInPolygon(point: [number, number], polygon: number[][][]): boolean {
    const x = point[0];
    const y = point[1];
    let inside = false;

    // Iterate through each ring (outer and holes)
    // For standard GeoJSON Polygons, the first ring is the outer boundary, subsequent rings are holes.
    // However, a simple ray casting works for the outer boundary. Handling holes requires checking if it's inside the outer AND NOT inside any hole.
    // For this specific visualization use case, checking the outer boundary is often sufficient or we can iterate all.
    // Let's implement standard even-odd rule which naturally handles holes if processed correctly as a single set of edges.

    for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }
    }

    return inside;
}

/**
 * Checks if a point is inside a MultiPolygon.
 * @param point The point to check [longitude, latitude]
 * @param multiPolygon The MultiPolygon coordinates
 */
export function isPointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
    for (const polygon of multiPolygon) {
        if (isPointInPolygon(point, polygon)) {
            return true;
        }
    }
    return false;
}

export function getBounds(feature: any) {
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;

    const processRing = (ring: number[][]) => {
        ring.forEach(coord => {
            const [lng, lat] = coord;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });
    };

    if (feature.geometry.type === 'Polygon') {
        processRing(feature.geometry.coordinates[0]);
    } else if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach((poly: any) => processRing(poly[0]));
    }

    return { minLng, maxLng, minLat, maxLat };
}
