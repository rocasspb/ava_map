import axios from 'axios';
import { AVALANCHE_DATA_URLS, REGION_GEOJSON_URLS, REFRESH_INTERVAL_MS } from './config';
import type { CaamlData } from '../src/types/avalanche';

interface Cache<T> {
    data: T | null;
    lastFetchTime: number;
}

class DataService {
    private avalancheCache: Cache<CaamlData> = { data: null, lastFetchTime: 0 };
    private regionsCache: Cache<any> = { data: null, lastFetchTime: 0 };

    async getAvalancheData(): Promise<CaamlData> {
        if (this.shouldRefresh(this.avalancheCache)) {
            console.log('Refreshing avalanche data...');
            await this.refreshAvalancheData();
        }
        if (!this.avalancheCache.data) {
            throw new Error('No avalanche data available');
        }
        return this.avalancheCache.data;
    }

    async getRegions(): Promise<any> {
        if (this.shouldRefresh(this.regionsCache)) {
            console.log('Refreshing regions data...');
            await this.refreshRegions();
        }
        if (!this.regionsCache.data) {
            throw new Error('No regions data available');
        }
        return this.regionsCache.data;
    }

    private shouldRefresh(cache: Cache<any>): boolean {
        return !cache.data || (Date.now() - cache.lastFetchTime > REFRESH_INTERVAL_MS);
    }

    private async refreshAvalancheData() {
        try {
            const requests = AVALANCHE_DATA_URLS.map(url => axios.get<CaamlData>(url));
            const results = await Promise.allSettled(requests);

            const successfulResponses = results
                .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
                .map(result => result.value);

            if (successfulResponses.length === 0) {
                throw new Error('All bulletin sources failed to load.');
            }

            const mergedData: CaamlData = successfulResponses[0].data;
            for (let i = 1; i < successfulResponses.length; i++) {
                if (successfulResponses[i].data.bulletins) {
                    mergedData.bulletins.push(...successfulResponses[i].data.bulletins);
                }
            }

            this.avalancheCache = {
                data: mergedData,
                lastFetchTime: Date.now()
            };
            console.log('Avalanche data refreshed.');
        } catch (error) {
            console.error('Error refreshing avalanche data:', error);
            throw error;
        }
    }

    private async refreshRegions() {
        try {
            const requests = REGION_GEOJSON_URLS.map(url => axios.get(url));
            const responses = await Promise.all(requests);

            const features = responses.flatMap(res => res.data.features);
            const mergedGeoJSON = {
                type: 'FeatureCollection',
                features: features
            };

            this.regionsCache = {
                data: mergedGeoJSON,
                lastFetchTime: Date.now()
            };
            console.log('Regions data refreshed.');
        } catch (error) {
            console.error('Error refreshing regions data:', error);
            throw error;
        }
    }

    async initialize() {
        console.log('Initializing data service...');
        await Promise.all([
            this.refreshAvalancheData(),
            this.refreshRegions()
        ]).catch(err => console.error('Initialization failed (will retry on request):', err));
    }
}

export const dataService = new DataService();
