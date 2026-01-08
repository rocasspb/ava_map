import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';
import * as config from '../config';
import { ApiService } from '../services/api';

import { getBounds, isPointInMultiPolygon, isPointInPolygon } from '../utils/geometry';
import { calculateTerrainMetrics } from '../utils/geo-utils';
import { MapPopup } from './MapPopup';
import { hexToRgb, adjustElevationForTreeline, getDangerColor } from '../utils/map-helpers';
import type { GenerationRule } from '../types/GenerationRule';

import { TerrainProvider } from '../services/TerrainProvider';
import {DANGER_LEVEL_VALUES} from "../config";

export class MapComponent {
    private map: maptiler.Map | null = null;
    private containerId: string;
    private mapLoaded: Promise<void>;
    private resolveMapLoaded!: () => void;
    private lastAvalancheData: CaamlData | null = null;
    private lastRegionsGeoJSON: any | null = null;
    private popup: MapPopup;
    private canvas: HTMLCanvasElement | null = null;
    private terrainProvider: TerrainProvider;

    // State for dynamic updates
    private currentMode: config.VisualizationMode = config.MODES.BULLETIN;
    private customMin: number = config.DEFAULT_CUSTOM_MIN_ELEV;
    private customMax: number = config.DEFAULT_CUSTOM_MAX_ELEV;
    private customAspects: string[] = [];
    private customMinSlope: number = config.DEFAULT_CUSTOM_MIN_SLOPE;
    private isGenerating: boolean = false;

    public getMode(): config.VisualizationMode {
        return this.currentMode;
    }

    constructor(containerId: string) {
        this.containerId = containerId;
        maptiler.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;
        this.mapLoaded = new Promise((resolve) => {
            this.resolveMapLoaded = resolve;
        });
        this.popup = new MapPopup();
        this.terrainProvider = new TerrainProvider(maptiler.config.apiKey);
    }

    async initMap() {
        this.map = new maptiler.Map({
            container: this.containerId,
            style: config.MAP_STYLE,
            center: config.DEFAULT_CENTER,
            zoom: config.DEFAULT_ZOOM,
        });

        // Create canvas for raster layer
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'avalanche-raster-canvas';
        this.canvas.style.display = 'none';

        this.map.on('load', () => {
            console.log('Map loaded');

            // Add terrain
            this.map!.addSource('maptiler_terrain', {
                type: 'raster-dem',
                url: `${config.TERRAIN_SOURCE_URL_PREFIX}${maptiler.config.apiKey}`
            });
            this.map!.setTerrain({
                source: 'maptiler_terrain',
                exaggeration: config.TERRAIN_EXAGGERATION
            });

            // Add moveend listener for dynamic updates
            this.map!.on('moveend', () => {
                this.refreshPoints();
            });

            // Add click listener for raster interaction
            this.map!.on('click', (e) => this.handleMapClick(e));

            this.resolveMapLoaded();
        });

        await this.fetchData();

        // Auto-refresh data
        setInterval(() => {
            console.log('Auto-refreshing avalanche data...');
            this.fetchData();
        }, config.DATA_REFRESH_INTERVAL);
    }

    private async fetchData() {
        console.log('Fetching avalanche data...');
        try {
            const [avalancheData, regionsGeoJSON] = await Promise.all([
                ApiService.getAvalancheData(),
                ApiService.getRegionsGeoJSON()
            ]);

            console.log('Avalanche Data:', avalancheData);
            console.log('Regions GeoJSON:', regionsGeoJSON);

            this.lastAvalancheData = avalancheData;
            this.lastRegionsGeoJSON = regionsGeoJSON;

            this.updateVisualization();
        } catch (error) {
            console.error('Failed to fetch avalanche data:', error);
        }
    }

    async setMode(mode: config.VisualizationMode) {
        this.currentMode = mode;
        this.updateVisualization();
    }

