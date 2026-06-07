import type { CaamlData, DangerRating, AvalancheProblem } from '../types/avalanche';
import { DEFAULT_MAX_ELEVATION, DANGER_LEVEL_VALUES, TREELINE_ELEVATION, MODES, EUREGIO_BOUNDS, STEEPNESS_THRESHOLDS } from '../config';
import type { VisualizationMode } from '../config';
import { getBounds } from './geometry';
import { adjustElevationForTreeline, getDangerColor } from './map-helpers';
import type { GenerationRule } from '../types/GenerationRule';

export interface RegionDanger {
    regionID: string;
    dangerRating: DangerRating;
}

export interface ElevationBand {
    regionID: string;
    dangerLevel: string;
    minElev: number;
    maxElev: number;
    validAspects?: string[];
    avalancheProblems: AvalancheProblem[];
    bulletinText: string;
}

export function processAvalancheData(data: CaamlData): Map<string, DangerRating> {
    const regionDangerMap = new Map<string, DangerRating>();

    const bulletins = data.bulletins || [];
    
    // Process all bulletins
    bulletins.forEach(b => {
        const danger = getMaxDanger(b.dangerRatings);
        if (danger) {
            b.regions.forEach(r => {
                regionDangerMap.set(r.regionID, danger);
            });
        }
    });

    return regionDangerMap;
}

export function processRegionElevations(data: CaamlData): ElevationBand[] {
    const bands: ElevationBand[] = [];
    const bulletins = data.bulletins || [];

    bulletins.forEach(bulletin => {
        let bulletinText = "";
        if (bulletin.avalancheActivity) {
            const parts = [];
            if (bulletin.avalancheActivity.highlights) parts.push(bulletin.avalancheActivity.highlights);
            if (bulletin.avalancheActivity.comment) parts.push(bulletin.avalancheActivity.comment);
            bulletinText = parts.join('\n\n');
        }

        // If there are specific avalanche problems, they often define the elevation
        if (bulletin.avalancheProblems && bulletin.avalancheProblems.length > 0) {
            bulletin.regions.forEach(region => {
                // Find the highest danger rating for this region (or global to bulletin)
                const maxDanger = getMaxDanger(bulletin.dangerRatings);
                if (!maxDanger) return;

                // Check if problems have elevation info
                bulletin.dangerRatings.forEach(rating => {
                    var { min: rMin, max: rMax } = parseElevations(rating.elevation);

                    // Find matching problems based on elevation overlap
                    let aspects: string[] | undefined = undefined;
                    const matchingProblems = bulletin.avalancheProblems.filter(p => {
                        const { min: pMin, max: pMax } = parseElevations(p.elevation);
                        // Check overlap
                        return (rMin < pMax && rMax > pMin);
                    });

                    if (matchingProblems.length > 0) {
                        // Collect unique aspects and elevation bands from all matching problems
                        const aspectSet = new Set<string>();
                        var minElev = rMax; //here it is reversed to find the intersection
                        var maxElev = rMin;
                        matchingProblems.forEach(p => {
                            p.aspects.forEach(a => aspectSet.add(a));
                            const { min: pMin, max: pMax } = parseElevations(p.elevation);
                            minElev = Math.min(minElev, pMin);
                            maxElev = Math.max(maxElev, pMax);
                        });
                        rMin = minElev;
                        rMax = maxElev;
                        aspects = Array.from(aspectSet);
                    }

                    bands.push({
                        regionID: region.regionID,
                        dangerLevel: rating.mainValue,
                        minElev: rMin,
                        maxElev: rMax,
                        validAspects: aspects,
                        avalancheProblems: matchingProblems,
                        bulletinText: bulletinText
                    });
                });
            });
        } else {
            // Fallback if no problems/ratings with specific elevation: apply to all
            const maxDanger = getMaxDanger(bulletin.dangerRatings);
            if (maxDanger) {
                bulletin.regions.forEach(region => {
                    bands.push({
                        regionID: region.regionID,
                        dangerLevel: maxDanger.mainValue,
                        minElev: 0,
                        maxElev: DEFAULT_MAX_ELEVATION,
                        validAspects: undefined,
                        avalancheProblems: [],
                        bulletinText: bulletinText
                    });
                });
            }
        }
    });

    return bands;
}

/**
 * Normalizes GeoJSON geometry to MultiPolygon format for KMP compatibility.
 */
