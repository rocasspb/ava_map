import { describe, it, expect } from 'vitest';
import { processRegionElevations, createGenerationRules } from './data-processing';
import type { CaamlData } from '../types/avalanche';
import { MODES } from '../config';

describe('data-processing', () => {
    const mockCaamlData: CaamlData = {
        bulletins: [
            {
                publicationTime: "2026-05-14T08:00:00Z",
                validTime: { startTime: "2026-05-14T08:00:00Z", endTime: "2026-05-15T08:00:00Z" },
                regions: [{ name: "Test Region", regionID: "REG-1" }],
                dangerRatings: [
                    { mainValue: "considerable", elevation: { lowerBound: "2000", upperBound: "DEFAULT" }, validTimePeriod: "24h" }
                ],
                avalancheProblems: [
                    {
                        problemType: "Wind Slab",
                        elevation: { lowerBound: "2000" },
                        validTimePeriod: "24h",
                        snowpackStability: "Poor",
                        frequency: "Frequent",
                        avalancheSize: 2,
                        aspects: ["N", "NE"]
                    }
                ],
                snowpackStructure: { comment: "Test snowpack" },
                tendency: [],
                lang: "en"
            }
        ]
    };

    const mockGeoJSON = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: { id: "REG-1" },
                geometry: {
                    type: "Polygon",
                    coordinates: [[[11, 47], [12, 47], [12, 48], [11, 48], [11, 47]]]
                }
            }
        ]
    };

    it('should process region elevations correctly', () => {
        const bands = processRegionElevations(mockCaamlData);
        expect(bands.length).toBeGreaterThan(0);
        expect(bands[0].regionID).toBe('REG-1');
        expect(bands[0].dangerLevel).toBe('considerable');
        expect(bands[0].minElev).toBe(2000);
    });

    it('should create generation rules correctly for BULLETIN mode', () => {
        const rules = createGenerationRules(mockCaamlData, mockGeoJSON, MODES.BULLETIN);
        expect(rules.length).toBe(1);
        expect(rules[0].properties.regionId).toBe('REG-1');
        expect(rules[0].minElev).toBe(2000);
        expect(rules[0].applySteepnessLogic).toBe(false);
    });

    it('should create generation rules correctly for RISK mode', () => {
        const rules = createGenerationRules(mockCaamlData, mockGeoJSON, MODES.RISK);
        expect(rules.length).toBe(1);
        expect(rules[0].applySteepnessLogic).toBe(true);
        expect(rules[0].validAspects).toContain('N');
    });
});
