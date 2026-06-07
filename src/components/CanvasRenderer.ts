import * as maptiler from '@maptiler/sdk';
import type { GenerationRule } from '../types/GenerationRule';
import { TerrainProvider } from '../services/TerrainProvider';
import { RasterBridge } from '../services/RasterBridge';

export class CanvasRenderer {
    private readonly map: maptiler.Map;
    private readonly canvas: HTMLCanvasElement;
    private terrainProvider: TerrainProvider;

    constructor(
        map: maptiler.Map,
        canvas: HTMLCanvasElement,
        terrainProvider: TerrainProvider
    ) {
        this.map = map;
        this.canvas = canvas;
        this.terrainProvider = terrainProvider;
    }

    async draw(rules: GenerationRule[]): Promise<{ coordinates: [[number, number], [number, number], [number, number], [number, number]] } | null> {
        if (!this.map || !this.canvas) return null;

        const bounds = this.map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        try {
            await this.terrainProvider.fetchTiles(
                { west, south, east, north },
                this.map.getZoom()
            );
        } catch (e) {
            console.error("Failed to fetch terrain tiles", e);
            return null;
        }

        const raster = await RasterBridge.generateRaster(
            rules,
            { minLng: west, maxLng: east, minLat: south, maxLat: north },
            (lng, lat) => this.terrainProvider.getElevation(lng, lat)
        );

        if (!raster) return null;

        const { width, height, pixels } = raster;

        this.canvas.width = width;
        this.canvas.height = height;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return null;

        ctx.clearRect(0, 0, width, height);

        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (let i = 0; i < pixels.length; i++) {
            const pixel = pixels[i];
            // KMP returns ARGB (0xAARRGGBB)
            const a = (pixel >> 24) & 0xFF;
            const r = (pixel >> 16) & 0xFF;
            const g = (pixel >> 8) & 0xFF;
            const b = pixel & 0xFF;
            
            const index = i * 4;
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = a;
        }

        ctx.putImageData(imgData, 0, 0);

        // Return coordinates that match the map bounds
        return {
            coordinates: [
                [west, north],
                [east, north],
                [east, south],
                [west, south]
            ]
        };
    }
}
