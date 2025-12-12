import * as config from '../config';

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
        this.container.classList.add('aspect-selector-container'); // Renamed class for container

        // Header
        const header = document.createElement('div');
        header.className = 'aspect-header'; // Matches elevation-header style
        header.innerHTML = `
            <span class="popup-title">Aspects</span>
            <div class="aspect-values">
                <span id="aspect-display">All</span>
            </div>
        `;
        this.container.appendChild(header);

        const svgNS = "http://www.w3.org/2000/svg";
        const size = 200;
        const center = size / 2;
        const radius = 90;
        const innerRadius = 30; // Hole in the middle for labels or just style

        const svgWrapper = document.createElement('div');
        svgWrapper.style.display = 'flex';
        svgWrapper.style.justifyContent = 'center';

        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", "200"); // Fixed width for consistent look
        svg.setAttribute("height", "200");
        svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
        // Remove max-width/height styles that might shrink it too much

        const sectors = config.ASPECT_DIRECTIONS;
        const anglePerSector = 360 / sectors.length;
        // Rotate so North is at top (-90 degrees)
        // Sector 0 (N) should be centered at -90. So it goes from -90 - 22.5 to -90 + 22.5
        const startAngleOffset = -90 - (anglePerSector / 2);

        sectors.forEach((aspect, index) => {
            const startAngle = startAngleOffset + (index * anglePerSector);
            const endAngle = startAngle + anglePerSector;

            // Convert polar to cartesian
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);

            const x3 = center + innerRadius * Math.cos(endRad);
            const y3 = center + innerRadius * Math.sin(endRad);
            const x4 = center + innerRadius * Math.cos(startRad);
            const y4 = center + innerRadius * Math.sin(startRad);

            // Path definition
            const d = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 0 1 ${x2} ${y2}`,
                `L ${x3} ${y3}`,
                `A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}`,
                `Z`
            ].join(" ");

            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", d);
            path.setAttribute("class", "aspect-sector");
            path.setAttribute("data-aspect", aspect);
            if (this.selectedAspects.has(aspect)) {
                path.classList.add("selected");
            }

            // Add tooltip title
            const title = document.createElementNS(svgNS, "title");
            title.textContent = aspect;
            path.appendChild(title);

            path.addEventListener('click', () => this.toggleAspect(aspect));

            svg.appendChild(path);

            // Add Label
            const labelAngle = startAngle + (anglePerSector / 2);
            const labelRad = (labelAngle * Math.PI) / 180;
            const labelRadius = (radius + innerRadius) / 2;
            const lx = center + labelRadius * Math.cos(labelRad);
            const ly = center + labelRadius * Math.sin(labelRad);

            const text = document.createElementNS(svgNS, "text");
            text.setAttribute("x", lx.toString());
            text.setAttribute("y", ly.toString());
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("class", "aspect-label");
            text.style.pointerEvents = "none"; // Let clicks pass through to path
            text.textContent = aspect;

            svg.appendChild(text);
        });

        svgWrapper.appendChild(svg);
        this.container.appendChild(svgWrapper);
        this.updateVisuals(); // Ensure text is correct initially
    }
}
