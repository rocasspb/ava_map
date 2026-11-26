import { WasmLoader } from '../services/WasmLoader';

export type ElevationQuery = (point: [number, number]) => number | null;

/**
 * Calculates both aspect and slope for a given point using KMP Wasm logic.
 */
export async function calculateTerrainMetrics(
    point: [number, number],
    queryElevation: ElevationQuery
): Promise<{ slope: number, aspect: string } | null> {
    const wasm = await WasmLoader.getInstance();
    
    if (wasm.calculateTerrainMetricsWasm) {
        // Prepare a bridge for the elevation provider
        const elevationProviderJs = (lng: number, lat: number): number => {
            const elev = queryElevation([lng, lat]);
            return elev === null ? -1000000 : elev;
        };
        
        const result: string = wasm.calculateTerrainMetricsWasm(point[0], point[1], elevationProviderJs);
        if (result === "") return null;
        
        const [slopeStr, aspect] = result.split(',');
        return { slope: parseFloat(slopeStr), aspect };
    }
    
    // Fallback or handle missing Wasm
    return null;
}