    async setCustomModeParams(min?: number, max?: number, aspects?: string[], minSlope?: number) {
        if (min !== undefined) this.customMin = min;
        if (max !== undefined) this.customMax = max;
        if (aspects !== undefined) this.customAspects = aspects;
        if (minSlope !== undefined) this.customMinSlope = minSlope;
        this.updateVisualization();
    }

    private async refreshPoints() {
        if (this.isGenerating) return;
        this.updateVisualization();
    }

    async updateVisualization() {
        if (this.currentMode === config.MODES.CUSTOM) {
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects, this.customMinSlope);
        } else if (this.currentMode === config.MODES.RISK && this.lastAvalancheData && this.lastRegionsGeoJSON) {
            await this.renderAvalancheData();
        } else if (this.lastAvalancheData && this.lastRegionsGeoJSON) {
            await this.renderAvalancheData(true);
        }
    }

    async renderAvalancheData(bulletin: boolean = false) {
        await this.mapLoaded;
        if (!this.map || !this.lastAvalancheData) return;

        this.isGenerating = true;

        const elevationBands = processRegionElevations(this.lastAvalancheData);

        // Map regions by ID for easy lookup
        const regionsMap = new Map<string, any>();
        if (this.lastRegionsGeoJSON.features) {
            this.lastRegionsGeoJSON.features.forEach((f: any) => {
                regionsMap.set(f.properties.id, f);
            });
        }

        const rules: GenerationRule[] = [];

        for (const band of elevationBands) {
            const regionFeature = regionsMap.get(band.regionID);
            if (!regionFeature) continue;

            const regionBounds = getBounds(regionFeature);
            const color = getDangerColor(band.dangerLevel);
            const useAspectANdElevation = this.currentMode === config.MODES.RISK;

            const { min: ruleMinElev, max: ruleMaxElev } = adjustElevationForTreeline(
                band.minElev,
                band.maxElev,
                band.avalancheProblems
            );

            rules.push({
                bounds: regionBounds,
                geometry: regionFeature.geometry,
                minElev: ruleMinElev,
                maxElev: ruleMaxElev,
                minSlope: bulletin ? undefined : 30,
                validAspects: useAspectANdElevation ? band.validAspects : undefined,
                applySteepnessLogic: useAspectANdElevation,
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

        const rasterData = await this.drawToCanvas(rules);
        if (rasterData) {
            this.updateRasterSource(rasterData);
            this.addRasterLayer();
        }

        this.addOutlineLayer(this.lastRegionsGeoJSON);
        this.isGenerating = false;
    }

    async renderCustomElevation(min: number, max: number, aspects: string[], minSlope: number = 0) {
        await this.mapLoaded;
        if (!this.map) return;

        this.isGenerating = true;
        this.customMin = min;
        this.customMax = max;
        this.customAspects = aspects;
        this.customMinSlope = minSlope;

        const bounds = config.EUREGIO_BOUNDS;

        const orderedRules: GenerationRule[] = config.STEEPNESS_THRESHOLDS.filter(t => t.minSlope >= minSlope).map(t => ({
            bounds: bounds,
            minElev: min,
            maxElev: max,
            minSlope: t.minSlope,
            validAspects: aspects,
            color: t.color,
            properties: { steepness: t.label }
        }));

        const rasterData = await this.drawToCanvas(orderedRules);
        if (rasterData) {
            this.updateRasterSource(rasterData);
            this.addRasterLayer();
        }

        if (this.map.getLayer('regions-outline')) {
            this.map.removeLayer('regions-outline');
        }
        if (this.map.getSource('regions-outline-source')) {
            this.map.removeSource('regions-outline-source');
        }
        this.isGenerating = false;
    }

    private updateRasterSource(data: { coordinates: [[number, number], [number, number], [number, number], [number, number]] }) {
        const sourceId = 'avalanche-raster-source';
        const source = this.map!.getSource(sourceId) as any;

        if (source) {
            source.setCoordinates(data.coordinates);
            this.map!.triggerRepaint();
        } else {
            this.map!.addSource(sourceId, {
                type: 'canvas',
                canvas: this.canvas!,
                coordinates: data.coordinates,
                animate: true
            });
        }
    }

    private addRasterLayer() {
        if (!this.map!.getLayer('avalanche-raster-layer')) {
            this.map!.addLayer({
                id: 'avalanche-raster-layer',
                type: 'raster',
                source: 'avalanche-raster-source',
                paint: {
                    'raster-opacity': 0.3,
                    'raster-fade-duration': 0,
                    'raster-resampling': 'linear'
                }
            });
        }
    }

    private addOutlineLayer(regionsGeoJSON: any) {
        if (!this.map!.getSource('regions-outline-source')) {
            this.map!.addSource('regions-outline-source', {
                type: 'geojson',
                data: regionsGeoJSON
            });
        }

        if (!this.map!.getLayer('regions-outline')) {
            this.map!.addLayer({
                id: 'regions-outline',
                type: 'line',
                source: 'regions-outline-source',
                paint: {
                    'line-color': config.OUTLINE_COLOR,
                    'line-width': config.OUTLINE_WIDTH,
                    'line-opacity': config.OUTLINE_OPACITY
                }
            });
        }
    }

    private handleMapClick(e: any) {
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        let clickedRegionId: string | null = null;
        if (this.lastRegionsGeoJSON && this.lastRegionsGeoJSON.features) {
            for (const feature of this.lastRegionsGeoJSON.features) {
                let isInside = false;
                if (feature.geometry.type === 'Polygon') {
                    isInside = isPointInPolygon(point, feature.geometry.coordinates);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    isInside = isPointInMultiPolygon(point, feature.geometry.coordinates);
                }

                if (isInside) {
                    clickedRegionId = feature.properties.id;
                    break;
                }
            }
        }

        if (!clickedRegionId) return;
        if (this.lastAvalancheData && this.lastAvalancheData.bulletins) {
            const bulletin = this.lastAvalancheData.bulletins.find(b =>
                b.regions.some(r => r.regionID.startsWith(clickedRegionId))
            );

            if (bulletin) {
                let bulletinText = "";
                if (bulletin.avalancheActivity) {
                    const parts = [];
                    if (bulletin.avalancheActivity.highlights) parts.push(bulletin.avalancheActivity.highlights);
                    if (bulletin.avalancheActivity.comment) parts.push(bulletin.avalancheActivity.comment);
                    bulletinText = parts.join('\n\n');
                }

                const properties = {
                    regionId: clickedRegionId,
                    dangerRatings: bulletin.dangerRatings,
                    dangerLevel: bulletin.dangerRatings[0]?.mainValue, // Fallback
                    avalancheProblems: bulletin.avalancheProblems,
                    bulletinText: bulletinText
                };

                this.popup.show(this.map!, e.lngLat, properties);
            }
        }
    }

    private async drawToCanvas(rules: GenerationRule[]): Promise<{ coordinates: [[number, number], [number, number], [number, number], [number, number]] } | null> {
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

        const MAX_DIM = 2000;
        if (width > MAX_DIM || height > MAX_DIM) {
            // Could clamp here if needed
        }

        this.canvas.width = width;
        this.canvas.height = height;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return null;

        ctx.clearRect(0, 0, width, height);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        // --- Fetch Tiles via Provider ---
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
        // ---------------------------
        // ---------------------------

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
                                if (dlValue >= 4) {
                                    if (slope > 30) finalColor = config.DANGER_COLORS['high'];
                                    else finalColor = config.DANGER_COLORS['considerable'];
                                } else if (dlValue === 3) {
                                    if (slope > 35) finalColor = config.DANGER_COLORS['high'];
                                    else if (slope > 30) finalColor = config.DANGER_COLORS['considerable'];
                                    else continue;
                                } else if (dlValue === 2) {
                                    if (slope > 40) finalColor = config.DANGER_COLORS['high'];
                                    else if (slope > 35) finalColor = config.DANGER_COLORS['considerable'];
                                    else continue;
                                } else if (dlValue === 1) {
                                    if (slope > 40) finalColor = config.DANGER_COLORS['considerable'];
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

    getMap() {
        return this.map;
    }
}