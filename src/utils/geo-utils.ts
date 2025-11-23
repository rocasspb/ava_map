export type ElevationQuery = (point: [number, number]) => number | null;

/**
 * Calculates the aspect (compass direction) of the slope at a given point.
 * @param point The point to calculate aspect for [longitude, latitude]
 * @param queryElevation A function that returns the elevation at a given point
 * @returns The cardinal direction of the aspect (N, NE, E, SE, S, SW, W, NW) or null if elevation data is missing
 */
export function calculateAspect(point: [number, number], queryElevation: ElevationQuery): string | null {
    const [lng, lat] = point;
    const offset = 0.001; // Small offset for gradient calculation

    // Get elevations of surrounding points
    const z0 = queryElevation([lng, lat]);
    const zN = queryElevation([lng, lat + offset]);
    const zE = queryElevation([lng + offset, lat]);
    const zS = queryElevation([lng, lat - offset]);
    const zW = queryElevation([lng - offset, lat]);

    if (z0 === null || zN === null || zE === null || zS === null || zW === null) return null;

    // Calculate slopes (dz/dx and dz/dy)
    const dz_dx = ((zE - zW) / (2 * offset));
    const dz_dy = ((zN - zS) / (2 * offset));

    // Calculate aspect angle
    // Gradient points uphill. Aspect faces downhill.
    const downhillX = -dz_dx;
    const downhillY = -dz_dy;

    // Angle from East counter-clockwise
    const angleFromEastCCW = Math.atan2(downhillY, downhillX) * (180 / Math.PI);

    // Convert to Compass Bearing (0=N, 90=E, 180=S, 270=W)
    let bearing = 90 - angleFromEastCCW;
    if (bearing < 0) bearing += 360;

    // Map to cardinal directions
    if (bearing >= 337.5 || bearing < 22.5) return 'N';
    if (bearing >= 22.5 && bearing < 67.5) return 'NE';
    if (bearing >= 67.5 && bearing < 112.5) return 'E';
    if (bearing >= 112.5 && bearing < 157.5) return 'SE';
    if (bearing >= 157.5 && bearing < 202.5) return 'S';
    if (bearing >= 202.5 && bearing < 247.5) return 'SW';
    if (bearing >= 247.5 && bearing < 292.5) return 'W';
    if (bearing >= 292.5 && bearing < 337.5) return 'NW';

    return null;
}

/**
 * Calculates the slope (steepness) in degrees at a given point.
 * @param point The point to calculate slope for [longitude, latitude]
 * @param queryElevation A function that returns the elevation at a given point
 * @returns The slope in degrees or null if elevation data is missing
 */
export function calculateSlope(point: [number, number], queryElevation: ElevationQuery): number | null {
    const [lng, lat] = point;
    const offset = 0.0001; // Small offset for gradient calculation

    // Get elevations of surrounding points
    const zN = queryElevation([lng, lat + offset]);
    const zS = queryElevation([lng, lat - offset]);
    const zE = queryElevation([lng + offset, lat]);
    const zW = queryElevation([lng - offset, lat]);

    if (zN === null || zS === null || zE === null || zW === null) return null;

    // Calculate distances in meters
    // 1 degree latitude ~= 111,111 meters
    const distY = 2 * offset * 111111;
    // 1 degree longitude ~= 111,111 * cos(latitude) meters
    const distX = 2 * offset * 111111 * Math.cos(lat * Math.PI / 180);

    // Calculate gradients (dz/dx and dz/dy)
    const dz_dx = (zE - zW) / distX;
    const dz_dy = (zN - zS) / distY;

    // Calculate slope in degrees
    const slopeRad = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
    const slopeDeg = slopeRad * (180 / Math.PI);

    return slopeDeg;
}
