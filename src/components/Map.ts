import * as maptiler from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import type { CaamlData, DangerRating } from '../types/avalanche';
import { processAvalancheData } from '../utils/data-processing';

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
            this.resolveMapLoaded();
        });
    }

    async renderAvalancheData(data: CaamlData, regionsGeoJSON: any) {
        await this.mapLoaded;
        if (!this.map) return;

        const regionDangerMap = processAvalancheData(data);

        // Add source
        this.map.addSource('regions', {
            type: 'geojson',
            data: regionsGeoJSON
        });

        // Add layer
        this.map.addLayer({
            id: 'regions-fill',
            type: 'fill',
            source: 'regions',
            paint: {
                'fill-color': [
                    'match',
                    ['get', 'id'], // GeoJSON property for region ID
                    ...this.buildColorExpression(regionDangerMap),
                    '#888888' // Default color
                ] as any,
                'fill-opacity': 0.7,
                'fill-outline-color': '#000000'
            }
        });

        // Add outline layer
        this.map.addLayer({
            id: 'regions-outline',
            type: 'line',
            source: 'regions',
            paint: {
                'line-color': '#000000',
                'line-width': 1
            }
        });

        // Add click event
        this.map.on('click', 'regions-fill', (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const regionId = feature.properties['id'];
                const danger = regionDangerMap.get(regionId);
                console.log('Clicked region:', regionId, danger);

                new maptiler.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`<h3>Region: ${regionId}</h3><p>Danger Level: ${danger?.mainValue || 'Unknown'}</p>`)
                    .addTo(this.map!);
            }
        });

        // Change cursor on hover
        this.map.on('mouseenter', 'regions-fill', () => {
            this.map!.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'regions-fill', () => {
            this.map!.getCanvas().style.cursor = '';
        });
    }

    private buildColorExpression(map: Map<string, DangerRating>): any[] {
        const expression: any[] = [];
        map.forEach((rating, regionId) => {
            expression.push(regionId);
            expression.push(this.getDangerColor(rating.mainValue));
        });
        return expression;
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
