import danger1 from '../img/Icon-Avalanche-Danger-Level-Dry-Snow-1-EAWS.png';
import danger2 from '../img/Icon-Avalanche-Danger-Level-Dry-Snow-2-EAWS.png';
import danger3 from '../img/Icon-Avalanche-Danger-Level-Dry-Snow-3-EAWS.png';
import danger4_5 from '../img/Icon-Avalanche-Danger-Level-Dry-Snow-4-5-EAWS.png';
import dangerNone from '../img/Icon-Avalanche-Danger-Level-No-Rating-EAWS.png';

import problemCornices from '../img/Icon-Avalanche-Problem-Cornices.jpg';
import problemGlidingSnow from '../img/Icon-Avalanche-Problem-Gliding-Snow-EAWS.jpg';
import problemNewSnow from '../img/Icon-Avalanche-Problem-New-Snow-EAWS.jpg';
import problemNoDistinct from '../img/Icon-Avalanche-Problem-No-Distinct-Avalanche-Problem-EAWS.jpg';
import problemPersistentWeak from '../img/Icon-Avalanche-Problem-Persistent-Weak-Layer-EAWS.jpg';
import problemWindSlab from '../img/Icon-Avalanche-Problem-Wind-Slab-EAWS.jpg';
import problemWetSnow from '../img/Icon-Avalanche-Wet-Snow-EAWS.jpg';

export const DANGER_ICONS: Record<string, string> = {
    'low': danger1,
    'moderate': danger2,
    'considerable': danger3,
    'high': danger4_5,
    'very_high': danger4_5,
    'no_rating': dangerNone
};

// Mapping based on standard EAWS problem types (often used in CAAML)
// Keys should match what comes from the API/data processing
export const PROBLEM_ICONS: Record<string, string> = {
    'new_snow': problemNewSnow,
    'wind_slab': problemWindSlab,
    'persistent_weak_layers': problemPersistentWeak,
    'gliding_snow': problemGlidingSnow,
    'wet_snow': problemWetSnow,
    'cornices': problemCornices,
    'no_distinct_avalanche_problem': problemNoDistinct,
    // Fallbacks or alternative naming conventions
    'new snow': problemNewSnow,
    'wind slab': problemWindSlab,
    'persistent weak layers': problemPersistentWeak,
    'gliding snow': problemGlidingSnow,
    'wet snow': problemWetSnow,
    'no distinct avalanche problem': problemNoDistinct
};

export const PROBLEM_LABELS: Record<string, string> = {
    'new_snow': 'New Snow',
    'wind_slab': 'Wind Slab',
    'persistent_weak_layers': 'Persistent Weak Layers',
    'gliding_snow': 'Gliding Snow',
    'wet_snow': 'Wet Snow',
    'cornices': 'Cornices',
    'no_distinct_avalanche_problem': 'No Distinct Avalanche Problem',
    // Fallbacks
    'new snow': 'New Snow',
    'wind slab': 'Wind Slab',
    'persistent weak layers': 'Persistent Weak Layers',
    'gliding snow': 'Gliding Snow',
    'wet snow': 'Wet Snow',
    'no distinct avalanche problem': 'No Distinct Avalanche Problem'
};

export function getDangerIcon(level: string): string {
    const key = level.toLowerCase().replace(' ', '_');
    return DANGER_ICONS[key] || DANGER_ICONS['no_rating'];
}

export function getProblemIcon(problemType: string): string {
    const key = problemType.toLowerCase();
    // Try exact match first, then replace spaces with underscores
    if (PROBLEM_ICONS[key]) return PROBLEM_ICONS[key];

    const keyUnderscore = key.replace(/ /g, '_');
    return PROBLEM_ICONS[keyUnderscore] || '';
}

export function getProblemLabel(problemType: string): string {
    const key = problemType.toLowerCase();
    if (PROBLEM_LABELS[key]) return PROBLEM_LABELS[key];

    // Fallback: replace underscores with spaces and capitalize words
    return problemType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
