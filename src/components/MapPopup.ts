import * as maptiler from '@maptiler/sdk';
import { getDangerIcon, getProblemIcon, getProblemLabel } from '../utils/icons';
import { createAspectSVG } from '../utils/AspectGraphics';
import {DANGER_LEVEL_VALUES} from "../config.ts";

export class MapPopup {
    private popup: maptiler.Popup;

    constructor() {
        this.popup = new maptiler.Popup({
            className: 'avalanche-popup',
            maxWidth: 'none'
        });
    }

    show(map: maptiler.Map, lngLat: maptiler.LngLatLike, properties: any) {
        const content = this.generateContent(properties);
        this.popup
            .setLngLat(lngLat)
            .setHTML(content)
            .addTo(map);
    }

    private generateContent(properties: any): string {
        const regionId = properties['regionId'];
        const dangerRatings = properties['dangerRatings'];
        const danger = properties['dangerLevel'];
        const bulletinText = properties['bulletinText'];
        const avalancheProblemsProp = properties['avalancheProblems'];

        const pointElevation = properties['pointElevation'];
        const pointSlope = properties['pointSlope'];
        const pointAspect = properties['pointAspect'];

        let html = `<div style="font-family: sans-serif; max-height: 400px; overflow-y: auto; padding-right: 5px;">`;

        if (regionId) {
            html += `<h3 style="margin: 0 0 4px 0;">Region: ${regionId}</h3>`;
        }

        if (pointElevation != null || pointSlope != null || pointAspect != null) {
            html += `<div style="margin-bottom: 8px; font-size: 0.9em; background: #f5f5f5; padding: 5px; border-radius: 4px; display: flex; justify-content: space-around;">`;
            
            if (pointElevation != null) {
                html += `<div><strong>Elev:</strong> ${Math.round(pointElevation)}m</div>`;
            }
            if (pointSlope != null) {
                html += `<div><strong>Slope:</strong> ${Math.round(pointSlope)}°</div>`;
            }
            if (pointAspect != null) {
                html += `<div><strong>Aspect:</strong> ${pointAspect}</div>`;
            }
            html += `</div>`;
        }

        if (dangerRatings && Array.isArray(dangerRatings) && dangerRatings.length > 0) {
            html += `<div style="margin-bottom: 8px;"><strong>Danger Ratings:</strong>`;
            dangerRatings
                .sort((a, b) => DANGER_LEVEL_VALUES[b.mainValue] - DANGER_LEVEL_VALUES[a.mainValue])
                .forEach((rating: any) => {

                    const level = rating.mainValue;
                    const icon = getDangerIcon(level);

                    html += `<div style="display: flex; align-items: center; margin-top: 4px; border-bottom: 1px solid #eee; padding-bottom: 4px;">`;

                    if (icon) {
                        html += `<img src="${icon}" alt="${level}" style="height: 30px; margin-right: 8px;">`;
                    }

                    html += `<div>`;
                    html += `<div><strong>Level: ${level}</strong></div>`;

                    if (rating.elevation) {
                        const elevText = this.formatElevationRange(rating.elevation);
                        if (elevText) {
                            html += `<div style="font-size: 0.85em;">Elevation: ${elevText}</div>`;
                        }
                    }

                    if (rating.validAspects && rating.validAspects.length > 0) {
                         html += `<div style="margin-top: 2px;">${createAspectSVG(new Set(rating.validAspects), { size: 30 }).outerHTML}</div>`;
                    }

                    html += `</div></div>`;
            });
            html += `</div>`;
        } else if (danger) {
            const dangerIcon = getDangerIcon(danger);
            html += `<div style="display: flex; align-items: center; margin-bottom: 4px;">`;
            if (dangerIcon) {
                html += `<img src="${dangerIcon}" alt="${danger}" style="height: 40px; margin-right: 10px;">`;
            }
            html += `<strong>Danger Level: ${danger}</strong></div>`;
        }


        if (avalancheProblemsProp) {
            try {
                let problems = avalancheProblemsProp;
                if (typeof problems === 'string') {
                    problems = JSON.parse(problems);
                }

                if (Array.isArray(problems) && problems.length > 0) {
                    html += `<div style="margin-top: 4px;"><strong>Avalanche Problems:</strong><ul style="padding-left: 20px; margin: 2px 0; list-style-type: none;">`;
                    problems.forEach((p: any) => {
                        const problemIcon = getProblemIcon(p.problemType);
                        const problemLabel = getProblemLabel(p.problemType);

                        html += `<li style="display: flex; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 4px;">`;

                        if (problemIcon) {
                            html += `<div style="flex-shrink: 0;">`;
                            html += `<img src="${problemIcon}" alt="${problemLabel}" style="height: 50px; width: auto;">`;
                            html += `</div>`;
                        }
                        html += `<div style="display: flex; align-items: center; margin-top: 2px; margin-right: 12px;">
                            ${createAspectSVG(new Set(p.aspects), { size: 50 }).outerHTML}
                            </div>`;

                        html += `<div style="flex-grow: 1;">`;
                        html += `<div><strong>${problemLabel}</strong></div>`;

                        html += `<div style="font-size: 0.85em; color: #333; line-height: 1.2;">`;

                        // Elevation
                        if (p.elevation) {
                            let elevText = this.formatElevationRange(p.elevation);

                            if (elevText) {
                                html += `<div>Elevation: ${elevText}</div>`;
                            }
                        }


                        // Frequency
                        if (p.frequency) {
                            html += `<div>Frequency: ${p.frequency}</div>`;
                        }

                        // Size
                        if (p.avalancheSize) {
                            html += `<div>Size: ${p.avalancheSize}</div>`;
                        }

                        html += `</div></div></li>`;
                    });
                    html += `</ul></div>`;
                }
            } catch (e) {
                console.error("Error parsing avalanche problems", e);
            }
        }

        if (bulletinText) {
            html += `<div style="margin-bottom: 4px; font-style: italic; font-size: 0.9em; border-left: 3px solid #ccc; padding-left: 8px;">
                        ${bulletinText}
                     </div>`;
        }

        html += `</div>`;
        return html;
    }
    private formatElevationRange(elevation: { lowerBound?: string, upperBound?: string }): string {
        const formatVal = (val: string) => {
            return /^\d+$/.test(val) ? `${val}m` : val;
        };

        if (elevation.lowerBound && elevation.upperBound) {
            return `${formatVal(elevation.lowerBound)} - ${formatVal(elevation.upperBound)}`;
        } else if (elevation.lowerBound) {
            return `> ${formatVal(elevation.lowerBound)}`;
        } else if (elevation.upperBound) {
            return `< ${formatVal(elevation.upperBound)}`;
        }
        return '';
    }
}
