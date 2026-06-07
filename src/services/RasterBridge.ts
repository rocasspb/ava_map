import { WasmLoader } from '../services/WasmLoader';
import type { GenerationRule } from '../types/GenerationRule';

/**
 * Adapter to call KMP RasterGenerator from the web app.
 */
export class RasterBridge {
    /**
     * Calls generateRasterWasm and returns the pixels and dimensions.
     */
    static async generateRaster(
        rules: GenerationRule[],
        bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number },
        elevationProvider: (lng: number, lat: number) => number | null
    ): Promise<{ width: number, height: number, pixels: Int32Array } | null> {
        const wasm = await WasmLoader.getInstance();
        
        if (!wasm.generateRasterWasm) {
            throw new Error("generateRasterWasm not exported from KMP module");
        }
        
        const elevationProviderJs = (lng: number, lat: number): number => {
            const elev = elevationProvider(lng, lat);
            // Return -1000000 to represent null in Wasm
            return elev === null ? -1000000 : Math.round(elev);
        };
        
        // Serialize rules to JSON for the Wasm bridge
        const rulesJson = JSON.stringify(rules);
        
        const result: string = wasm.generateRasterWasm(
            rulesJson,
            bounds.minLng, bounds.maxLng, bounds.minLat, bounds.maxLat,
            elevationProviderJs
        );
        
        if (result === "ERROR" || !result) return null;
        
        // The result is a comma-separated string: "width,height,pixel1,pixel2,..."
        const parts = result.split(',');
        const width = parseInt(parts[0], 10);
        const height = parseInt(parts[1], 10);
        
        const pixels = new Int32Array(width * height);
        for (let i = 0; i < pixels.length; i++) {
            pixels[i] = parseInt(parts[i + 2], 10);
        }
        
        return { width, height, pixels };
    }
}
