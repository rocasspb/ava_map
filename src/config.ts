import * as maptiler from '@maptiler/sdk';

// Map Defaults
export const DEFAULT_CENTER: [number, number] = [11.6, 47.2];
export const DEFAULT_ZOOM = 9;
export const ZOOM_THRESHOLD_MODE_SWITCH = 11;
export const MAP_STYLE = maptiler.MapStyle.WINTER;
export const TERRAIN_SOURCE_URL_PREFIX = 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=';
export const TERRAIN_EXAGGERATION = 1;

export const MODES = {
    BULLETIN: 'bulletin',
    RISK: 'risk',
    CUSTOM: 'custom'
} as const;

export type VisualizationMode = typeof MODES[keyof typeof MODES];

export const MODE_LABELS: Record<VisualizationMode, string> = {
    [MODES.BULLETIN]: 'Bulletin',
    [MODES.RISK]: 'Risk',
    [MODES.CUSTOM]: 'Custom',
};

// Steepness Mode
export const STEEPNESS_THRESHOLDS = [
    { minSlope: 30, color: '#FFFF33', label: '> 30°' },
    { minSlope: 35, color: '#FF9900', label: '> 35°' },
    { minSlope: 40, color: '#FF0000', label: '> 40°' }
];

// Custom Mode
export const DEFAULT_CUSTOM_MIN_ELEV = 1500;
export const DEFAULT_CUSTOM_MAX_ELEV = 9000;

export const SLOPE_SLIDER_STEPS = [
    { value: 30, label: 'Steep', subLabel: '≥30°', color: '#F1C40F' }, // Yellow
    { value: 35, label: 'Very', subLabel: '≥35°', color: '#E67E22' }, // Orange
    { value: 40, label: 'Extr.', subLabel: '≥40°', color: '#E74C3C' }  // Red
];
export const DEFAULT_CUSTOM_MIN_SLOPE = SLOPE_SLIDER_STEPS[0].value;

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

export const OUTLINE_COLOR = '#000000';
export const OUTLINE_WIDTH = 0;
export const OUTLINE_OPACITY = 0.3;

// Grid
export const GRID_POINTS_DENSITY = 200;

// Bounds
// Approximate bounds for Euregio
// TODO to be removed as the coverage extends to the whole world
export const EUREGIO_BOUNDS = { minLng: -10.0, maxLng: 20.0, minLat: 35.0, maxLat: 60.0 };

// Data Processing
export const DEFAULT_MAX_ELEVATION = 9000;
export const TREELINE_ELEVATION = 1800; //this is a gap. Optimally, we need to find real tre line data for the place

// Calculations
export const SLOPE_CALCULATION_OFFSET = 0.0001;
export const METERS_PER_DEGREE = 111111;

// API
export const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
export const GA_MEASUREMENT_ID = 'G-BW5BE3CBCD';

export const DATA_REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
