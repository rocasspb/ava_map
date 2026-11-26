import { WasmLoader } from '../services/WasmLoader';

export interface Point {
    x: number;
    y: number;
}

/**
 * Checks if a point is inside a polygon using KMP Wasm logic.
 */
export async function isPointInPolygon(point: [number, number], polygon: number[][][]): Promise<boolean> {
    const wasm = await WasmLoader.getInstance();
    if (wasm && wasm.isPointInPolygonWasm) {
        return wasm.isPointInPolygonWasm(point[0], point[1], JSON.stringify(polygon));
    }
    return false;
}

/**
 * Checks if a point is inside a MultiPolygon using KMP Wasm logic.
 */
export async function isPointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): Promise<boolean> {
    const wasm = await WasmLoader.getInstance();
    if (wasm && wasm.isPointInPolygonWasm) {
        for (const polygon of multiPolygon) {
            if (wasm.isPointInPolygonWasm(point[0], point[1], JSON.stringify(polygon))) {
                return true;
            }
        }
        return false;
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
