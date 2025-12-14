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
      modeToggleContainer.innerHTML = '';
      modeToggleContainer.classList.add('segmented-control');

      Object.values(config.MODES).forEach(mode => {
        const inputId = `mode-${mode}`;

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'mode';
        input.id = inputId;
        input.value = mode;
        if (mode === config.MODES.AVALANCHE) input.checked = true;

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = config.MODE_LABELS[mode];

        modeToggleContainer.appendChild(input);
        modeToggleContainer.appendChild(label);
      });
    }

    const customControls = document.getElementById('custom-controls');
    const avalancheControls = document.getElementById('avalanche-controls');

    // Initialize Elevation Slider
    const elevationSlider = new ElevationSlider('elevation-slider', 0, 4000); // 0-4000m range

    const steepnessSlider = new SteepnessSlider('steepness-slider', config.DEFAULT_CUSTOM_MIN_SLOPE);

    // Initialize Avalanche Mode Controls
    const avalancheSteepnessSlider = new SteepnessSlider('avalanche-steepness-slider', 0);
    const useElevationCheckbox = document.getElementById('avalanche-use-elevation') as HTMLInputElement;
    const useAspectCheckbox = document.getElementById('avalanche-use-aspect') as HTMLInputElement;

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

      mapComponent.setCustomModeParams(min, max, aspects, minSlope);
    };

    const updateAvalancheConfig = () => {
      const useElevation = useElevationCheckbox.checked;
      const useAspect = useAspectCheckbox.checked;
      const minSlope = avalancheSteepnessSlider.getValue();
      mapComponent.setAvalancheConfig(useElevation, useAspect, minSlope);
    };

    elevationSlider.setOnChange(() => updateCustomMode());
    steepnessSlider.setOnChange(() => updateCustomMode());

    if (aspectSelector) {
      aspectSelector.setOnChange(() => updateCustomMode());
    }

    // Avalanche controls listeners
    useElevationCheckbox.addEventListener('change', updateAvalancheConfig);
    useAspectCheckbox.addEventListener('change', updateAvalancheConfig);
    avalancheSteepnessSlider.setOnChange(() => updateAvalancheConfig());

    const modeRadios = document.querySelectorAll('input[name="mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value;

        if (mode === config.MODES.CUSTOM) {
          customControls?.classList.remove('hidden');
          avalancheControls?.classList.add('hidden');
          updateCustomMode();
          mapComponent.setMode(config.MODES.CUSTOM);
        } else if (mode === config.MODES.STEEPNESS) {
          customControls?.classList.add('hidden');
          avalancheControls?.classList.add('hidden');
          mapComponent.setMode(config.MODES.STEEPNESS);
        } else {
          customControls?.classList.add('hidden');
          avalancheControls?.classList.remove('hidden');
          updateAvalancheConfig();
          mapComponent.setMode(config.MODES.AVALANCHE);
        }
      });
    });

    // Mobile Drawer Toggle
    const controlsToggle = document.getElementById('controls-toggle');
    const controls = document.getElementById('controls');

    if (controlsToggle && controls) {
      controlsToggle.addEventListener('click', () => {
        controls.classList.toggle('collapsed');
      });
    }

    // Initialize with default state
    if (document.querySelector(`input[name="mode"][value="${config.MODES.AVALANCHE}"]:checked`)) {
      avalancheControls?.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
