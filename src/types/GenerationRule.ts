export interface GenerationRule {
    bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number };
    geometry?: any;
    minElev: number;
    maxElev: number;
    minSlope?: number;
    applySteepnessLogic?: boolean;
    validAspects?: string[];
    color: string;
    properties: {
        regionId?: string;
        dangerLevel?: string;
        steepness?: string;
        avalancheProblems?: any[];
        bulletinText?: string;
    };
}
