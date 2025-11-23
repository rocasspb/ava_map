import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';
import type { ElevationBand } from '../utils/data-processing';
import { isPointInPolygon, isPointInMultiPolygon } from '../utils/geometry';

export class MapComponent {
    private map: maptiler.Map | null = null;
    private containerId: string;
    private mapLoaded: Promise<void>;
    private resolveMapLoaded!: () => void;
    private lastAvalancheData: CaamlData | null = null;
    private lastRegionsGeoJSON: any | null = null;

    // State for dynamic updates
    private currentMode: 'avalanche' | 'custom' = 'avalanche';
    private customMin: number = 0;
    private customMax: number = 9000;
    private customAspects: string[] = [];
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

    async setCustomMode(enabled: boolean, min: number = 0, max: number = 9000, aspects: string[] = []) {
        this.currentMode = enabled ? 'custom' : 'avalanche';
        this.customMin = min;
        this.customMax = max;
        this.customAspects = aspects;

        if (enabled) {
            await this.renderCustomElevation(min, max, aspects);
        } else {
            if (this.lastAvalancheData && this.lastRegionsGeoJSON) {
                await this.renderAvalancheData(this.lastAvalancheData, this.lastRegionsGeoJSON);
            }
        }
    }

    private async refreshPoints() {
        if (this.isGenerating) return;

        if (this.currentMode === 'custom') {
            await this.renderCustomElevation(this.customMin, this.customMax, this.customAspects);
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

        const pointsFeatures = await this.generateElevationPoints(elevationBands, regionsMap);
        this.updatePointSource(pointsFeatures);
        this.addPointLayer();
        this.addOutlineLayer(regionsGeoJSON);
        this.setupInteractions();
        this.isGenerating = false;
    }

    async renderCustomElevation(min: number, max: number, aspects: string[] = []) {
        await this.mapLoaded;
        if (!this.map) return;

        this.isGenerating = true;
        this.currentMode = 'custom';
        this.customMin = min;
        this.customMax = max;
        this.customAspects = aspects;

        // Global bounds for Euregio (approximate)
        const bounds = { minLng: 10.0, maxLng: 13.0, minLat: 45.5, maxLat: 47.5 };

        const pointsFeatures = await this.generateGlobalPoints(bounds, min, max, aspects);
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

    private async generateElevationPoints(bands: ElevationBand[], regionsMap: Map<string, any>): Promise<any> {
        const features: any[] = [];

        // Dynamic grid spacing based on zoom
        const currentZoom = this.map!.getZoom();
        const baseSpacing = 0.01; // at zoom 8
        const baseZoom = 8;
        // Formula: spacing decreases as zoom increases (density increases)
        // We want spacing to be smaller when zoom is higher.
        // Using 1.2 instead of 2 to make it less aggressive (points will visually spread out slightly as you zoom in)
        let GRID_SPACING_DEG = baseSpacing * Math.pow(1.2, baseZoom - currentZoom);

        // Clamp spacing to avoid performance issues
        GRID_SPACING_DEG = Math.max(GRID_SPACING_DEG, 0.0001); // Min spacing ~10m
        GRID_SPACING_DEG = Math.min(GRID_SPACING_DEG, 0.01);   // Max spacing ~1km

        const mapBounds = this.map!.getBounds();

        for (const band of bands) {
            const regionFeature = regionsMap.get(band.regionID);
            if (!regionFeature) continue;

            const regionBounds = this.getBounds(regionFeature);

            // Intersect region bounds with map bounds to only generate visible points
            const minLng = Math.max(regionBounds.minLng, mapBounds.getWest());
            const maxLng = Math.min(regionBounds.maxLng, mapBounds.getEast());
            const minLat = Math.max(regionBounds.minLat, mapBounds.getSouth());
            const maxLat = Math.min(regionBounds.maxLat, mapBounds.getNorth());

            // Skip if region is not visible
            if (minLng > maxLng || minLat > maxLat) continue;

            const color = this.getDangerColor(band.dangerLevel);

            // Generate grid points
            for (let lng = minLng; lng <= maxLng; lng += GRID_SPACING_DEG) {
                for (let lat = minLat; lat <= maxLat; lat += GRID_SPACING_DEG) {
                    const point: [number, number] = [lng, lat];

                    // 1. Check if point is inside region polygon
                    let isInside = false;
                    if (regionFeature.geometry.type === 'Polygon') {
                        isInside = isPointInPolygon(point, regionFeature.geometry.coordinates);
                    } else if (regionFeature.geometry.type === 'MultiPolygon') {
                        isInside = isPointInMultiPolygon(point, regionFeature.geometry.coordinates);
                    }

                    if (!isInside) continue;

                    // 2. Check elevation
                    const elevation = this.map?.queryTerrainElevation(point);

                    if (elevation !== null && elevation !== undefined) {
                        if (elevation >= band.minElev && elevation <= band.maxElev) {
                            features.push({
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: point
                                },
                                properties: {
                                    regionId: band.regionID,
                                    dangerLevel: band.dangerLevel,
                                    color: color,
                                    elevation: elevation
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

    private async generateGlobalPoints(bounds: { minLng: number, maxLng: number, minLat: number, maxLat: number }, minElev: number, maxElev: number, selectedAspects: string[]): Promise<any> {
        const features: any[] = [];

        // Dynamic grid spacing based on zoom
        const currentZoom = this.map!.getZoom();
        const baseSpacing = 0.005; // Approx 500m at zoom 8
        const baseZoom = 8;
        let GRID_SPACING_DEG = baseSpacing * Math.pow(1.5, baseZoom - currentZoom);

        // Clamp spacing
        GRID_SPACING_DEG = Math.max(GRID_SPACING_DEG, 0.0002);
        GRID_SPACING_DEG = Math.min(GRID_SPACING_DEG, 0.02);

        const mapBounds = this.map!.getBounds();

        // Intersect global bounds with map bounds
        const minLng = Math.max(bounds.minLng, mapBounds.getWest());
        const maxLng = Math.min(bounds.maxLng, mapBounds.getEast());
        const minLat = Math.max(bounds.minLat, mapBounds.getSouth());
        const maxLat = Math.min(bounds.maxLat, mapBounds.getNorth());

        // Skip if not visible
        if (minLng > maxLng || minLat > maxLat) {
            return {
                type: 'FeatureCollection',
                features: []
            };
        }

        for (let lng = minLng; lng <= maxLng; lng += GRID_SPACING_DEG) {
            for (let lat = minLat; lat <= maxLat; lat += GRID_SPACING_DEG) {
                const point: [number, number] = [lng, lat];
                const elevation = this.map?.queryTerrainElevation(point);

                if (elevation !== null && elevation !== undefined) {
                    if (elevation >= minElev && elevation <= maxElev) {
                        // Check aspect if specific aspects are selected
                        let aspect: string | null = null;
                        if (selectedAspects.length > 0) {
                            aspect = this.calculateAspect(point);
                            if (!aspect || !selectedAspects.includes(aspect)) {
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
                                color: '#0000FF', // Blue for custom mode
                                elevation: elevation,
                                aspect: aspect
                            }
                        });
                    }
                }
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    private calculateAspect(point: [number, number]): string | null {
        if (!this.map) return null;

        const [lng, lat] = point;
        const offset = 0.001; // Small offset for gradient calculation

        // Get elevations of surrounding points
        const z0 = this.map.queryTerrainElevation([lng, lat]);
        const zN = this.map.queryTerrainElevation([lng, lat + offset]);
        const zE = this.map.queryTerrainElevation([lng + offset, lat]);
        const zS = this.map.queryTerrainElevation([lng, lat - offset]);
        const zW = this.map.queryTerrainElevation([lng - offset, lat]);

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

    private getBounds(feature: any) {
        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;

        const processRing = (ring: number[][]) => {
            ring.forEach(coord => {
                const [lng, lat] = coord;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            });
        };

        if (feature.geometry.type === 'Polygon') {
            processRing(feature.geometry.coordinates[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((poly: any) => processRing(poly[0]));
        }

        return { minLng, maxLng, minLat, maxLat };
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
