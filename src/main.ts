import './style.css';
import { MapComponent } from './components/Map';
import { ApiService } from './services/api';
import * as config from './config';

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
    const applyBtn = document.getElementById('apply-custom');
    const minInput = document.getElementById('min-elev') as HTMLInputElement;
    const maxInput = document.getElementById('max-elev') as HTMLInputElement;
    const minSlopeInput = document.getElementById('min-slope') as HTMLSelectElement;

    // Initialize inputs with defaults from config
    if (minInput) minInput.value = config.DEFAULT_CUSTOM_MIN_ELEV.toString();
    if (maxInput) maxInput.value = config.DEFAULT_CUSTOM_MAX_ELEV.toString();

    if (minSlopeInput) {
      minSlopeInput.innerHTML = '';
      config.SLOPE_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value.toString();
        option.textContent = opt.label;
        minSlopeInput.appendChild(option);
      });
      minSlopeInput.value = config.DEFAULT_CUSTOM_MIN_SLOPE.toString();
    }

    const aspectContainer = document.querySelector('.aspect-grid');
    if (aspectContainer) {
      aspectContainer.innerHTML = '';
      config.ASPECT_DIRECTIONS.forEach(dir => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'aspect';
        checkbox.value = dir;
        checkbox.checked = true; // Default to checked
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${dir}`));
        aspectContainer.appendChild(label);
      });
    }

    const getSelectedAspects = () => {
      const aspects: string[] = [];
      document.querySelectorAll('input[name="aspect"]:checked').forEach((cb) => {
        aspects.push((cb as HTMLInputElement).value);
      });
      return aspects;
    };

    const modeRadios = document.querySelectorAll('input[name="mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value;

        if (mode === config.MODES.CUSTOM) {
          customControls?.classList.remove('hidden');
          // Trigger custom mode update with current values
          const min = Number((document.getElementById('min-elev') as HTMLInputElement).value);
          const max = Number((document.getElementById('max-elev') as HTMLInputElement).value);
          const aspects = getSelectedAspects();
          const minSlope = Number((document.getElementById('min-slope') as HTMLSelectElement).value);

          mapComponent.setCustomMode(true, min, max, aspects, minSlope);
        } else if (mode === config.MODES.STEEPNESS) {
          customControls?.classList.add('hidden');
          mapComponent.setSteepnessMode(true);
        } else {
          customControls?.classList.add('hidden');
          mapComponent.setCustomMode(false); // This switches back to avalanche
        }
      });
    });

    applyBtn?.addEventListener('click', () => {
      const min = parseInt(minInput.value);
      const max = parseInt(maxInput.value);
      const minSlope = parseInt(minSlopeInput.value);
      const aspects = getSelectedAspects();
      mapComponent.setCustomMode(true, min, max, aspects, minSlope);
    });

  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
