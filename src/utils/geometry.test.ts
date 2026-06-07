import { describe, it, expect, vi } from 'vitest';
import { isPointInPolygon, isPointInMultiPolygon, getBounds } from './geometry';
import { WasmLoader } from '../services/WasmLoader';

vi.mock('../services/WasmLoader', () => ({
    WasmLoader: {
        getInstance: vi.fn()
    }
}));

describe('geometry utils', () => {
    it('isPointInPolygon should call wasm', async () => {
        const mockIsPointInPolygonWasm = vi.fn().mockReturnValue(true);
        (WasmLoader.getInstance as any).mockResolvedValue({
            isPointInPolygonWasm: mockIsPointInPolygonWasm
        });

        const polygon = [[[10, 45], [11, 45], [11, 46], [10, 46], [10, 45]]];
        const result = await isPointInPolygon([10.5, 45.5], polygon);
        
        expect(result).toBe(true);
        expect(mockIsPointInPolygonWasm).toHaveBeenCalledWith(10.5, 45.5, JSON.stringify(polygon));
    });

    it('isPointInMultiPolygon should call wasm for each polygon until true', async () => {
        const mockIsPointInPolygonWasm = vi.fn()
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);
        (WasmLoader.getInstance as any).mockResolvedValue({
            isPointInPolygonWasm: mockIsPointInPolygonWasm
        });

        const multiPoly = [
            [[[0,0], [1,0], [1,1], [0,1], [0,0]]],
            [[[10,10], [11,10], [11,11], [10,11], [10,10]]]
        ];

        const result = await isPointInMultiPolygon([10.5, 10.5], multiPoly);
        expect(result).toBe(true);
        expect(mockIsPointInPolygonWasm).toHaveBeenCalledTimes(2);
    });

    it('getBounds should correctly calculate bounds for Polygon', () => {
        const feature = {
            geometry: {
                type: 'Polygon',
                coordinates: [[[10, 45], [12, 45], [12, 47], [10, 47], [10, 45]]]
            }
        };
        const bounds = getBounds(feature);
        expect(bounds).toEqual({
            minLng: 10,
            maxLng: 12,
            minLat: 45,
            maxLat: 47
        });
    });

    it('getBounds should correctly calculate bounds for MultiPolygon', () => {
        const feature = {
            geometry: {
                type: 'MultiPolygon',
                coordinates: [
                    [[[10, 45], [11, 45], [11, 46], [10, 46], [10, 45]]],
                    [[[20, 50], [21, 50], [21, 51], [20, 51], [20, 50]]]
                ]
            }
        };
        const bounds = getBounds(feature);
        expect(bounds).toEqual({
            minLng: 10,
            maxLng: 21,
            minLat: 45,
            maxLat: 51
        });
    });
});
