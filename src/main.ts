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
        if (mode === config.MODES.BULLETIN) input.checked = true;

        if (config.DEFAULT_ZOOM < config.ZOOM_THRESHOLD_MODE_SWITCH && mode !== config.MODES.BULLETIN) {
          input.disabled = true;
          modeToggleContainer.classList.add('disabled-label');
        }

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.textContent = config.MODE_LABELS[mode];

        modeToggleContainer.appendChild(input);
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

      mapComponent.setCustomModeParams(min, max, aspects, minSlope);
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
          updateCustomMode();
          mapComponent.setMode(config.MODES.CUSTOM);
        } else if (mode === config.MODES.RISK) {
          customControls?.classList.add('hidden');
          mapComponent.setMode(config.MODES.RISK);
        } else {
          customControls?.classList.add('hidden');
          mapComponent.setMode(config.MODES.BULLETIN);
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

    // Initial tracking
    AnalyticsService.trackEvent('page_view');
    AnalyticsService.trackEvent('select_mode', { mode: config.MODES.BULLETIN });

    // Zoom-dependent logic
    const map = mapComponent.getMap();
    if (map) {
      let wasLowZoom = map.getZoom() < config.ZOOM_THRESHOLD_MODE_SWITCH;

      const handleZoomChange = () => {
        const zoom = map.getZoom();
        const isLowZoom = zoom < config.ZOOM_THRESHOLD_MODE_SWITCH;
        const modeRadios = document.querySelectorAll('input[name="mode"]') as NodeListOf<HTMLInputElement>;

        if (isLowZoom) {
          if (mapComponent.getMode() === config.MODES.BULLETIN) {
            return
          }
          console.log(`Low Zoom (<${config.ZOOM_THRESHOLD_MODE_SWITCH}): Forcing Bulletin Mode`);

          modeRadios.forEach(r => {
            if (r.value === config.MODES.BULLETIN) {
              r.checked = true;
              r.dispatchEvent(new Event('change'));
            } else {
              r.disabled = true;
              r.parentElement?.classList.add('disabled-label');
            }
          });
        } else {
          // High Zoom

          // Unlock Controls
          modeRadios.forEach(r => {
            r.disabled = false;
            r.parentElement?.classList.remove('disabled-label');
          });

          // Transition Logic: If coming from low zoom, enable Aspect and Steepness
          if (wasLowZoom) {
            console.log('Transition to High Zoom: Switching to Risk Mode');
            modeRadios.forEach(r => {
              if (r.value === config.MODES.RISK) {
                r.checked = true;
                r.dispatchEvent(new Event('change'));
              }
            });
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
