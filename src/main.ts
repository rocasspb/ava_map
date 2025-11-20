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
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
};

initApp();
