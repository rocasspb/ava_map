import { SLOPE_CALCULATION_OFFSET, METERS_PER_DEGREE } from '../config';

export type ElevationQuery = (point: [number, number]) => number | null;

/**
 * Calculates both aspect and slope for a given point.
 * Uses meter-based distances for correct vector math.
 * 
 * @param point The point to calculate metrics for [longitude, latitude]
 * @param queryElevation A function that returns the elevation at a given point
 * @returns Object containing slope (degrees) and aspect (cardinal direction), or null if data missing
 */
export function calculateTerrainMetrics(
    point: [number, number],
    queryElevation: ElevationQuery
): { slope: number, aspect: string } | null {
    const [lng, lat] = point;
    // Use the slope offset as it's the same as aspect offset in config, 
    // and we stick to one consistent offset for the grid gradient.
    const offset = SLOPE_CALCULATION_OFFSET;

    // Get elevations of surrounding points
    const zN = queryElevation([lng, lat + offset]);
    const zE = queryElevation([lng + offset, lat]);
    const zS = queryElevation([lng, lat - offset]);
    const zW = queryElevation([lng - offset, lat]);

    if (zN === null || zE === null || zS === null || zW === null) return null;

    // Calculate distances in meters
    // 1 degree latitude ~= 111,111 meters
    const distY = 2 * offset * METERS_PER_DEGREE;
    // 1 degree longitude ~= 111,111 * cos(latitude) meters
    const distX = 2 * offset * METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180);

    // Calculate gradients (dz/dx and dz/dy)
    // Positive dx is East, Positive dy is North
    const dz_dx = (zE - zW) / distX;
    const dz_dy = (zN - zS) / distY;

    // --- Slope Calculation ---
    const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
    const slopeDeg = slopeRad * (180 / Math.PI);

    // --- Aspect Calculation ---
    // Gradient points uphill. Aspect faces downhill.
    const downhillX = -dz_dx;
    const downhillY = -dz_dy;

    // Angle from East counter-clockwise
    const angleFromEastCCW = Math.atan2(downhillY, downhillX) * (180 / Math.PI);

    // Convert to Compass Bearing (0=N, 90=E, 180=S, 270=W)
    let bearing = 90 - angleFromEastCCW;
    if (bearing < 0) bearing += 360;

    // Map to cardinal directions
    let aspect = '';
    if (bearing >= 337.5 || bearing < 22.5) aspect = 'N';
    else if (bearing >= 22.5 && bearing < 67.5) aspect = 'NE';
    else if (bearing >= 67.5 && bearing < 112.5) aspect = 'E';
    else if (bearing >= 112.5 && bearing < 157.5) aspect = 'SE';
    else if (bearing >= 157.5 && bearing < 202.5) aspect = 'S';
    else if (bearing >= 202.5 && bearing < 247.5) aspect = 'SW';
    else if (bearing >= 247.5 && bearing < 292.5) aspect = 'W';
    else if (bearing >= 292.5 && bearing < 337.5) aspect = 'NW';

    return { slope: slopeDeg, aspect };
}
