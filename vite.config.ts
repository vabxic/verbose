import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    cors: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      external: [],
    },
  },
  esbuild: {
    logOverride: {
      'unsupported-css-property': 'silent',
    },
  },
});
