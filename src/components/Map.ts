import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData } from '../types/avalanche';
import { processRegionElevations } from '../utils/data-processing';

export class MapComponent {
    private map: maptiler.Map | null = null;
    private containerId: string;
    private mapLoaded: Promise<void>;
    private resolveMapLoaded!: () => void;

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

            this.resolveMapLoaded();
        });
    }

    async renderAvalancheData(data: CaamlData, regionsGeoJSON: any) {
        await this.mapLoaded;
        if (!this.map) return;

        const elevationBands = processRegionElevations(data);

        // Create a new FeatureCollection for the bands
        const bandsFeatures = {
            type: 'FeatureCollection' as const,
            features: [] as any[]
        };

        // Map regions by ID for easy lookup
        const regionsMap = new Map<string, any>();
        if (regionsGeoJSON.features) {
            regionsGeoJSON.features.forEach((f: any) => {
                regionsMap.set(f.properties.id, f);
            });
        }

        elevationBands.forEach(band => {
            const regionFeature = regionsMap.get(band.regionID);
            if (regionFeature) {
                // Clone feature and add elevation properties
                const bandFeature = JSON.parse(JSON.stringify(regionFeature));
                bandFeature.properties.min_elev = band.minElev;
                bandFeature.properties.max_elev = band.maxElev;
                bandFeature.properties.color = this.getDangerColor(band.dangerLevel);
                bandFeature.properties.dangerLevel = band.dangerLevel;
                bandsFeatures.features.push(bandFeature);
            }
        });

        // Add source
        this.map.addSource('avalanche-bands', {
            type: 'geojson',
            data: bandsFeatures
        });

        // Add fill-extrusion layer
        this.map.addLayer({
            id: 'avalanche-extrusion',
            type: 'fill-extrusion',
            source: 'avalanche-bands',
            paint: {
                'fill-extrusion-color': ['get', 'color'],
                'fill-extrusion-height': ['get', 'max_elev'],
                'fill-extrusion-base': ['get', 'min_elev'],
                'fill-extrusion-opacity': 0.6
            }
        });

        // Add outline layer (optional, maybe keep original regions for context?)
        // Let's keep the original regions outline but maybe thinner or different color
        this.map.addSource('regions-outline-source', {
            type: 'geojson',
            data: regionsGeoJSON
        });

        this.map.addLayer({
            id: 'regions-outline',
            type: 'line',
            source: 'regions-outline-source',
            paint: {
                'line-color': '#000000',
                'line-width': 1,
                'line-opacity': 0.3
            }
        });

        // Add click event
        this.map.on('click', 'avalanche-extrusion', (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const regionId = feature.properties['id'];
                const danger = feature.properties['dangerLevel'];
                const min = feature.properties['min_elev'];
                const max = feature.properties['max_elev'];

                new maptiler.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <h3>Region: ${regionId}</h3>
                        <p>Danger Level: ${danger}</p>
                        <p>Elevation: ${min}m - ${max}m</p>
                    `)
                    .addTo(this.map!);
            }
        });

        // Change cursor on hover
        this.map.on('mouseenter', 'avalanche-extrusion', () => {
            this.map!.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'avalanche-extrusion', () => {
            this.map!.getCanvas().style.cursor = '';
        });
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
