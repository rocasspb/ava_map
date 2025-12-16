import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';
import * as config from '../config';

import { isPointInPolygon, isPointInMultiPolygon, getBounds } from '../utils/geometry';
import { calculateTerrainMetrics } from '../utils/geo-utils';
import { MapPopup } from './MapPopup';

interface GenerationRule {
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

export class MapComponent {
    private map: maptiler.Map | null = null;
    private containerId: string;
    private mapLoaded: Promise<void>;
    private resolveMapLoaded!: () => void;
    private lastAvalancheData: CaamlData | null = null;
    private lastRegionsGeoJSON: any | null = null;
    private popup: MapPopup;

    // State for dynamic updates
    private currentMode: config.VisualizationMode = config.MODES.AVALANCHE;
    private customMin: number = config.DEFAULT_CUSTOM_MIN_ELEV;
    private customMax: number = config.DEFAULT_CUSTOM_MAX_ELEV;
    private customAspects: string[] = [];
    private customMinSlope: number = config.DEFAULT_CUSTOM_MIN_SLOPE;
    private isGenerating: boolean = false;

    // Avalanche Mode Configuration

    private avalancheUseAspect: boolean = true;
    private avalancheApplySteepness: boolean = false;

    constructor(containerId: string) {
        this.containerId = containerId;
        maptiler.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;
        this.mapLoaded = new Promise((resolve) => {
            this.resolveMapLoaded = resolve;
        });
        this.popup = new MapPopup();
    }

    initMap() {
        this.map = new maptiler.Map({
            container: this.containerId,
            style: config.MAP_STYLE,
            center: config.DEFAULT_CENTER,
            zoom: config.DEFAULT_ZOOM,
        });

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

            this.resolveMapLoaded();
        });
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

    async setAvalancheConfig(useAspect: boolean, applySteepness: boolean) {
        this.avalancheUseAspect = useAspect;
        this.avalancheApplySteepness = applySteepness;
        if (this.currentMode === config.MODES.AVALANCHE) {
            this.updateVisualization();
        }
    }

    private async refreshPoints() {
        if (this.isGenerating) return;
        this.updateVisualization();
    }

