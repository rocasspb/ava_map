import * as maptiler from '@maptiler/sdk';
import { getDangerIcon, getProblemIcon, getProblemLabel } from '../utils/icons';
import { createAspectSVG } from '../utils/AspectGraphics';

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
        const danger = properties['dangerLevel'];
        const bulletinText = properties['bulletinText'];
        const avalancheProblemsProp = properties['avalancheProblems'];

        let html = `<div style="font-family: sans-serif; max-height: 400px; overflow-y: auto; padding-right: 5px;">`;

        if (regionId) {
            html += `<h3 style="margin: 0 0 4px 0;">Region: ${regionId}</h3>`;

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
                            let elevText = '';
                            if (p.elevation.lowerBound && p.elevation.upperBound) {
                                elevText = `${p.elevation.lowerBound}m - ${p.elevation.upperBound}m`;
                            } else if (p.elevation.lowerBound) {
                                elevText = `> ${p.elevation.lowerBound}m`;
                            } else if (p.elevation.upperBound) {
                                elevText = `< ${p.elevation.upperBound}m`;
                            }

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
}
