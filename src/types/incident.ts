export interface IncidentData {
    id: number;
    date: string;
    time: string;
    location_name: string;
    region_id: number;
    aspect: string;
    elevation: number;
    avalanche_size: number;
    trigger_type: string;
    description: string;
    lat: number;
    lon: number;
    fatalities: number;
    injured: number;
    buried: number;
    caught: number;
    country: string;
    state: string;
    massif: string;
    slope_angle: number;
    snow_depth: number;
    weak_layer: string;
    activity: string;
}
