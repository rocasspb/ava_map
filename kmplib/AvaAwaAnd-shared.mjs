
import { instantiate } from './AvaAwaAnd-shared.uninstantiated.mjs';
import "./custom-formatters.js"

const exports = (await instantiate({
})).exports;

export const {
isPointInPolygonWasm,
calculateTerrainMetricsWasm,
generateRasterWasm,
memory,
_initialize
} = exports


