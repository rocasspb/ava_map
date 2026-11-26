import { defineConfig } from 'vite';
import path from 'path';

// `vite --mode linked` (npm run dev:linked) resolves the shared Wasm library from the sibling
// ava_android checkout's Gradle output instead of the published npm package.
// Override the location with LOCAL_SHARED_DIR if the repos are not side by side.
const defaultLocalSharedDir = path.resolve(
  __dirname,
  '../AvaAwaAnd/shared/build/dist/wasmJs/developmentLibrary'
);

export default defineConfig(({ mode }) => {
  const useLocalShared = mode === 'linked';
  const localSharedDir = process.env.LOCAL_SHARED_DIR ?? defaultLocalSharedDir;

  return {
    server: {
      fs: {
        allow: [
          // Allow serving files from the project root
          '.',
          ...(useLocalShared ? [localSharedDir] : [])
        ]
      }
    },
    resolve: {
      alias: useLocalShared
        ? { '@rocasspb/avaawa-shared': path.join(localSharedDir, 'AvaAwaAnd-shared.mjs') }
        : {}
    },
    optimizeDeps: {
      exclude: ['@rocasspb/avaawa-shared']
    }
  };
});
