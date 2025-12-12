import './style.css';
import { MapComponent } from './components/Map';
import { ApiService } from './services/api';
import * as config from './config';
import { AspectSelector } from './components/AspectSelector';
import { SteepnessSlider } from './components/SteepnessSlider';
import { ElevationSlider } from './components/ElevationSlider';

const initApp = async () => {
  const mapComponent = new MapComponent('map');
  mapComponent.initMap();

  // Apply UI colors from config
  document.documentElement.style.setProperty('--primary-btn-color', config.UI_COLORS.PRIMARY_BUTTON);
  document.documentElement.style.setProperty('--primary-btn-hover-color', config.UI_COLORS.PRIMARY_BUTTON_HOVER);
  document.documentElement.style.setProperty('--input-text-color', config.UI_COLORS.INPUT_TEXT);
  document.documentElement.style.setProperty('--bg-color', config.UI_COLORS.BACKGROUND);

  try {
    console.log('Fetching avalanche data...');
    const [avalancheData, regionsGeoJSON] = await Promise.all([
      ApiService.getAvalancheData(),
      ApiService.getRegionsGeoJSON()
    ]);

    console.log('Avalanche Data:', avalancheData);
    console.log('Regions GeoJSON:', regionsGeoJSON);

    await mapComponent.renderAvalancheData(avalancheData, regionsGeoJSON);

    // UI Controls
    const modeToggleContainer = document.querySelector('.mode-toggle');
    if (modeToggleContainer) {
      modeToggleContainer.innerHTML = '';
      Object.values(config.MODES).forEach(mode => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'mode';
        input.value = mode;
        if (mode === config.MODES.AVALANCHE) input.checked = true;

        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${config.MODE_LABELS[mode]}`));
        modeToggleContainer.appendChild(label);
      });
    }

    const customControls = document.getElementById('custom-controls');

    // Initialize Elevation Slider
    const elevationSlider = new ElevationSlider('elevation-slider', 0, 4000); // 0-4000m range

    const steepnessSlider = new SteepnessSlider('steepness-slider', config.DEFAULT_CUSTOM_MIN_SLOPE);

    let aspectSelector: AspectSelector | null = null;
    const aspectContainer = document.getElementById('aspect-circle-container');
    if (aspectContainer) {
      aspectSelector = new AspectSelector('aspect-circle-container');
    }

    const getSelectedAspects = () => {
      return aspectSelector ? aspectSelector.getSelectedAspects() : [];
    };

    const updateCustomMode = () => {
      const { min, max } = elevationSlider.getValues();
      const aspects = getSelectedAspects();
      const minSlope = steepnessSlider.getValue();

      mapComponent.setCustomMode(true, min, max, aspects, minSlope);
    };

    elevationSlider.setOnChange(() => updateCustomMode());
    steepnessSlider.setOnChange(() => updateCustomMode());

    if (aspectSelector) {
      aspectSelector.setOnChange(() => updateCustomMode());
    }

    const modeRadios = document.querySelectorAll('input[name="mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value;

        if (mode === config.MODES.CUSTOM) {
          customControls?.classList.remove('hidden');
          // Trigger custom mode update with current values
          updateCustomMode();
        } else if (mode === config.MODES.STEEPNESS) {
          customControls?.classList.add('hidden');
          mapComponent.setSteepnessMode(true);
        } else {
          customControls?.classList.add('hidden');
          mapComponent.setCustomMode(false); // This switches back to avalanche
        }
      });
    });

    // applyBtn listener removed

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
