# Avalanche Awareness Map
A tool to assess avalanche terrain, based on the slope parameters and regional avalanche forecast.

![Avalanche danger](src/docs/img/bulletins.png)
![Slope steepness](src/docs/img/readme_img.png)

## Features

- **Avalanche Risk Visualization**: Fetches and displays real-time avalanche danger levels from official bulletins. The data factors avalanche danger, based not only on the region, but also on the aspect and elevation.
- **Steepness Mode**: Color-coded visualization of terrain steepness to identify potential avalanche terrain (>30°, >35°, >40°).
- **Custom Analysis Mode**: Interactive tools to filter terrain based on:
  - Elevation range (min/max)
  - Slope angle
  - Aspect 
- **Dynamic Rendering**: Efficient point-based rendering with dynamic grid spacing that adjusts to zoom levels.

## Tech Stack

- **Framework**: [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Map Engine**: [MapTiler SDK](https://docs.maptiler.com/sdk-js/)
- **Data Fetching**: Axios
- **Data Sources**: 
  - Avalanche Bulletins: [avalanche.report](https://avalanche.report)
  - Region Boundaries: [regions.avalanches.org](https://regions.avalanches.org)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- A MapTiler API Key (configure in `src/main.ts` or `.env` if applicable)

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

## Configuration

Key application settings can be found in `src/config.ts`, including:
- Map defaults (center, zoom)
- Visualization colors and thresholds
- Grid generation parameters
- API endpoints
