import axios from 'axios';
import type { CaamlData } from '../types/avalanche';
import { AVALANCHE_DATA_URL, REGION_GEOJSON_URLS } from '../config';

export class ApiService {
    static async getAvalancheData(): Promise<CaamlData> {
        try {
            const response = await axios.get<CaamlData>(AVALANCHE_DATA_URL);
            return response.data;
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
