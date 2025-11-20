import type { CaamlData, DangerRating } from '../types/avalanche';

export interface RegionDanger {
    regionID: string;
    dangerRating: DangerRating;
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

function getMaxDanger(ratings: DangerRating[]): DangerRating | null {
    if (!ratings || ratings.length === 0) return null;

    // Map danger strings to numbers for comparison
    const dangerLevels: Record<string, number> = {
        'low': 1,
        'moderate': 2,
        'considerable': 3,
        'high': 4,
        'very_high': 5
    };

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
