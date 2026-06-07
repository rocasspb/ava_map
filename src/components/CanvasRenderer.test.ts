import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasRenderer } from './CanvasRenderer';
import { RasterBridge } from '../services/RasterBridge';
import * as maptiler from '@maptiler/sdk';

vi.mock('@maptiler/sdk', () => ({
    Map: class {
        getBounds() {
            return {
                getNorth: () => 48,
                getSouth: () => 47,
                getEast: () => 12,
                getWest: () => 11
            };
        }
        getZoom() { return 10; }
    },
    MapStyle: {
        HYBRID: 'hybrid'
    }
}));

vi.mock('../services/RasterBridge', () => ({
    RasterBridge: {
        generateRaster: vi.fn()
    }
}));

describe('CanvasRenderer', () => {
    let renderer: CanvasRenderer;
    let mockMap: any;
    let mockCanvas: any;
    let mockTerrainProvider: any;

    beforeEach(() => {
        mockMap = new maptiler.Map({} as any);
        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => ({
                clearRect: vi.fn(),
                createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100 * 100 * 4) })),
                putImageData: vi.fn()
            }))
        };
        mockTerrainProvider = {
            fetchTiles: vi.fn().mockResolvedValue(undefined),
            getElevation: vi.fn().mockReturnValue(2000)
        };
        renderer = new CanvasRenderer(mockMap, mockCanvas as any, mockTerrainProvider as any);
    });

    it('should call RasterBridge and update canvas', async () => {
        (RasterBridge.generateRaster as any).mockResolvedValue({
            width: 100,
            height: 100,
            pixels: new Int32Array(100 * 100).fill(0xFF00FF00) // Green
        });

        const result = await renderer.draw([]);

        expect(RasterBridge.generateRaster).toHaveBeenCalled();
        expect(mockCanvas.width).toBe(100);
        expect(mockCanvas.height).toBe(100);
        expect(result).not.toBeNull();
        expect(result?.coordinates).toBeDefined();
    });
});
