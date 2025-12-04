import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';
import * as config from '../config';

import { isPointInPolygon, isPointInMultiPolygon, getBounds } from '../utils/geometry';
import { calculateAspect, calculateSlope } from '../utils/geo-utils';
import { getDangerIcon, getProblemIcon, getProblemLabel } from '../utils/icons';

interface GenerationRule {
    bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number };
    geometry?: any;
    minElev: number;
    maxElev: number;
    minSlope?: number;
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

    // State for dynamic updates
    private currentMode: config.VisualizationMode = config.MODES.AVALANCHE;
    private customMin: number = config.DEFAULT_CUSTOM_MIN_ELEV;
    private customMax: number = config.DEFAULT_CUSTOM_MAX_ELEV;
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

    //TODO rework setCustomMode and setSteepnessMode to be an universal mode switch
    async setCustomMode(enabled: boolean, min?: number, max?: number, aspects?: string[], minSlope?: number) {
        if (enabled) {
            this.currentMode = config.MODES.CUSTOM;
            if (min !== undefined) this.customMin = min;
            if (max !== undefined) this.customMax = max;
            if (aspects !== undefined) this.customAspects = aspects;
            if (minSlope !== undefined) this.customMinSlope = minSlope;
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects, this.customMinSlope);
        } else {
            // If disabling custom mode, we might be going back to avalanche or steepness.
            // For now, let's default to avalanche if just toggling custom off, 
            // but the UI should handle explicit mode switches.
            this.currentMode = config.MODES.AVALANCHE;
            this.updateVisualization();
        }
    }

    async setSteepnessMode(enabled: boolean) {
        if (enabled) {
            this.currentMode = config.MODES.STEEPNESS;
            await this.renderSteepness();
        } else {
            this.currentMode = config.MODES.AVALANCHE;
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
                validAspects: band.validAspects,
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
            const regionId = feature.properties['regionId'];
            const danger = feature.properties['dangerLevel'];
            const elevation = feature.properties['elevation'];
            const aspect = feature.properties['aspect'];
            const bulletinText = feature.properties['bulletinText'];
            const avalancheProblemsProp = feature.properties['avalancheProblems'];

            let html = `<div style="font-family: sans-serif; width: 400px; max-height: 400px; overflow-y: auto; padding-right: 5px;">`;

            if (regionId) {
                html += `<h3 style="margin: 0 0 4px 0;">Region: ${regionId}</h3>`;

                const dangerIcon = getDangerIcon(danger);
                html += `<div style="display: flex; align-items: center; margin-bottom: 4px;">`;
                if (dangerIcon) {
                    html += `<img src="${dangerIcon}" alt="${danger}" style="height: 40px; margin-right: 10px;">`;
                }
                html += `<strong>Danger Level: ${danger}</strong></div>`;
            }

            html += `<div style="margin-bottom: 4px; font-size: 0.9em;">
                        Elevation: ${Math.round(elevation)}m<br>
                        ${aspect ? `Aspect: ${aspect}` : ''}
                     <div>`;



            if (avalancheProblemsProp) {
                try {
                    let problems = avalancheProblemsProp;
                    if (typeof problems === 'string') {
                        problems = JSON.parse(problems);
                    }

                    if (Array.isArray(problems) && problems.length > 0) {
                        html += `<div style="margin-top: 4px;"><strong>Avalanche Problems:</strong><ul style="padding-left: 20px; margin: 2px 0; list-style-type: none;">`;
                        problems.forEach((p: any) => {
                            const problemIcon = getProblemIcon(p.problemType);
                            const problemLabel = getProblemLabel(p.problemType);

                            html += `<li style="display: flex; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 4px;">`;

                            if (problemIcon) {
                                html += `<div style="flex-shrink: 0; margin-right: 12px;">`;
                                html += `<img src="${problemIcon}" alt="${problemLabel}" style="height: 50px; width: auto;">`;
                                html += `</div>`;
                            }

                            html += `<div style="flex-grow: 1;">`;
                            html += `<div><strong>${problemLabel}</strong></div>`;

                            html += `<div style="font-size: 0.85em; color: #333; line-height: 1.2;">`;

                            // Elevation
                            if (p.elevation) {
                                let elevText = '';
                                if (p.elevation.lowerBound && p.elevation.upperBound) {
                                    elevText = `${p.elevation.lowerBound}m - ${p.elevation.upperBound}m`;
                                } else if (p.elevation.lowerBound) {
                                    elevText = `> ${p.elevation.lowerBound}m`;
                                } else if (p.elevation.upperBound) {
                                    elevText = `< ${p.elevation.upperBound}m`;
                                }

                                if (elevText) {
                                    html += `<div>Elevation: ${elevText}</div>`;
                                }
                            }

                            // Aspects
                            if (p.aspects && p.aspects.length > 0) {
                                html += `<div>Aspects: ${p.aspects.join(', ')}</div>`;
                            }

                            // Frequency
                            if (p.frequency) {
                                html += `<div>Frequency: ${p.frequency}</div>`;
                            }

                            // Size
                            if (p.avalancheSize) {
                                html += `<div>Size: ${p.avalancheSize}</div>`;
                            }

                            html += `</div></div></li>`;
                        });
                        html += `</ul></div>`;
                    }
                } catch (e) {
                    console.error("Error parsing avalanche problems", e);
                }
            }

            if (bulletinText) {
                html += `<div style="margin-bottom: 4px; font-style: italic; font-size: 0.9em; border-left: 3px solid #ccc; padding-left: 8px;">
                            ${bulletinText}
                         </div>`;
            }

            html += `</div>`;

            new maptiler.Popup({ maxWidth: '450px' })
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
        return config.DANGER_COLORS[level] || config.DANGER_COLORS['default'];
    }

    getMap() {
        return this.map;
    }
}
