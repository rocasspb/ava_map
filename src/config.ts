import * as maptiler from '@maptiler/sdk';

// Map Defaults
export const DEFAULT_CENTER: [number, number] = [11.6, 47.2];
export const DEFAULT_ZOOM = 8;
export const MAP_STYLE = maptiler.MapStyle.WINTER;
export const TERRAIN_SOURCE_URL_PREFIX = 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=';
export const TERRAIN_EXAGGERATION = 1;

export const MODES = {
    AVALANCHE: 'avalanche',
    CUSTOM: 'custom',
    STEEPNESS: 'steepness'
} as const;

export type VisualizationMode = typeof MODES[keyof typeof MODES];

export const MODE_LABELS: Record<VisualizationMode, string> = {
    [MODES.AVALANCHE]: 'Avalanche Risk',
    [MODES.STEEPNESS]: 'Steepness',
    [MODES.CUSTOM]: 'Custom',
};

// Grid Generation
export const GRID_BASE_SPACING = 0.01; // at base zoom
export const GRID_BASE_ZOOM = 8;
export const GRID_DENSITY_FACTOR = 1.8; // spacing decreases by this factor per zoom level diff
export const GRID_MIN_SPACING = 0.0002; // ~20m
export const GRID_MAX_SPACING = 0.05;

// Steepness Mode
export const STEEPNESS_THRESHOLDS = [
    { minSlope: 30, color: '#FFFF33', label: '> 30°' },
    { minSlope: 35, color: '#FF9900', label: '> 35°' },
    { minSlope: 40, color: '#FF0000', label: '> 40°' }
];

// Custom Mode
export const CUSTOM_MODE_COLOR = '#0000FF';
export const DEFAULT_CUSTOM_MIN_ELEV = 1500;
export const DEFAULT_CUSTOM_MAX_ELEV = 9000;
export const DEFAULT_CUSTOM_MIN_SLOPE = 0;

export const SLOPE_OPTIONS = [
    { value: 0, label: 'Flat (> 0°)' },
    { value: 10, label: 'Moderate (> 10°)' },
    { value: 30, label: 'Steep (> 30°)' },
    { value: 35, label: 'Very Steep (> 35°)' },
    { value: 40, label: 'Extreme (> 40°)' }
];

export const SLOPE_SLIDER_STEPS = [
    { value: 0, label: 'Mod.', subLabel: '<30°', color: '#2ECC71' }, // Green
    { value: 30, label: 'Steep', subLabel: '≥30°', color: '#F1C40F' }, // Yellow
    { value: 35, label: 'Very', subLabel: '≥35°', color: '#E67E22' }, // Orange
    { value: 40, label: 'Extr.', subLabel: '≥40°', color: '#E74C3C' }  // Red
];

export const ASPECT_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Avalanche Danger Colors
export const DANGER_COLORS: Record<string, string> = {
    'low': '#CCFF66',          // 1 - Green
    'moderate': '#FFFF33',     // 2 - Yellow
    'considerable': '#FF9900', // 3 - Orange
    'high': '#FF0000',         // 4 - Red
    'very_high': '#A60000',    // 5 - Dark Red
    'default': '#888888'
};

export const UI_COLORS = {
    PRIMARY_BUTTON: '#007bff',
    PRIMARY_BUTTON_HOVER: '#0056b3',
    INPUT_TEXT: '#666666',
    BACKGROUND: '#ffffff'
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
export const OUTLINE_WIDTH = 0;
export const OUTLINE_OPACITY = 0.3;

// Bounds
// Approximate bounds for Euregio
// TODO to be removed as the coverage extends to the whole world
export const EUREGIO_BOUNDS = { minLng: -10.0, maxLng: 20.0, minLat: 35.0, maxLat: 60.0 };

// Data Processing
export const DEFAULT_MAX_ELEVATION = 9000;

// Calculations
export const ASPECT_CALCULATION_OFFSET = 0.0001;
export const SLOPE_CALCULATION_OFFSET = 0.0001;
export const METERS_PER_DEGREE = 111111;

// API
export const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';

// Deprecated: Moved to backend
// export const AVALANCHE_DATA_URLS = [ ... ];
// export const REGION_GEOJSON_URLS = [ ... ];

