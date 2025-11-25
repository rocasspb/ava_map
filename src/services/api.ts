import axios from 'axios';
import type { CaamlData } from '../types/avalanche';
import { AVALANCHE_DATA_URLS, REGION_GEOJSON_URLS } from '../config';

export class ApiService {
    static async getAvalancheData(): Promise<CaamlData> {
        try {
            const requests = AVALANCHE_DATA_URLS.map(url => axios.get<CaamlData>(url));
            const results = await Promise.allSettled(requests);

            const successfulResponses = results
                .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
                .map(result => result.value);

            const failedResults = results
                .filter((result): result is PromiseRejectedResult => result.status === 'rejected');

            if (failedResults.length > 0) {
                console.warn(`Failed to load ${failedResults.length} bulletin source(s).`);
                failedResults.forEach(failure => console.error(failure.reason));
            }

            if (successfulResponses.length === 0) {
                throw new Error('All bulletin sources failed to load.');
            }

            // Merge all bulletins into a single CaamlData object
            // We'll use the first response as the base and append bulletins from others
            const mergedData: CaamlData = successfulResponses[0].data;

            for (let i = 1; i < successfulResponses.length; i++) {
                if (successfulResponses[i].data.bulletins) {
                    mergedData.bulletins.push(...successfulResponses[i].data.bulletins);
                }
            }

            return mergedData;
        } catch (error) {
            console.error('Error fetching avalanche data:', error);
            throw error;
        }
    }

    static async getRegionsGeoJSON(): Promise<any> {
        try {
            const requests = REGION_GEOJSON_URLS.map(url => axios.get(url));
            const responses = await Promise.all(requests);

            // Merge FeatureCollections
            const features = responses.flatMap(res => res.data.features);
            return {
                type: 'FeatureCollection',
                features: features
            };
        } catch (error) {
            console.error('Error fetching regions GeoJSON:', error);
            throw error;
        }
    }
}
