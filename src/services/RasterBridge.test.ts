import { describe, it, expect, vi } from 'vitest';
import { RasterBridge } from './RasterBridge';
import { WasmLoader } from './WasmLoader';

vi.mock('./WasmLoader', () => ({
    WasmLoader: {
        getInstance: vi.fn()
    }
}));

describe('RasterBridge', () => {
    it('should correctly call wasm and parse result', async () => {
        const mockGenerateRasterWasm = vi.fn().mockReturnValue("2,2,255,0,0,255");
        (WasmLoader.getInstance as any).mockResolvedValue({
            generateRasterWasm: mockGenerateRasterWasm
        });

        const result = await RasterBridge.generateRaster([], { minLng: 10, maxLng: 11, minLat: 45, maxLat: 46 }, () => 1000);

        expect(result).toEqual({
            width: 2,
            height: 2,
            pixels: new Int32Array([255, 0, 0, 255])
        });
        expect(mockGenerateRasterWasm).toHaveBeenCalled();
    });

    it('should return null if wasm returns ERROR', async () => {
        (WasmLoader.getInstance as any).mockResolvedValue({
            generateRasterWasm: vi.fn().mockReturnValue("ERROR")
        });

        const result = await RasterBridge.generateRaster([], { minLng: 10, maxLng: 11, minLat: 45, maxLat: 46 }, () => 1000);
        expect(result).toBeNull();
    });

    it('should handle elevation provider callback', async () => {
        let capturedCallback: any;
        const mockGenerateRasterWasm = vi.fn((_rules, _minLng, _maxLngg, _minLat, _maxLat, callback) => {
            capturedCallback = callback;
            return "1,1,100";
        });
        (WasmLoader.getInstance as any).mockResolvedValue({
            generateRasterWasm: mockGenerateRasterWasm
        });

        const mockElevationProvider = vi.fn().mockReturnValue(2500.5);
        
        await RasterBridge.generateRaster([], { minLng: 10, maxLng: 11, minLat: 45, maxLat: 46 }, mockElevationProvider);
        
        expect(capturedCallback).toBeDefined();
        const resultElev = capturedCallback(10.5, 45.5);
        expect(resultElev).toBe(2501); // Rounded 2500.5
        expect(mockElevationProvider).toHaveBeenCalledWith(10.5, 45.5);

        // Test null elevation
        mockElevationProvider.mockReturnValue(null);
        const resultNull = capturedCallback(0, 0);
        expect(resultNull).toBe(-1000000);
    });
});
