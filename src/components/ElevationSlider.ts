
export class ElevationSlider {
    private container: HTMLElement;
    private minValue: number;
    private maxValue: number;
    private minSelect: number;
    private maxSelect: number;
    private onChange: ((min: number, max: number) => void) | null = null;

    private isDraggingMin: boolean = false;
    private isDraggingMax: boolean = false;

    constructor(containerId: string, min: number = 0, max: number = 4000) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container with id ${containerId} not found`);
        this.container = el;
        this.minValue = min;
        this.maxValue = max;

        // Initial defaults
        this.minSelect = 1000;
        this.maxSelect = 4000;

        this.initDOM();
        this.updateVisuals();
        this.addEventListeners();
    }

    public setOnChange(callback: (min: number, max: number) => void) {
        this.onChange = callback;
    }

    public getValues(): { min: number, max: number } {
        return { min: this.minSelect, max: this.maxSelect };
    }

    public setValues(min: number, max: number) {
        this.minSelect = Math.max(this.minValue, Math.min(max, min));
        this.maxSelect = Math.min(this.maxValue, Math.max(min, max));
        this.updateVisuals();
    }

    private initDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('elevation-slider-container');

        // Header
        const header = document.createElement('div');
        header.className = 'elevation-header';
        header.innerHTML = `
            <span class="popup-title">Elevation Band</span>
            <div class="elevation-values">
                <span id="elev-min-display">${this.minSelect}m</span> - <span id="elev-max-display">${this.maxSelect}m</span>
            </div>
        `;
        this.container.appendChild(header);

        // Slider Wrapper (for padding/margin)
        const wrapper = document.createElement('div');
        wrapper.className = 'elevation-slider-wrapper';

        // Track
        const trackContainer = document.createElement('div');
        trackContainer.className = 'elevation-track-container';

        const trackBg = document.createElement('div');
        trackBg.className = 'elevation-track-bg';

        const trackFill = document.createElement('div');
        trackFill.className = 'elevation-track-fill';

        // Thumbs
        const thumbMin = document.createElement('div');
        thumbMin.className = 'elevation-thumb elevation-thumb-min';

        const thumbMax = document.createElement('div');
        thumbMax.className = 'elevation-thumb elevation-thumb-max';

        trackContainer.appendChild(trackBg);
        trackContainer.appendChild(trackFill);
        trackContainer.appendChild(thumbMin);
        trackContainer.appendChild(thumbMax);

        wrapper.appendChild(trackContainer);

        // Labels
        const labels = document.createElement('div');
        labels.className = 'elevation-labels';

        const steps = [0, 1000, 2000, 3000];
        steps.forEach(step => {
            const label = document.createElement('div');
            label.className = 'elevation-label';
            const percent = ((step - this.minValue) / (this.maxValue - this.minValue)) * 100;
            label.style.left = `${percent}%`;
            label.innerText = step === 3000 ? '3000m+' : `${step}m`;
            labels.appendChild(label);
        });

        wrapper.appendChild(labels);
        this.container.appendChild(wrapper);
    }

    private positionToValue(clientX: number, rect: DOMRect): number {
        let percent = (clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        const rawValue = this.minValue + percent * (this.maxValue - this.minValue);
        // Snap to nearest 100m
        return Math.round(rawValue / 100) * 100;
    }

    private updateVisuals() {
        const thumbMin = this.container.querySelector('.elevation-thumb-min') as HTMLElement;
        const thumbMax = this.container.querySelector('.elevation-thumb-max') as HTMLElement;
        const trackFill = this.container.querySelector('.elevation-track-fill') as HTMLElement;
        const displayMin = this.container.querySelector('#elev-min-display');
        const displayMax = this.container.querySelector('#elev-max-display');

        if (!thumbMin || !thumbMax || !trackFill) return;

        const range = this.maxValue - this.minValue;
        const minPercent = ((this.minSelect - this.minValue) / range) * 100;
        const maxPercent = ((this.maxSelect - this.minValue) / range) * 100;

        thumbMin.style.left = `${minPercent}%`;
        thumbMax.style.left = `${maxPercent}%`;

        trackFill.style.left = `${minPercent}%`;
        trackFill.style.width = `${maxPercent - minPercent}%`;

        if (displayMin) displayMin.textContent = `${this.minSelect}m`;
        if (displayMax) displayMax.textContent = `${this.maxSelect}m`;
    }

    private addEventListeners() {
        const track = this.container.querySelector('.elevation-track-container') as HTMLElement;
        if (!track) return;

        const handleMove = (clientX: number) => {
            const rect = track.getBoundingClientRect();
            const val = this.positionToValue(clientX, rect);

            if (this.isDraggingMin) {
                // Ensure min doesn't cross max
                this.minSelect = Math.min(val, this.maxSelect - 100);
                this.minSelect = Math.max(this.minValue, this.minSelect);
            } else if (this.isDraggingMax) {
                // Ensure max doesn't cross min
                this.maxSelect = Math.max(val, this.minSelect + 100);
                this.maxSelect = Math.min(this.maxValue, this.maxSelect);
            }

            this.updateVisuals();

        };

        const thumbMin = this.container.querySelector('.elevation-thumb-min') as HTMLElement;
        const thumbMax = this.container.querySelector('.elevation-thumb-max') as HTMLElement;

        thumbMin.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isDraggingMin = true;
        });

        thumbMax.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.isDraggingMax = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingMin || this.isDraggingMax) {
                e.preventDefault();
                handleMove(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDraggingMin = false;
            this.isDraggingMax = false;
            if (this.onChange) this.onChange(this.minSelect, this.maxSelect);
        });

        // Touch support can be added similarly
        thumbMin.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            this.isDraggingMin = true;
        }, { passive: false });
        thumbMax.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            this.isDraggingMax = true;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.isDraggingMin || this.isDraggingMax) {
                e.preventDefault();
                handleMove(e.touches[0].clientX);
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            this.isDraggingMin = false;
            this.isDraggingMax = false;
            if (this.onChange) this.onChange(this.minSelect, this.maxSelect);
        });
    }
}
