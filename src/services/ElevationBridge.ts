import type { ElevationQuery } from '../utils/geo-utils';

/**
 * Bridges the TypeScript ElevationQuery to a Wasm-compatible elevation provider.
 * KMP/Wasm expects (lng, lat) -> Int, using -1000000 for null.
 */
export function bridgeElevationQuery(query: ElevationQuery): (lng: number, lat: number) => number {
    return (lng: number, lat: number) => {
        const elev = query([lng, lat]);
        // Return a magic number -1000000 to represent null in Wasm, as Wasm/JS bridge
        // for primitive types often handles nulls as 0 or requires special handling.
        return elev === null ? -1000000 : Math.round(elev);
    };
}
