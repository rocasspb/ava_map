import './style.css';
import { MapComponent } from './components/Map';
import { ApiService } from './services/api';
import * as config from './config';
import { AspectSelector } from './components/AspectSelector';
import { SteepnessSlider } from './components/SteepnessSlider';
import { ElevationSlider } from './components/ElevationSlider';
import { AnalyticsService } from './services/analytics';

const initApp = async () => {
  AnalyticsService.initialize();

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


    const useAspectCheckbox = document.getElementById('avalanche-use-aspect') as HTMLInputElement;
    const applySteepnessCheckbox = document.getElementById('avalanche-apply-steepness') as HTMLInputElement;

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
      // const useElevation = true; // No longer needed
      const useAspect = useAspectCheckbox.checked;
      const applySteepness = applySteepnessCheckbox.checked;
      mapComponent.setAvalancheConfig(useAspect, applySteepness);
    };

    elevationSlider.setOnChange(() => updateCustomMode());
    steepnessSlider.setOnChange(() => updateCustomMode());

    if (aspectSelector) {
      aspectSelector.setOnChange(() => updateCustomMode());
    }

    // Avalanche controls listeners

    useAspectCheckbox.addEventListener('change', updateAvalancheConfig);
    applySteepnessCheckbox.addEventListener('change', updateAvalancheConfig);

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
        AnalyticsService.trackEvent('select_mode', { mode });
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

    if (document.querySelector(`input[name="mode"][value="${config.MODES.AVALANCHE}"]:checked`)) {
      avalancheControls?.classList.remove('hidden');
    }

    // Initial tracking
    AnalyticsService.trackEvent('page_view');
    AnalyticsService.trackEvent('select_mode', { mode: config.MODES.AVALANCHE });

    // Zoom-dependent logic
    const map = mapComponent.getMap();
    if (map) {
      let wasLowZoom = map.getZoom() < config.ZOOM_THRESHOLD_MODE_SWITCH;

      const handleZoomChange = () => {
        const zoom = map.getZoom();
        const isLowZoom = zoom < config.ZOOM_THRESHOLD_MODE_SWITCH;

        // UI Elements

        const useAspectCheckbox = document.getElementById('avalanche-use-aspect') as HTMLInputElement;
        const applySteepnessCheckbox = document.getElementById('avalanche-apply-steepness') as HTMLInputElement;

        const modeRadios = document.querySelectorAll('input[name="mode"]') as NodeListOf<HTMLInputElement>;

        if (isLowZoom) {
          console.log(`Low Zoom (<${config.ZOOM_THRESHOLD_MODE_SWITCH}): Forcing Avalanche Mode & Elevation Only`);

          // 1. Force Avalanche Mode
          mapComponent.setMode(config.MODES.AVALANCHE);

          // Update UI Radio
          const avRadio = document.querySelector(`input[name="mode"][value="${config.MODES.AVALANCHE}"]`) as HTMLInputElement;
          if (avRadio) avRadio.checked = true;

          // Show avalanche controls, hide others
          const customControls = document.getElementById('custom-controls');
          const avalancheControls = document.getElementById('avalanche-controls');
          customControls?.classList.add('hidden');
          avalancheControls?.classList.remove('hidden');

          // 2. Force Config: (Elevation always ON implicitly), others OFF
          // We set the component state but also need to update UI checkboxes to match
          mapComponent.setAvalancheConfig(false, false);


          if (useAspectCheckbox) { useAspectCheckbox.checked = false; useAspectCheckbox.disabled = true; }
          if (applySteepnessCheckbox) { applySteepnessCheckbox.checked = false; applySteepnessCheckbox.disabled = true; }

          // Disable Mode Radios (except Avalanche, effectively locking it)
          modeRadios.forEach(r => {
            if (r.value !== config.MODES.AVALANCHE) {
              r.disabled = true;
              r.parentElement?.classList.add('disabled-label'); // Optional styling
            }
          });

        } else {
          // High Zoom

          // Unlock Controls

          if (useAspectCheckbox) useAspectCheckbox.disabled = false;
          if (applySteepnessCheckbox) applySteepnessCheckbox.disabled = false;

          modeRadios.forEach(r => {
            r.disabled = false;
            r.parentElement?.classList.remove('disabled-label');
          });

          // Transition Logic: If coming from low zoom, enable Aspect and Steepness
          if (wasLowZoom) {
            console.log('Transition to High Zoom: Enabling Aspect & Steepness');

            // Turn ON Aspect and Steepness
            // Ensure Elevation is also ON (it was forced ON, but good to ensure)
            mapComponent.setAvalancheConfig(true, true);


            if (useAspectCheckbox) useAspectCheckbox.checked = true;
            if (applySteepnessCheckbox) applySteepnessCheckbox.checked = true;
          }
        }

        wasLowZoom = isLowZoom;
      };

      // Run once on init (wait a tick for map to be ready-ready if needed, but synchronous should work for initial state if zoom is set)
      // Actually map load might be async for zoom? Config default is 8. So it starts < 10.
      handleZoomChange();

      map.on('zoomend', handleZoomChange);
    }

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
