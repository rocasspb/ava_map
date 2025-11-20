import axios from 'axios';
import type { CaamlData } from '../types/avalanche';

const CAAML_URL = 'https://static.avalanche.report/bulletins/latest/EUREGIO_de_CAAMLv6.json';
const REGION_URLS = [
    'https://regions.avalanches.org/micro-regions/AT-02_micro-regions.geojson.json', // Tyrol
    'https://regions.avalanches.org/micro-regions/IT-32-BZ_micro-regions.geojson.json', // South Tyrol
    'https://regions.avalanches.org/micro-regions/IT-32-TN_micro-regions.geojson.json'  // Trentino
];

export class ApiService {
    static async getAvalancheData(): Promise<CaamlData> {
        try {
            const response = await axios.get<CaamlData>(CAAML_URL);
            return response.data;
        } catch (error) {
            console.error('Error fetching avalanche data:', error);
            throw error;
        }
    }

    static async getRegionsGeoJSON(): Promise<any> {
        try {
            const requests = REGION_URLS.map(url => axios.get(url));
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
