import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';

import { isPointInPolygon, isPointInMultiPolygon, getBounds } from '../utils/geometry';
import { calculateAspect, calculateSlope } from '../utils/geo-utils';

interface GenerationRule {
    bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number };
    geometry?: any;
    minElev: number;
    maxElev: number;
    minSlope?: number;
    validAspects?: string[];
    color: string;
    properties: any;
}

export class MapComponent {
    private map: maptiler.Map | null = null;
    private containerId: string;
    private mapLoaded: Promise<void>;
    private resolveMapLoaded!: () => void;
    private lastAvalancheData: CaamlData | null = null;
    private lastRegionsGeoJSON: any | null = null;

    // State for dynamic updates
    private currentMode: 'avalanche' | 'custom' | 'steepness' = 'avalanche';
    private customMin: number = 0;
    private customMax: number = 9000;
    private customAspects: string[] = [];
    private customMinSlope: number = 0;
    private isGenerating: boolean = false;

    constructor(containerId: string) {
        this.containerId = containerId;
        maptiler.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;
        this.mapLoaded = new Promise((resolve) => {
            this.resolveMapLoaded = resolve;
        });
    }

    initMap() {
        this.map = new maptiler.Map({
            container: this.containerId,
            style: maptiler.MapStyle.OUTDOOR,
            center: [11.3, 46.5], // Approximate center of Euregio
            zoom: 8,
        });

        this.map.on('load', () => {
            console.log('Map loaded');

            // Add terrain
            this.map!.addSource('maptiler_terrain', {
                type: 'raster-dem',
                url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptiler.config.apiKey}`
            });
            this.map!.setTerrain({
                source: 'maptiler_terrain',
                exaggeration: 1
            });

            // Add moveend listener for dynamic updates
            this.map!.on('moveend', () => {
                this.refreshPoints();
            });

            this.resolveMapLoaded();
        });
    }

    //TODO rework setCustomMode and setSteepnessMode to be an universal mode switch
    async setCustomMode(enabled: boolean, min?: number, max?: number, aspects?: string[], minSlope?: number) {
        if (enabled) {
            this.currentMode = 'custom';
            if (min !== undefined) this.customMin = min;
            if (max !== undefined) this.customMax = max;
            if (aspects !== undefined) this.customAspects = aspects;
            if (minSlope !== undefined) this.customMinSlope = minSlope;
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects, this.customMinSlope);
        } else {
            // If disabling custom mode, we might be going back to avalanche or steepness.
            // For now, let's default to avalanche if just toggling custom off, 
            // but the UI should handle explicit mode switches.
            this.currentMode = 'avalanche';
            this.updateVisualization();
        }
    }

    async setSteepnessMode(enabled: boolean) {
        if (enabled) {
            this.currentMode = 'steepness';
            await this.renderSteepness();
        } else {
            this.currentMode = 'avalanche';
            this.updateVisualization();
        }
    }

    private async refreshPoints() {
        if (this.isGenerating) return;
        this.updateVisualization();
    }

    async updateVisualization() {
        if (this.currentMode === 'custom') {
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects, this.customMinSlope);
        } else if (this.currentMode === 'steepness') {
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
        this.currentMode = 'avalanche';

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
                validAspects: band.validAspects,
                color: color,
                properties: {
                    regionId: band.regionID,
                    dangerLevel: band.dangerLevel
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
        this.currentMode = 'custom';
        this.customMin = min;
        this.customMax = max;
        this.customAspects = aspects;
        this.customMinSlope = minSlope;

        // Global bounds for Euregio (approximate)
        const bounds = { minLng: 10.0, maxLng: 13.0, minLat: 45.5, maxLat: 47.5 };

        const rule: GenerationRule = {
            bounds: bounds,
            minElev: min,
            maxElev: max,
            minSlope: minSlope,
            validAspects: aspects,
            color: '#0000FF', // Blue for custom mode
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
        this.currentMode = 'steepness';

        // Global bounds for Euregio (approximate)
        const bounds = { minLng: 10.0, maxLng: 13.0, minLat: 45.5, maxLat: 47.5 };

        // Define steepness bands
        // We order them so that higher steepness (Red) is drawn last (on top)
        const orderedRules: GenerationRule[] = [
            {
                bounds: bounds,
                minElev: 0,
                maxElev: 9000,
                minSlope: 30,
                color: '#FFFF33', // Yellow
                properties: { steepness: '> 30°' }
            },
            {
                bounds: bounds,
                minElev: 0,
                maxElev: 9000,
                minSlope: 35,
                color: '#FF9900', // Orange
                properties: { steepness: '> 35°' }
            },
            {
                bounds: bounds,
                minElev: 0,
                maxElev: 9000,
                minSlope: 40,
                color: '#FF0000', // Red
                properties: { steepness: '> 40°' }
            }
        ];

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
                        8, 2,
                        12, 5,
                        15, 10
                    ],
                    'circle-opacity': 0.6,
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
                    'line-color': '#000000',
                    'line-width': 1,
                    'line-opacity': 0.3
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
            const regionId = feature.properties['regionId'];
            const danger = feature.properties['dangerLevel'];
            const elevation = feature.properties['elevation'];
            const aspect = feature.properties['aspect'];

            let html = `<p>Elevation: ${Math.round(elevation)}m</p>`;
            if (aspect) {
                html += `<p>Aspect: ${aspect}</p>`;
            }
            if (regionId) {
                html = `<h3>Region: ${regionId}</h3>
                        <p>Danger Level: ${danger}</p>` + html;
            }

            new maptiler.Popup()
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(this.map!);
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
        const baseSpacing = 0.01; // at zoom 8
        const baseZoom = 8;
        // Formula: spacing decreases as zoom increases (density increases)
        let gridSpacingDeg = baseSpacing * Math.pow(1.5, baseZoom - currentZoom);

        // Clamp spacing to avoid performance issues
        gridSpacingDeg = Math.max(gridSpacingDeg, 0.0001); // Min spacing ~10m
        gridSpacingDeg = Math.min(gridSpacingDeg, 0.01);   // Max spacing ~1km

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
                            // Check aspect if specific aspects are defined for this rule
                            let aspect: string | null = null;
                            if (rule.validAspects && rule.validAspects.length > 0) {
                                aspect = calculateAspect(point, (p) => this.map?.queryTerrainElevation(p) ?? null);
                                if (!aspect || !rule.validAspects.includes(aspect)) {
                                    continue;
                                }
                            }

                            // Check slope if defined
                            if (rule.minSlope && rule.minSlope > 0) {
                                const slope = calculateSlope(point, (p) => this.map?.queryTerrainElevation(p) ?? null);
                                if (slope === null || slope < rule.minSlope) {
                                    continue;
                                }
                            }

                            features.push({
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: point
                                },
                                properties: {
                                    ...rule.properties,
                                    color: rule.color,
                                    elevation: elevation,
                                    aspect: aspect
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
        switch (level) {
            case 'low': return '#CCFF66'; // 1 - Green
            case 'moderate': return '#FFFF33'; // 2 - Yellow
            case 'considerable': return '#FF9900'; // 3 - Orange
            case 'high': return '#FF0000'; // 4 - Red
            case 'very_high': return '#A60000'; // 5 - Dark Red
            default: return '#888888';
        }
    }

    getMap() {
        return this.map;
    }
}
