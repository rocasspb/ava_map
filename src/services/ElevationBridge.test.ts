import { describe, it, expect, vi } from 'vitest';
import { bridgeElevationQuery } from './ElevationBridge';
import type { ElevationQuery } from '../utils/geo-utils';

describe('ElevationBridge', () => {
    it('should correctly bridge elevation query', () => {
        const mockQuery: ElevationQuery = vi.fn((point: [number, number]) => {
            if (point[0] === 11 && point[1] === 47) return 2500.5;
            return null;
        });

        const bridged = bridgeElevationQuery(mockQuery);

        expect(bridged(11, 47)).toBe(2501);
        expect(bridged(0, 0)).toBe(-1000000);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});
