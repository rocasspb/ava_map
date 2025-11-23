import './style.css';
import { MapComponent } from './components/Map';
import { ApiService } from './services/api';

const initApp = async () => {
  const mapComponent = new MapComponent('map');
  mapComponent.initMap();

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
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const customControls = document.getElementById('custom-controls');
    const applyBtn = document.getElementById('apply-custom');
    const minInput = document.getElementById('min-elev') as HTMLInputElement;
    const maxInput = document.getElementById('max-elev') as HTMLInputElement;
    const minSlopeInput = document.getElementById('min-slope') as HTMLSelectElement;

    const aspectCheckboxes = document.querySelectorAll('input[name="aspect"]');

    const getSelectedAspects = () => {
      const aspects: string[] = [];
      aspectCheckboxes.forEach((cb) => {
        if ((cb as HTMLInputElement).checked) {
          aspects.push((cb as HTMLInputElement).value);
        }
      });
      return aspects;
    };

    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = (e.target as HTMLInputElement).value;
        if (mode === 'custom') {
          customControls?.classList.remove('hidden');
          const min = parseInt(minInput.value);
          const max = parseInt(maxInput.value);
          const minSlope = parseInt(minSlopeInput.value);
          const aspects = getSelectedAspects();
          mapComponent.setCustomMode(true, min, max, aspects, minSlope);
        } else {
          customControls?.classList.add('hidden');
          mapComponent.setCustomMode(false);
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
