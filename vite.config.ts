import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    fs: {
      allow: [
        // Allow serving files from the project root
        '.'
      ]
    }
  },
  optimizeDeps: {
    exclude: ['AvaAwaAnd-shared']
  }
});
