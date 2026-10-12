import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Read the contracts source directly: the browser bundle gets
      // tree-shaken ESM instead of the CommonJS build the API consumes.
      '@courtly/contracts': fileURLToPath(
        new URL('../../packages/contracts/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    // Same origin as in Docker, where nginx forwards /api to the API.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
