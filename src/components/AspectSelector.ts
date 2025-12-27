import * as config from '../config';
import { createAspectSVG } from '../utils/AspectGraphics';

export class AspectSelector {
    private container: HTMLElement;
    private selectedAspects: Set<string>;

    private onChange: ((selected: string[]) => void) | null = null;

    constructor(containerId: string, initialAspects: string[] = []) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container with id ${containerId} not found`);
        this.container = el;
        this.selectedAspects = new Set(initialAspects.length > 0 ? initialAspects : config.ASPECT_DIRECTIONS);
        this.render();
    }

    public setOnChange(callback: (selected: string[]) => void) {
        this.onChange = callback;
    }

    public getSelectedAspects(): string[] {
        return Array.from(this.selectedAspects);
    }

    private toggleAspect(aspect: string) {
        if (this.selectedAspects.has(aspect)) {
            this.selectedAspects.delete(aspect);
        } else {
            this.selectedAspects.add(aspect);
        }
        this.updateVisuals();
        if (this.onChange) {
            this.onChange(this.getSelectedAspects());
        }
    }

    private updateVisuals() {
        const sectors = this.container.querySelectorAll('.aspect-sector');
        sectors.forEach(sector => {
            const aspect = sector.getAttribute('data-aspect');
            if (aspect && this.selectedAspects.has(aspect)) {
                sector.classList.add('selected');
            } else {
                sector.classList.remove('selected');
            }
        });

        const display = this.container.querySelector('#aspect-display');
        if (display) {
            const count = this.selectedAspects.size;
            if (count === 0) display.textContent = 'None';
            else if (count === config.ASPECT_DIRECTIONS.length) display.textContent = 'All';
            else display.textContent = this.getSelectedAspects().join(', ');
        }
    }

    private render() {
        this.container.innerHTML = '';
        this.container.classList.add('aspect-selector-container');

        // Header
        const header = document.createElement('div');
        header.className = 'aspect-header';
        header.innerHTML = `
            <span class="popup-title">Aspects</span>
            <div class="aspect-values">
                <span id="aspect-display">All</span>
            </div>
        `;
        this.container.appendChild(header);

        const svgWrapper = document.createElement('div');
        svgWrapper.style.display = 'flex';
        svgWrapper.style.justifyContent = 'center';

        const svg = createAspectSVG(this.selectedAspects, {
            size: 200,
            interactive: true,
            onClick: (aspect) => this.toggleAspect(aspect)
        });

        svgWrapper.appendChild(svg);
        this.container.appendChild(svgWrapper);
        this.updateVisuals();
    }
}
