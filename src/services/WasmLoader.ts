/**
 * WasmLoader handles the initialization and access to the KMP Wasm module.
 */
export class WasmLoader {
    private static instance: any = null;
    private static loadingPromise: Promise<any> | null = null;

    /**
     * Loads and initializes the Wasm module if not already loaded.
     */
    static async getInstance(): Promise<any> {
        if (this.instance) return this.instance;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = (async () => {
            try {
                // Import from the local npm package
                const module = await import('AvaAwaAnd-shared');
                
                this.instance = module;
                console.log('KMP Wasm module loaded successfully');
                return this.instance;
            } catch (error) {
                console.error('Failed to load KMP Wasm module:', error);
                throw error;
            }
        })();

        return this.loadingPromise;
    }
}
