import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiPort = process.env.API_PORT ?? "3001";
const webPort = Number(process.env.WEB_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    port: webPort,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: webPort,
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**", "e2e/**", "**/*.spec.ts"],
    passWithNoTests: true,
  },
});