function normalizeGeometry(geometry: any) {
    if (!geometry) return null;
    if (geometry.type === 'Polygon') {
        return {
            type: 'MultiPolygon',
            coordinates: [geometry.coordinates]
        };
    }
    return geometry;
}

/**
 * Creates a list of GenerationRules from CAAML data and regions GeoJSON.
 */
export function createGenerationRules(
    data: CaamlData,
    regionsGeoJSON: any,
    mode: VisualizationMode,
    customParams?: { min: number, max: number, aspects: string[], minSlope: number }
): GenerationRule[] {
    if (mode === MODES.CLEAN) return [];

    if (mode === MODES.CUSTOM) {
        const { min, max, aspects, minSlope } = customParams || {
            min: DEFAULT_MAX_ELEVATION,
            max: DEFAULT_MAX_ELEVATION,
            aspects: [],
            minSlope: 0
        };

        return STEEPNESS_THRESHOLDS.filter(t => t.minSlope >= minSlope).map(t => ({
            bounds: EUREGIO_BOUNDS,
            minElev: min,
            maxElev: max,
            minSlope: t.minSlope,
            validAspects: aspects,
            color: t.color,
            properties: { steepness: t.label }
        }));
    }

    const elevationBands = processRegionElevations(data);
    const regionsMap = new Map<string, any>();
    if (regionsGeoJSON.features) {
        regionsGeoJSON.features.forEach((f: any) => {
            regionsMap.set(f.properties.id, f);
        });
    }

    const rules: GenerationRule[] = [];

    for (const band of elevationBands) {
        const regionFeature = regionsMap.get(band.regionID);
        if (!regionFeature) continue;

        const regionBounds = getBounds(regionFeature);
        const color = getDangerColor(band.dangerLevel);
        const useAspectAndElevation = mode === MODES.RISK;

        const { min: ruleMinElev, max: ruleMaxElev } = adjustElevationForTreeline(
            band.minElev,
            band.maxElev,
            band.avalancheProblems
        );

        rules.push({
            bounds: regionBounds,
            geometry: normalizeGeometry(regionFeature.geometry),
            minElev: ruleMinElev,
            maxElev: ruleMaxElev,
            minSlope: mode === MODES.BULLETIN ? undefined : 30,
            validAspects: useAspectAndElevation ? band.validAspects : undefined,
            applySteepnessLogic: useAspectAndElevation,
            color: color,
            properties: {
                regionId: band.regionID,
                dangerLevel: band.dangerLevel,
                avalancheProblems: band.avalancheProblems,
                bulletinText: band.bulletinText
            }
        });
    }

    rules.sort((a, b) => {
        const levelA = a.properties.dangerLevel ? DANGER_LEVEL_VALUES[a.properties.dangerLevel] || 0 : 0;
        const levelB = b.properties.dangerLevel ? DANGER_LEVEL_VALUES[b.properties.dangerLevel] || 0 : 0;
        return levelA - levelB;
    });

    return rules;
}

function parseElevation(bound?: string, isMax: boolean = false): number {
    var elev = isMax ? DEFAULT_MAX_ELEVATION : 0;
    if (bound) {
        elev = parseInt(bound, 10);
        if (isNaN(elev)) {
            if (bound.toLowerCase() === 'treeline') {
                elev = TREELINE_ELEVATION;
            } else elev = isMax ? DEFAULT_MAX_ELEVATION : 0;
        }
    }
    return elev;
}

function parseElevations(elevation: { lowerBound?: string; upperBound?: string } | undefined): { min: number, max: number } {
    let min = 0;
    let max = DEFAULT_MAX_ELEVATION;

    if (!elevation) return { min, max };
    min = parseElevation(elevation.lowerBound);
    max = parseElevation(elevation.upperBound, true);
    return { min, max };
}

function getMaxDanger(ratings: DangerRating[]): DangerRating | null {
    if (!ratings || ratings.length === 0) return null;

    const dangerLevels = DANGER_LEVEL_VALUES;

    let maxRating = ratings[0];
    let maxLevel = dangerLevels[maxRating.mainValue] || 0;

    for (const rating of ratings) {
        const level = dangerLevels[rating.mainValue] || 0;
        if (level > maxLevel) {
            maxLevel = level;
            maxRating = rating;
        }
    }

    return maxRating;
}
