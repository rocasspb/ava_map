import * as config from '../config';

export class SteepnessSlider {
    private container: HTMLElement;
    private steps: typeof config.SLOPE_SLIDER_STEPS;
    private currentValue: number;
    private onChange: ((value: number) => void) | null = null;
    private isDragging: boolean = false;

    constructor(containerId: string, initialValue: number = 0) {
        const el = document.getElementById(containerId);
        if (!el) throw new Error(`Container with id ${containerId} not found`);
        this.container = el;
        this.steps = config.SLOPE_SLIDER_STEPS;
        this.currentValue = initialValue;

        this.initDOM();
        this.updateVisuals();
        this.addEventListeners();
    }

    public setOnChange(callback: (value: number) => void) {
        this.onChange = callback;
    }

    public getValue(): number {
        return this.currentValue;
    }

    private initDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('steepness-slider-container');

        // Header
        const header = document.createElement('div');
        header.style.marginBottom = '10px';
        header.innerHTML = `<span class="popup-title">Min Slope Steepness</span>`;
        this.container.appendChild(header);

        // Labels Row
        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'slider-labels';

        // Track Container
        const trackContainer = document.createElement('div');
        trackContainer.className = 'slider-track-container';

        const trackBg = document.createElement('div');
        trackBg.className = 'slider-track-bg';

        const trackFill = document.createElement('div');
        trackFill.className = 'slider-track-fill';

        // Steps (Dots)
        this.steps.forEach((step, index) => {
            const percent = (index / (this.steps.length - 1)) * 100;

            // Dot
            const dot = document.createElement('div');
            dot.className = 'slider-step-dot';
            dot.style.left = `${percent}%`;
            dot.dataset.value = step.value.toString();
            // Store styling logic for updateVisuals, or better just structure here

            // Label Group
            const labelGroup = document.createElement('div');
            labelGroup.className = 'slider-label-group';
            labelGroup.style.left = `${percent}%`;

            const mainLabel = document.createElement('div');
            mainLabel.className = 'slider-label-main';
            mainLabel.textContent = step.label;
            mainLabel.dataset.value = step.value.toString();

            const subLabel = document.createElement('div');
            subLabel.className = 'slider-label-sub';
            subLabel.textContent = step.subLabel;

            labelGroup.appendChild(mainLabel);
            labelGroup.appendChild(subLabel);
            labelsContainer.appendChild(labelGroup);
            trackContainer.appendChild(dot);
        });

        // Thumb
        const thumb = document.createElement('div');
        thumb.className = 'slider-thumb';

        trackContainer.appendChild(trackBg);
        trackContainer.appendChild(trackFill);
        trackContainer.appendChild(thumb);

        this.container.appendChild(trackContainer);
        this.container.appendChild(labelsContainer);
    }

    private updateVisuals() {
        const thumb = this.container.querySelector('.slider-thumb') as HTMLElement;
        const trackFill = this.container.querySelector('.slider-track-fill') as HTMLElement;
        if (!thumb || !trackFill) return;

        const currentStepIndex = this.steps.findIndex(s => s.value === this.currentValue);
        const percent = (currentStepIndex / (this.steps.length - 1)) * 100;

        // Move Thumb and Fill
        thumb.style.left = `${percent}%`;
        trackFill.style.width = `${percent}%`;

        // Colors
        const currentStep = this.steps.find(s => s.value === this.currentValue);
        if (currentStep) {
            thumb.style.borderColor = currentStep.color;
            trackFill.style.background = currentStep.color;
        }

        // Update Dots and Labels
        const dots = this.container.querySelectorAll('.slider-step-dot');
        dots.forEach(dot => {
            const val = Number((dot as HTMLElement).dataset.value);
            const dotStep = this.steps.find(s => s.value === val);
            if (dotStep && val <= this.currentValue) {
                (dot as HTMLElement).style.backgroundColor = dotStep.color;
            } else {
                (dot as HTMLElement).style.backgroundColor = 'white';
            }
        });

        const labels = this.container.querySelectorAll('.slider-label-main');
        labels.forEach(lbl => {
            const val = Number((lbl as HTMLElement).dataset.value);
            const lblStep = this.steps.find(s => s.value === val);
            if (lblStep && val === this.currentValue) {
                (lbl as HTMLElement).style.color = lblStep.color;
                (lbl as HTMLElement).style.fontWeight = 'bold';
            } else {
                (lbl as HTMLElement).style.color = '#888';
                (lbl as HTMLElement).style.fontWeight = 'normal';
            }
        });
    }

    private updateValue(value: number) {
        if (this.currentValue !== value) {
            this.currentValue = value;
            this.updateVisuals();
            if (this.onChange) {
                this.onChange(this.currentValue);
            }
        }
    }

    private addEventListeners() {
        const track = this.container.querySelector('.slider-track-container') as HTMLElement;
        if (!track) return;

        const handleInteraction = (clientX: number) => {
            const rect = track.getBoundingClientRect();
            let percent = (clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));

            // Find nearest step
            const stepCount = this.steps.length;
            const index = Math.round(percent * (stepCount - 1));
            const step = this.steps[index];

            this.updateValue(step.value);
        };

        track.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            handleInteraction(e.clientX);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                e.preventDefault(); // Prevent text selection
                handleInteraction(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Touch support
        track.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            handleInteraction(e.touches[0].clientX);
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                handleInteraction(e.touches[0].clientX);
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // Click on labels
        const labelGroups = this.container.querySelectorAll('.slider-label-group');
        labelGroups.forEach((label, index) => {
            label.addEventListener('click', () => {
                this.updateValue(this.steps[index].value);
            });
        });
    }
}
