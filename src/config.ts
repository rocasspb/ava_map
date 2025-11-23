import * as maptiler from '@maptiler/sdk';

// Map Defaults
export const DEFAULT_CENTER: [number, number] = [11.3, 46.5];
export const DEFAULT_ZOOM = 8;
export const MAP_STYLE = maptiler.MapStyle.OUTDOOR;
export const TERRAIN_SOURCE_URL_PREFIX = 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=';
export const TERRAIN_EXAGGERATION = 1;

// Grid Generation
export const GRID_BASE_SPACING = 0.02; // at base zoom
export const GRID_BASE_ZOOM = 8;
export const GRID_DENSITY_FACTOR = 1.5; // spacing decreases by this factor per zoom level diff
export const GRID_MIN_SPACING = 0.0001; // ~10m
export const GRID_MAX_SPACING = 0.01;   // ~1km

// Steepness Mode
export const STEEPNESS_THRESHOLDS = [
    { minSlope: 30, color: '#FFFF33', label: '> 30°' },
    { minSlope: 35, color: '#FF9900', label: '> 35°' },
    { minSlope: 40, color: '#FF0000', label: '> 40°' }
];

// Custom Mode
export const CUSTOM_MODE_COLOR = '#0000FF';
export const DEFAULT_CUSTOM_MIN_ELEV = 0;
export const DEFAULT_CUSTOM_MAX_ELEV = 9000;
export const DEFAULT_CUSTOM_MIN_SLOPE = 0;

// Avalanche Danger Colors
export const DANGER_COLORS: Record<string, string> = {
    'low': '#CCFF66',          // 1 - Green
    'moderate': '#FFFF33',     // 2 - Yellow
    'considerable': '#FF9900', // 3 - Orange
    'high': '#FF0000',         // 4 - Red
    'very_high': '#A60000',    // 5 - Dark Red
    'default': '#888888'
};

export const DANGER_LEVEL_VALUES: Record<string, number> = {
    'low': 1,
    'moderate': 2,
    'considerable': 3,
    'high': 4,
    'very_high': 5
};

// Visuals
export const POINT_OPACITY = 0.6;
// Interpolation for circle radius: [zoom, radius]
export const POINT_RADIUS_STOPS = [
    [8, 2],
    [12, 5],
    [15, 10]
];

export const OUTLINE_COLOR = '#000000';
export const OUTLINE_WIDTH = 1;
export const OUTLINE_OPACITY = 0.3;

// Bounds
// Approximate bounds for Euregio
export const EUREGIO_BOUNDS = { minLng: 10.0, maxLng: 13.0, minLat: 45.5, maxLat: 47.5 };

// Data Processing
export const DEFAULT_MAX_ELEVATION = 9000;
