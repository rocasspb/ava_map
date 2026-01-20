import * as maptiler from '@maptiler/sdk';
import * as config from '../config';
import { hexToRgb } from '../utils/map-helpers';
import { isPointInPolygon, isPointInMultiPolygon } from '../utils/geometry';
import { calculateTerrainMetrics } from '../utils/geo-utils';
import type { GenerationRule } from '../types/GenerationRule';
import { TerrainProvider } from '../services/TerrainProvider';

export class CanvasRenderer {
    constructor(
        private map: maptiler.Map,
        private canvas: HTMLCanvasElement,
        private terrainProvider: TerrainProvider
    ) {}

    async draw(rules: GenerationRule[]): Promise<{ coordinates: [[number, number], [number, number], [number, number], [number, number]] } | null> {
        if (!this.map || !this.canvas) return null;

        const bounds = this.map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        const latRange = north - south;
        const lngRange = east - west;

        const gridSpacingDeg = Math.max(latRange, lngRange) / config.GRID_POINTS_DENSITY;

        const width = Math.ceil(lngRange / gridSpacingDeg);
        const height = Math.ceil(latRange / gridSpacingDeg);

        this.canvas.width = width;
        this.canvas.height = height;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return null;

        ctx.clearRect(0, 0, width, height);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        try {
            await this.terrainProvider.fetchTiles(
                { west, south, east, north },
                this.map.getZoom()
            );
        } catch (e) {
            console.error("Failed to fetch terrain tiles", e);
            return null;
        }

        const getElevation = (p: [number, number]): number | null => {
            return this.terrainProvider.getElevation(p[0], p[1]);
        };

        const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
            const index = (y * width + x) * 4;
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = 255; // Fully opaque pixels, controlled by layer opacity
        };

        for (const rule of rules) {
            const rNorth = Math.min(north, rule.bounds.maxLat);
            const rSouth = Math.max(south, rule.bounds.minLat);
            const rEast = Math.min(east, rule.bounds.maxLng);
            const rWest = Math.max(west, rule.bounds.minLng);

            if (rNorth <= rSouth || rEast <= rWest) continue;

            const startX = Math.floor((rWest - west) / gridSpacingDeg);
            const endX = Math.ceil((rEast - west) / gridSpacingDeg);
            const startY = Math.floor((north - rNorth) / gridSpacingDeg);
            const endY = Math.ceil((north - rSouth) / gridSpacingDeg);

            const sX = Math.max(0, startX);
            const eX = Math.min(width, endX);
            const sY = Math.max(0, startY);
            const eY = Math.min(height, endY);

            const rgb = hexToRgb(rule.color);
            if (!rgb) continue;

            for (let x = sX; x < eX; x++) {
                for (let y = sY; y < eY; y++) {
                    const lng = west + (x + 0.5) * gridSpacingDeg;
                    const lat = north - (y + 0.5) * gridSpacingDeg;
                    const point: [number, number] = [lng, lat];

                    if (rule.geometry) {
                        let isInside = false;
                        if (rule.geometry.type === 'Polygon') {
                            isInside = isPointInPolygon(point, rule.geometry.coordinates);
                        } else if (rule.geometry.type === 'MultiPolygon') {
                            isInside = isPointInMultiPolygon(point, rule.geometry.coordinates);
                        }
                        if (!isInside) continue;
                    }

                    const elevation = getElevation(point);

                    if (elevation !== null && elevation !== undefined) {
                        if (elevation >= rule.minElev && elevation <= rule.maxElev) {
                            let aspect: string | null = null;
                            let slope: number | null = null;

                            const level = rule.properties.dangerLevel;
                            let dlValue = level ? (config.DANGER_LEVEL_VALUES[level] || 0) : 0;

                            const checkAspect = rule.validAspects && rule.validAspects.length > 0;
                            const checkSlope = (rule.minSlope && rule.minSlope > 0) || rule.applySteepnessLogic;

                            if (checkAspect || checkSlope) {
                                const metrics = calculateTerrainMetrics(point, getElevation);
                                if (!metrics) continue;

                                slope = metrics.slope;
                                if (checkSlope) {
                                    if (slope === null || (rule.minSlope && slope < rule.minSlope)) {
                                        continue;
                                    }
                                }

                                aspect = metrics.aspect;
                                if (checkAspect && (!aspect || !rule.validAspects!.includes(aspect))) {
                                    if (dlValue == 0) continue;
                                    else if (dlValue > 1) dlValue--;
                                }
                            }

                            let finalColor = rule.color;
                            let finalRgb = rgb;

                            if (rule.applySteepnessLogic && slope !== null) {
                                if(slope >= 50) continue;
                                if (dlValue >= 4) {
                                    if (slope >= 30) finalColor = config.DANGER_COLORS['high'];
                                    else finalColor = config.DANGER_COLORS['considerable'];
                                } else if (dlValue === 3) {
                                    if (slope >= 35) finalColor = config.DANGER_COLORS['high'];
                                    else if (slope >= 30) finalColor = config.DANGER_COLORS['considerable'];
                                    else continue;
                                } else if (dlValue === 2) {
                                    if (slope >= 40) finalColor = config.DANGER_COLORS['high'];
                                    else if (slope >= 35) finalColor = config.DANGER_COLORS['considerable'];
                                    else continue;
                                } else if (dlValue === 1) {
                                    if (slope >= 40) finalColor = config.DANGER_COLORS['considerable'];
                                    else continue;
                                }
                                const c = hexToRgb(finalColor);
                                if (c) finalRgb = c;
                            }

                            setPixel(x, y, finalRgb.r, finalRgb.g, finalRgb.b);
                        }
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);

        // Return coordinates that match the generated grid
        return {
            coordinates: [
                [west, north],
                [west + width * gridSpacingDeg, north],
                [west + width * gridSpacingDeg, north - height * gridSpacingDeg],
                [west, north - height * gridSpacingDeg]
            ]
        };
    }
}
