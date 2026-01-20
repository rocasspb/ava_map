import * as maptiler from '@maptiler/sdk';
import type { CaamlData } from '../types/avalanche';
import { isPointInMultiPolygon, isPointInPolygon } from '../utils/geometry';
import { calculateTerrainMetrics } from '../utils/geo-utils';
import { MapPopup } from './MapPopup';
import { TerrainProvider } from '../services/TerrainProvider';

export class MapClickHandler {
    private map: maptiler.Map;
    private terrainProvider: TerrainProvider;
    private popup: MapPopup;
    private avalancheData: CaamlData | null = null;
    private regionsGeoJSON: any | null = null;

    constructor(map: maptiler.Map, terrainProvider: TerrainProvider, popup: MapPopup) {
        this.map = map;
        this.terrainProvider = terrainProvider;
        this.popup = popup;
    }

    public updateData(avalancheData: CaamlData | null, regionsGeoJSON: any | null) {
        this.avalancheData = avalancheData;
        this.regionsGeoJSON = regionsGeoJSON;
    }

    public async handleClick(e: any) {
        const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        let clickedRegionId: string | null = null;
        if (this.regionsGeoJSON && this.regionsGeoJSON.features) {
            for (const feature of this.regionsGeoJSON.features) {
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

        // Calculate terrain metrics for the clicked point
        let pointElevation: number | null = null;
        let pointSlope: number | null = null;
        let pointAspect: string | null = null;

        try {
            // Ensure tiles are fetched for the current view before querying
            const bounds = this.map.getBounds();
            await this.terrainProvider.fetchTiles(
                { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() },
                this.map.getZoom()
            );

            const getElevation = (p: [number, number]): number | null => {
                return this.terrainProvider.getElevation(p[0], p[1]);
            };

            pointElevation = getElevation(point);
            const metrics = calculateTerrainMetrics(point, getElevation);
            if (metrics) {
                pointSlope = metrics.slope;
                pointAspect = metrics.aspect;
            }
        } catch (err) {
            console.warn("Failed to calculate terrain metrics for popup", err);
        }

        if (!clickedRegionId) return;
        if (this.avalancheData && this.avalancheData.bulletins) {
            const bulletin = this.avalancheData.bulletins.find(b =>
                b.regions.some(r => r.regionID.startsWith(clickedRegionId!))
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
                    bulletinText: bulletinText,
                    pointElevation: pointElevation,
                    pointSlope: pointSlope,
                    pointAspect: pointAspect
                };

                this.popup.show(this.map, e.lngLat, properties);
            }
        }
    }
}
