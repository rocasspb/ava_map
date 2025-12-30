import * as config from '../config';
import type {AvalancheProblem} from '../types/avalanche';

export function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function adjustElevationForTreeline(currentMin: number, currentMax: number, problems: AvalancheProblem[]): { min: number, max: number } {
    let min = currentMin;
    let max = currentMax;

    if (problems && problems.length > 0) {
        problems.forEach(p => {
            if (p.elevation) {
                if (p.elevation.lowerBound && String(p.elevation.lowerBound).toLowerCase() === 'treeline') {
                    min = Math.max(min, config.TREELINE_ELEVATION);
                }
                if (p.elevation.upperBound && String(p.elevation.upperBound).toLowerCase() === 'treeline') {
                    max = Math.min(max, config.TREELINE_ELEVATION);
                }
            }
        });
    }
    return { min, max };
}

export function getDangerColor(level: string): string {
    return config.DANGER_COLORS[level] || config.DANGER_COLORS['default'];
}
