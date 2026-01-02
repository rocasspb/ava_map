import './style.css';
import { MapComponent } from './components/Map';
import * as config from './config';
import { AspectSelector } from './components/AspectSelector';
import { SteepnessSlider } from './components/SteepnessSlider';
import { ElevationSlider } from './components/ElevationSlider';
import { AnalyticsService } from './services/analytics';
import matrixImg from './img/matrix.png';

const initApp = async () => {
  AnalyticsService.initialize();

  const mapComponent = new MapComponent('map');

  // Apply UI colors from config
  document.documentElement.style.setProperty('--primary-btn-color', config.UI_COLORS.PRIMARY_BUTTON);
  document.documentElement.style.setProperty('--primary-btn-hover-color', config.UI_COLORS.PRIMARY_BUTTON_HOVER);
  document.documentElement.style.setProperty('--input-text-color', config.UI_COLORS.INPUT_TEXT);
  document.documentElement.style.setProperty('--bg-color', config.UI_COLORS.BACKGROUND);

  try {
    await mapComponent.initMap();

    // UI Controls
    const updateModeUI = (mode: config.VisualizationMode) => {
      // Update Selection State
      document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
        if ((card as HTMLElement).dataset.mode === mode) {
          card.classList.add('selected');
        }
      });
    };

    const handleModeChange = (mode: config.VisualizationMode) => {
      // Update Map Mode
      if (mode === config.MODES.CUSTOM) {
        customControls?.classList.remove('hidden');
        riskControls?.classList.add('hidden');
        updateCustomMode();
        mapComponent.setMode(config.MODES.CUSTOM);
      } else if (mode === config.MODES.RISK) {
        customControls?.classList.add('hidden');
        riskControls?.classList.remove('hidden');
        mapComponent.setMode(config.MODES.RISK);
      } else {
        customControls?.classList.add('hidden');
        riskControls?.classList.add('hidden');
        mapComponent.setMode(config.MODES.BULLETIN);
      }

      updateModeUI(mode);
      AnalyticsService.trackEvent('select_mode', { mode });
    };

    // Mode Card Click Handlers
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        if (target.hasAttribute('disabled')) return;

        const mode = target.dataset.mode as config.VisualizationMode;
        if (Object.values(config.MODES).includes(mode)) {
          handleModeChange(mode);
        }
      });
    });

    const customControls = document.getElementById('custom-controls');
    const riskControls = document.getElementById('risk-controls');
    const riskMatrixImg = document.getElementById('risk-matrix-img') as HTMLImageElement;

    if (riskMatrixImg) {
      riskMatrixImg.src = matrixImg;
    }

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

    // Mobile Drawer Toggle
    const controlsToggle = document.getElementById('controls-toggle');
    const controls = document.getElementById('controls');

    if (controlsToggle && controls) {
      controlsToggle.addEventListener('click', () => {
        controls.classList.toggle('collapsed');
      });
    }

    // 3D/2D Toggle
    const togglePitchBtn = document.getElementById('toggle-pitch');
    if (togglePitchBtn) {
      togglePitchBtn.addEventListener('click', () => {
        const map = mapComponent.getMap();
        if (map) {
          const currentPitch = map.getPitch();
          if (currentPitch < 30) {
            map.easeTo({ pitch: 60 });
            togglePitchBtn.textContent = '2D';
          } else {
            map.easeTo({ pitch: 0 });
            togglePitchBtn.textContent = '3D';
          }
        }
      });
    }

    // Initial tracking
    AnalyticsService.trackEvent('page_view');
    AnalyticsService.trackEvent('select_mode', { mode: config.MODES.BULLETIN });
    updateModeUI(config.MODES.BULLETIN);

    // Zoom-dependent logic
    const map = mapComponent.getMap();
    if (map) {
      let wasLowZoom = map.getZoom() < config.ZOOM_THRESHOLD_MODE_SWITCH;

      const handleZoomChange = () => {
        const zoom = map.getZoom();
        const isLowZoom = zoom < config.ZOOM_THRESHOLD_MODE_SWITCH;
        const modeCards = document.querySelectorAll('.mode-card');

        if (isLowZoom) {
          if (mapComponent.getMode() === config.MODES.BULLETIN) {
            // Ensure UI lock is visual
            modeCards.forEach(card => {
              const mode = (card as HTMLElement).dataset.mode;
              if (mode !== config.MODES.BULLETIN) {
                card.setAttribute('disabled', 'true');
              }
            });
            return
          }
          console.log(`Low Zoom (<${config.ZOOM_THRESHOLD_MODE_SWITCH}): Forcing Bulletin Mode`);

          handleModeChange(config.MODES.BULLETIN);

          modeCards.forEach(card => {
            const mode = (card as HTMLElement).dataset.mode;
            if (mode !== config.MODES.BULLETIN) {
              card.setAttribute('disabled', 'true');
            }
          });

        } else {
          // High Zoom
          // Unlock Controls
          modeCards.forEach(card => {
            card.removeAttribute('disabled');
          });

          // Transition Logic: If coming from low zoom, enable Aspect and Steepness
          if (wasLowZoom) {
            console.log('Transition to High Zoom: Switching to Risk Mode');
            handleModeChange(config.MODES.RISK);
          }
        }
        wasLowZoom = isLowZoom;
      };

      // Run once on init
      handleZoomChange();

      map.on('zoomend', handleZoomChange);
    }

    // Disclaimer Modal
    const disclaimerModal = document.getElementById('disclaimer-modal');
    const acceptBtn = document.getElementById('disclaimer-accept-btn');
    const STORAGE_KEY = 'disclaimer_accepted';

    // Check if disclaimer was already accepted
    if (!localStorage.getItem(STORAGE_KEY)) {
      disclaimerModal?.classList.remove('hidden');
    }

    acceptBtn?.addEventListener('click', () => {
      disclaimerModal?.classList.add('hidden');
      localStorage.setItem(STORAGE_KEY, 'true');
    });

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
