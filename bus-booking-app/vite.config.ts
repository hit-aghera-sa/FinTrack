import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The client build of Bus Booking App.
 *
 * `npm run build:app` passes `--outDir dist/client`, so the output directory is NOT set here: the
 * built client is `dist/client`, which is the only directory the server serves as static.
 *
 * In development `vite` serves the client and forwards every `/api` call to the Express server
 * started beside it (`PORT`, 3000 by default), so the dev app talks to the real API and the real
 * database rather than to demo data.
 */
const apiTarget = process.env.API_PROXY_TARGET ?? `http://127.0.0.1:${process.env.PORT ?? '3000'}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
