import axios from 'axios';
import type { CaamlData } from '../types/avalanche';
import { API_BASE_URL } from '../config';

export class ApiService {
    static async getAvalancheData(): Promise<CaamlData> {
        try {
            const response = await axios.get<CaamlData>(`${API_BASE_URL}/avalanche-data`);
            return response.data;
        } catch (error) {
            console.error('Error fetching avalanche data:', error);
            throw error;
        }
    }

    static async getRegionsGeoJSON(): Promise<any> {
        try {
            const response = await axios.get(`${API_BASE_URL}/regions`);
            return response.data;
        } catch (error) {
            console.error('Error fetching regions GeoJSON:', error);
            throw error;
        }
    }
}
