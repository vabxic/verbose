import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    allowedHosts: ["rubber-beings-muze-shades.trycloudflare.com"],
    proxy: {
      "/api": {
        target: "https://rubber-beings-muze-shades.trycloudflare.com",
        changeOrigin: true,
        secure: false,
      },
    },
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