    async updateVisualization() {
        if (this.currentMode === config.MODES.CUSTOM) {
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects, this.customMinSlope);
        } else if (this.currentMode === config.MODES.STEEPNESS) {
            await this.renderSteepness();
        } else if (this.lastAvalancheData && this.lastRegionsGeoJSON) {
            await this.renderAvalancheData(this.lastAvalancheData, this.lastRegionsGeoJSON);
        }
    }

    async renderAvalancheData(data: CaamlData, regionsGeoJSON: any) {
        await this.mapLoaded;
        if (!this.map) return;

        this.isGenerating = true;
        this.lastAvalancheData = data;
        this.lastRegionsGeoJSON = regionsGeoJSON;
        this.currentMode = config.MODES.AVALANCHE;

        const elevationBands = processRegionElevations(data);

        // Map regions by ID for easy lookup
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
            const color = this.getDangerColor(band.dangerLevel);

            rules.push({
                bounds: regionBounds,
                geometry: regionFeature.geometry,
                minElev: band.minElev,
                maxElev: band.maxElev,
                validAspects: this.avalancheUseAspect ? band.validAspects : undefined,
                applySteepnessLogic: this.avalancheApplySteepness,
                color: color,
                properties: {
                    regionId: band.regionID,
                    dangerLevel: band.dangerLevel,
                    avalancheProblems: band.avalancheProblems,
                    bulletinText: band.bulletinText
                }
            });
        }

        const pointsFeatures = await this.generatePoints(rules);
        this.updatePointSource(pointsFeatures);
        this.addPointLayer();
        this.addOutlineLayer(regionsGeoJSON);
        this.setupInteractions();
        this.isGenerating = false;
    }

    async renderCustomElevation(min: number, max: number, aspects: string[], minSlope: number = 0) {
        await this.mapLoaded;
        if (!this.map) return;

        this.isGenerating = true;
        this.currentMode = config.MODES.CUSTOM;
        this.customMin = min;
        this.customMax = max;
        this.customAspects = aspects;
        this.customMinSlope = minSlope;

        // Global bounds for Euregio (approximate)
        const bounds = config.EUREGIO_BOUNDS;

        const rule: GenerationRule = {
            bounds: bounds,
            minElev: min,
            maxElev: max,
            minSlope: minSlope,
            validAspects: aspects,
            color: config.CUSTOM_MODE_COLOR,
            properties: {}
        };

        const pointsFeatures = await this.generatePoints([rule]);
        this.updatePointSource(pointsFeatures);
        this.addPointLayer();

        // Remove outlines in custom mode if they exist
        if (this.map.getLayer('regions-outline')) {
            this.map.removeLayer('regions-outline');
        }
        if (this.map.getSource('regions-outline-source')) {
            this.map.removeSource('regions-outline-source');
        }
        this.isGenerating = false;
    }

    async renderSteepness() {
        await this.mapLoaded;
        if (!this.map) return;

        this.isGenerating = true;
        this.currentMode = config.MODES.STEEPNESS;

        // Global bounds for Euregio (approximate)
        const bounds = config.EUREGIO_BOUNDS;

        // Define steepness bands
        // We order them so that higher steepness (Red) is drawn last (on top)
        const orderedRules: GenerationRule[] = config.STEEPNESS_THRESHOLDS.map(t => ({
            bounds: bounds,
            minElev: 0,
            maxElev: 9000,
            minSlope: t.minSlope,
            color: t.color,
            properties: { steepness: t.label }
        }));

        const pointsFeatures = await this.generatePoints(orderedRules);
        this.updatePointSource(pointsFeatures);
        this.addPointLayer();

        // Remove outlines
        if (this.map.getLayer('regions-outline')) {
            this.map.removeLayer('regions-outline');
        }
        if (this.map.getSource('regions-outline-source')) {
            this.map.removeSource('regions-outline-source');
        }
        this.isGenerating = false;
    }

    private updatePointSource(features: any) {
        if (this.map!.getSource('avalanche-points')) {
            (this.map!.getSource('avalanche-points') as maptiler.GeoJSONSource).setData(features);
        } else {
            this.map!.addSource('avalanche-points', {
                type: 'geojson',
                data: features
            });
        }
    }

    private addPointLayer() {
        if (!this.map!.getLayer('avalanche-points-layer')) {
            this.map!.addLayer({
                id: 'avalanche-points-layer',
                type: 'circle',
                source: 'avalanche-points',
                paint: {
                    'circle-color': ['get', 'color'],
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        ...config.POINT_RADIUS_STOPS.flat()
                    ],
                    'circle-opacity': config.POINT_OPACITY,
                    'circle-pitch-alignment': 'map'
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

    private setupInteractions() {
        // Remove existing listeners to avoid duplicates if called multiple times
        this.map!.off('click', 'avalanche-points-layer', this.handlePointClick);
        this.map!.off('mouseenter', 'avalanche-points-layer', this.handleMouseEnter);
        this.map!.off('mouseleave', 'avalanche-points-layer', this.handleMouseLeave);

        this.map!.on('click', 'avalanche-points-layer', this.handlePointClick);
        this.map!.on('mouseenter', 'avalanche-points-layer', this.handleMouseEnter);
        this.map!.on('mouseleave', 'avalanche-points-layer', this.handleMouseLeave);
    }

    private handlePointClick = (e: any) => {
        if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            this.popup.show(this.map!, e.lngLat, feature.properties);
        }
    }

    private handleMouseEnter = () => {
        this.map!.getCanvas().style.cursor = 'pointer';
    }

    private handleMouseLeave = () => {
        this.map!.getCanvas().style.cursor = '';
    }

    private async generatePoints(rules: GenerationRule[]): Promise<any> {
        const features: any[] = [];

        // Dynamic grid spacing based on zoom
        const currentZoom = this.map!.getZoom();
        const baseSpacing = config.GRID_BASE_SPACING;
        const baseZoom = config.GRID_BASE_ZOOM;
        // Formula: spacing decreases as zoom increases (density increases)
        let gridSpacingDeg = baseSpacing * Math.pow(config.GRID_DENSITY_FACTOR, baseZoom - currentZoom);

        // Clamp spacing to avoid performance issues
        gridSpacingDeg = Math.max(gridSpacingDeg, config.GRID_MIN_SPACING);
        gridSpacingDeg = Math.min(gridSpacingDeg, config.GRID_MAX_SPACING);

        const mapBounds = this.map!.getBounds();

        for (const rule of rules) {
            // Intersect rule bounds with map bounds to only generate visible points
            const minLng = Math.max(rule.bounds.minLng, mapBounds.getWest());
            const maxLng = Math.min(rule.bounds.maxLng, mapBounds.getEast());
            const minLat = Math.max(rule.bounds.minLat, mapBounds.getSouth());
            const maxLat = Math.min(rule.bounds.maxLat, mapBounds.getNorth());

            // Skip if rule region is not visible
            if (minLng > maxLng || minLat > maxLat) continue;

            // Generate grid points
            for (let lng = minLng; lng <= maxLng; lng += gridSpacingDeg) {
                for (let lat = minLat; lat <= maxLat; lat += gridSpacingDeg) {
                    const point: [number, number] = [lng, lat];

                    // 1. Check if point is inside region polygon (if geometry exists)
                    if (rule.geometry) {
                        let isInside = false;
                        if (rule.geometry.type === 'Polygon') {
                            isInside = isPointInPolygon(point, rule.geometry.coordinates);
                        } else if (rule.geometry.type === 'MultiPolygon') {
                            isInside = isPointInMultiPolygon(point, rule.geometry.coordinates);
                        }
                        if (!isInside) continue;
                    }

                    // 2. Check elevation
                    const elevation = this.map?.queryTerrainElevation(point);

                    if (elevation !== null && elevation !== undefined) {
                        if (elevation >= rule.minElev && elevation <= rule.maxElev) {
                            let aspect: string | null = null;
                            let slope: number | null = null;

                            const checkAspect = rule.validAspects && rule.validAspects.length > 0;
                            const checkSlope = (rule.minSlope && rule.minSlope > 0) || rule.applySteepnessLogic;

                            if (checkAspect || checkSlope) {
                                const metrics = calculateTerrainMetrics(point, (p) => this.map?.queryTerrainElevation(p) ?? null);
                                if (!metrics) continue; // Missing data for slope/aspect

                                slope = metrics.slope;
                                aspect = metrics.aspect;

                                // Check Aspect
                                if (checkAspect && (!aspect || !rule.validAspects!.includes(aspect))) {
                                    continue;
                                }

                                // Check Slope
                                if (checkSlope) {
                                    if (slope === null || (rule.minSlope && slope < rule.minSlope)) {
                                        continue;
                                    }
                                }
                            }

                            let finalColor = rule.color;

                            if (rule.applySteepnessLogic && slope !== null) {
                                const level = rule.properties.dangerLevel; // e.g. "considerable", "high"
                                const dlValue = level ? (config.DANGER_LEVEL_VALUES[level] || 0) : 0;
                                let keep = false;

                                // Logic:
                                // Level 4+ (High+): >30 Red, else Orange
                                // Level 3 (Considerable): >35 Red, >30 Orange
                                // Level 2 (Moderate): >40 Red, >35 Orange
                                // Level 1 (Low): >40 Orange

                                if (dlValue >= 4) {
                                    keep = true;
                                    if (slope > 30) finalColor = config.DANGER_COLORS['high']; // Red
                                    else finalColor = config.DANGER_COLORS['considerable']; // Orange
                                } else if (dlValue === 3) {
                                    if (slope > 35) {
                                        keep = true;
                                        finalColor = config.DANGER_COLORS['high']; // Red
                                    } else if (slope > 30) {
                                        keep = true;
                                        finalColor = config.DANGER_COLORS['considerable']; // Orange
                                    }
                                } else if (dlValue === 2) {
                                    if (slope > 40) {
                                        keep = true;
                                        finalColor = config.DANGER_COLORS['high']; // Red
                                    } else if (slope > 35) {
                                        keep = true;
                                        finalColor = config.DANGER_COLORS['considerable']; // Orange
                                    }
                                } else if (dlValue === 1) {
                                    if (slope > 40) {
                                        keep = true;
                                        finalColor = config.DANGER_COLORS['considerable']; // Orange
                                    }
                                }

                                // If not applySteepness, we follow standard rules (keep = true by default as we reached here)
                                // But here we are IN the logic block. If keep is false, we skip.
                                if (!keep) continue;
                            }

                            features.push({
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: point
                                },
                                properties: {
                                    ...rule.properties,
                                    color: finalColor,
                                    elevation: elevation,
                                    aspect: aspect,
                                    slope: slope
                                }
                            });
                        }
                    }
                }
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    private getDangerColor(level: string): string {
        return config.DANGER_COLORS[level] || config.DANGER_COLORS['default'];
    }

    getMap() {
        return this.map;
    }
}
