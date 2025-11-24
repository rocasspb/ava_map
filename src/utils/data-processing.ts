import type { CaamlData, DangerRating, AvalancheProblem } from '../types/avalanche';
import { DEFAULT_MAX_ELEVATION, DANGER_LEVEL_VALUES } from '../config';

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

    // Assuming the first bulletin is the most relevant one for now
    // In a real app, we might handle multiple bulletins or time periods
    const bulletin = data.bulletins[0];

    if (!bulletin) return regionDangerMap;

    // Create a lookup for danger ratings by elevation/validTime if needed
    // For simplicity, we'll take the highest mainValue if multiple exist, or just the first one
    // The structure links regions to the bulletin, and the bulletin has dangerRatings.
    // Wait, the CAAML structure usually links specific danger ratings to specific regions or the whole bulletin applies to listed regions.
    // In the viewed chunk: "regions": [ ... ] is inside the bulletin.
    // And "dangerRatings": [ ... ] is also inside the bulletin.
    // This implies the danger ratings apply to ALL regions in that bulletin.

    // So we just need to get the max danger rating for the bulletin and apply it to all its regions.

    const maxDanger = getMaxDanger(bulletin.dangerRatings);

    if (maxDanger) {
        bulletin.regions.forEach(region => {
            regionDangerMap.set(region.regionID, maxDanger);
        });
    }

    // If there are multiple bulletins, we should process all of them
    data.bulletins.forEach(b => {
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

    data.bulletins.forEach(bulletin => {
        const bulletinText = bulletin.avalancheActivity.highlights || bulletin.avalancheActivity.comment || "";

        // If there are specific avalanche problems, they often define the elevation
        if (bulletin.avalancheProblems && bulletin.avalancheProblems.length > 0) {
            bulletin.regions.forEach(region => {
                // Find the highest danger rating for this region (or global to bulletin)
                const maxDanger = getMaxDanger(bulletin.dangerRatings);
                if (!maxDanger) return;

                // Check if problems have elevation info
                // Note: Problems might have different elevations. 
                // For visualization, we'll try to create bands for each problem that applies.
                // However, usually the DANGER RATING itself has an elevation in the CAAML structure 
                // (see DangerRating interface: it has 'elevation').

                // Let's look at the DangerRatings first as they directly correlate to the color.
                bulletin.dangerRatings.forEach(rating => {
                    const { min: rMin, max: rMax } = parseElevation(rating.elevation);

                    // Find matching problems based on elevation overlap
                    let aspects: string[] | undefined = undefined;
                    const matchingProblems = bulletin.avalancheProblems.filter(p => {
                        const { min: pMin, max: pMax } = parseElevation(p.elevation);
                        // Check overlap
                        return (rMin < pMax && rMax > pMin);
                    });

                    if (matchingProblems.length > 0) {
                        // Collect unique aspects from all matching problems
                        const aspectSet = new Set<string>();
                        matchingProblems.forEach(p => {
                            p.aspects.forEach(a => aspectSet.add(a));
                        });
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

function parseElevation(elevation: { lowerBound?: string; upperBound?: string } | undefined): { min: number, max: number } {
    let min = 0;
    let max = DEFAULT_MAX_ELEVATION; // Default max elevation

    if (!elevation) return { min, max };

    if (elevation.lowerBound) {
        min = parseInt(elevation.lowerBound, 10);
        if (isNaN(min)) min = 0;
    }

    if (elevation.upperBound) {
        max = parseInt(elevation.upperBound, 10);
        if (isNaN(max)) max = DEFAULT_MAX_ELEVATION;
    }

    // Handle cases where bounds might be textual or specific codes if necessary
    // For now, assuming standard CAAML numeric strings

    return { min, max };
}

function getMaxDanger(ratings: DangerRating[]): DangerRating | null {
    if (!ratings || ratings.length === 0) return null;

    // Map danger strings to numbers for comparison
    // Map danger strings to numbers for comparison
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
