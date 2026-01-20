import { TERRAIN_RGB_BASE_URL } from '../config';

export class TerrainProvider {
    private tileCache = new Map<string, Uint8ClampedArray | null>();
    private apiKey: string;
    private currentTileZoom: number = 10; // Default

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Pre-fetches tiles for the given bounds to prepare for elevation queries.
     */
    async fetchTiles(
        bbox: { west: number, south: number, east: number, north: number },
        mapZoom: number
    ): Promise<void> {
        const zoom = Math.floor(mapZoom);
        this.currentTileZoom = Math.min(zoom + 2, 12);

        const [minTileX, minTileY] = this.lngLatToTile(bbox.west, bbox.north, this.currentTileZoom); // Top-Left
        const [maxTileX, maxTileY] = this.lngLatToTile(bbox.east, bbox.south, this.currentTileZoom); // Bottom-Right

        const tilesToFetch: { x: number, y: number }[] = [];
        for (let x = minTileX; x <= maxTileX; x++) {
            for (let y = minTileY; y <= maxTileY; y++) {
                tilesToFetch.push({ x, y });
            }
        }

        await Promise.all(tilesToFetch.map(async ({ x, y }) => {
            const key = `${this.currentTileZoom}/${x}/${y}`;

            if (this.tileCache.has(key)) return;

            const url = this.getTileUrl(x, y, this.currentTileZoom, this.apiKey);
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch tile ${url}`);
                const blob = await response.blob();
                const imgBitmap = await createImageBitmap(blob);

                // Draw to a temp canvas to get pixel data
                const offscreen = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
                const offCtx = offscreen.getContext('2d');
                if (offCtx) {
                    offCtx.drawImage(imgBitmap, 0, 0);
                    const tileData = offCtx.getImageData(0, 0, imgBitmap.width, imgBitmap.height).data;
                    this.tileCache.set(key, tileData);
                }
            } catch (e) {
                console.warn(`Error loading tile ${key}:`, e);
                this.tileCache.set(key, null);
            }
        }));
    }

    /**
     * Gets elevation using bilinear interpolation.
     * Assumes fetchTiles has been called for the area.
     */
    getElevation(lng: number, lat: number): number | null {
        // Get sub-pixel coordinates for interpolation
        const [tX, tY] = this.lngLatToTile(lng, lat, this.currentTileZoom);
        const [px, py] = this.getSubPixelCoordinates(lng, lat, tX, tY, this.currentTileZoom);

        // Top-left integer sample point
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);

        // Interpolation weights (dx, dy are in range [0, 1))
        const dx = px - x0;
        const dy = py - y0;

        const getValue = (tx: number, ty: number, x: number, y: number): number | null => {
            let targetTx = tx;
            let targetTy = ty;
            let targetX = x;
            let targetY = y;

            // Handle tile boundaries and wrapping for x (longitude)
            if (targetX >= 512) {
                targetTx += Math.floor(targetX / 512);
                targetX = targetX % 512;
            } else if (targetX < 0) {
                targetTx += Math.floor(targetX / 512);
                targetX = (targetX % 512 + 512) % 512;
            }

            // Handle tile boundaries for y (latitude)
            if (targetY >= 512) {
                targetTy += Math.floor(targetY / 512);
                targetY = targetY % 512;
            } else if (targetY < 0) {
                targetTy += Math.floor(targetY / 512);
                targetY = (targetY % 512 + 512) % 512;
            }

            if (targetX < 0) targetX = 0; // Fallback safety

            const key = `${this.currentTileZoom}/${targetTx}/${targetTy}`;
            const tileData = this.tileCache.get(key);
            if (!tileData) return null;

            const index = (targetY * 512 + targetX) * 4;
            if (index < 0 || index >= tileData.length) return null;

            // Use the util to decode RGB to meters
            return this.getElevationFromRgb(
                tileData[index],
                tileData[index + 1],
                tileData[index + 2]
            );
        };

        const h00 = getValue(tX, tY, x0, y0);
        const h10 = getValue(tX, tY, x0 + 1, y0);
        const h01 = getValue(tX, tY, x0, y0 + 1);
        const h11 = getValue(tX, tY, x0 + 1, y0 + 1);

        if (h00 === null || h10 === null || h01 === null || h11 === null) {
            return h00 ?? h10 ?? h01 ?? h11 ?? null;
        }

        // Bilinear interpolation formula
        const h0 = h00 * (1 - dx) + h10 * dx;
        const h1 = h01 * (1 - dx) + h11 * dx;
        return h0 * (1 - dy) + h1 * dy;
    }

    clearCache() {
        this.tileCache.clear();
    }

    // --- Helper Methods ---

    private lngLatToTile(lng: number, lat: number, zoom: number): [number, number] {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lng + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return [x, y];
    }

    private getTileUrl(x: number, y: number, z: number, apiKey: string): string {
        return `${TERRAIN_RGB_BASE_URL}/${z}/${x}/${y}.png?key=${apiKey}`;
    }

    private getSubPixelCoordinates(lng: number, lat: number, x: number, y: number, zoom: number): [number, number] {
        const n = Math.pow(2, zoom);
        const xRaw = (lng + 180) / 360 * n;
        const latRad = lat * Math.PI / 180;
        const yRaw = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

        const xRel = xRaw - x;
        const yRel = yRaw - y;

        return [xRel * 512, yRel * 512];
    }

    private getElevationFromRgb(r: number, g: number, b: number): number {
        return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
    }
}
