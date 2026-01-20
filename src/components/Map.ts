import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';
import * as config from '../config';
import { ApiService } from '../services/api';

import { getBounds } from '../utils/geometry';
import { MapPopup } from './MapPopup';
import { adjustElevationForTreeline, getDangerColor } from '../utils/map-helpers';
import type { GenerationRule } from '../types/GenerationRule';

import { TerrainProvider } from '../services/TerrainProvider';
import {DANGER_LEVEL_VALUES} from "../config";
import { MapClickHandler } from './MapClickHandler';
import { CanvasRenderer } from './CanvasRenderer';

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
    private currentStyle: maptiler.ReferenceMapStyle = config.MAP_STYLE;
    private clickHandler: MapClickHandler | null = null;
    private canvasRenderer: CanvasRenderer | null = null;

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
            style: this.currentStyle,
            center: config.DEFAULT_CENTER,
            zoom: config.DEFAULT_ZOOM,
            geolocateControl: true
        });

        this.clickHandler = new MapClickHandler(this.map, this.terrainProvider, this.popup);

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'avalanche-raster-canvas';
        this.canvas.style.display = 'none';
        
        this.canvasRenderer = new CanvasRenderer(this.map!, this.canvas!, this.terrainProvider);

        this.map.on('load', () => {
            console.log('Map loaded');
            this.setupMapLayers();

            // Add moveend listener for dynamic updates
            this.map!.on('moveend', () => {
                this.refreshPoints();
            });

            // Add click listener for raster interaction
            this.map!.on('click', (e) => this.clickHandler?.handleClick(e));

            this.resolveMapLoaded();
        });

        await this.fetchData();

        // Auto-refresh data
        setInterval(() => {
            console.log('Auto-refreshing avalanche data...');
            this.fetchData();
        }, config.DATA_REFRESH_INTERVAL);
    }

    private setupMapLayers() {
        if (!this.map) return;

        // Add terrain
        if (!this.map.getSource('maptiler_terrain')) {
            this.map.addSource('maptiler_terrain', {
                type: 'raster-dem',
                url: `${config.TERRAIN_SOURCE_URL_PREFIX}${maptiler.config.apiKey}`
            });
        }
        
        this.map.setTerrain({
            source: 'maptiler_terrain',
            exaggeration: config.TERRAIN_EXAGGERATION
        });
    }

    async toggleBaseLayer() {
        if (!this.map) return;

        // Toggle style
        if (this.currentStyle === maptiler.MapStyle.HYBRID) {
            this.currentStyle = maptiler.MapStyle.WINTER;
        } else {
            this.currentStyle = maptiler.MapStyle.HYBRID;
        }

        this.map.setStyle(this.currentStyle);

        this.map.once('styledata', () => {
            this.setupMapLayers();
            // Re-add raster layer and outline
            this.updateVisualization();
        });
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

            this.clickHandler?.updateData(avalancheData, regionsGeoJSON);

            await this.updateVisualization();
        } catch (error) {
            console.error('Failed to fetch avalanche data:', error);
        }
    }

    async setMode(mode: config.VisualizationMode) {
        this.currentMode = mode;
        await this.updateVisualization();
    }

    async setCustomModeParams(min?: number, max?: number, aspects?: string[], minSlope?: number) {
        if (min !== undefined) this.customMin = min;
        if (max !== undefined) this.customMax = max;
        if (aspects !== undefined) this.customAspects = aspects;
        if (minSlope !== undefined) this.customMinSlope = minSlope;
        await this.updateVisualization();
    }

    private async refreshPoints() {
        if (this.isGenerating) return;
        await this.updateVisualization();
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
        if (!this.map || !this.lastAvalancheData || !this.canvasRenderer) return;

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

        const rasterData = await this.canvasRenderer.draw(rules);
        if (rasterData) {
            this.updateRasterSource(rasterData);
            this.addRasterLayer();
        }

        this.addOutlineLayer(this.lastRegionsGeoJSON);
        this.isGenerating = false;
    }

    async renderCustomElevation(min: number, max: number, aspects: string[], minSlope: number = 0) {
        await this.mapLoaded;
        if (!this.map || !this.canvasRenderer) return;

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

        const rasterData = await this.canvasRenderer.draw(orderedRules);
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

    getMap() {
        return this.map;
    }
}