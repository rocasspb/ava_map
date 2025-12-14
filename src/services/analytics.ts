import { GA_MEASUREMENT_ID } from '../config';

declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

export class AnalyticsService {
    private static initialized = false;

    static initialize() {
        if (this.initialized) return;

        // Inject Google Analytics script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);

        // Initialize dataLayer and gtag
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID);

        this.initialized = true;
        console.log('Analytics initialized with ID:', GA_MEASUREMENT_ID);
    }

    static trackEvent(eventName: string, params?: Record<string, any>) {
        if (!this.initialized) {
            console.warn('Analytics not initialized. Call initialize() first.');
            return;
        }

        window.gtag('event', eventName, params);
        // Log to console for development verification
        if (import.meta.env.DEV) {
            console.log(`[Analytics] Event: ${eventName}`, params);
        }
    }
}
