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
    // Set the origin used for HMR and external preview hosts (Cloudflare preview)
    origin: "https://earn-held-assembled-jurisdiction.trycloudflare.com",
    hmr: {
      host: "earn-held-assembled-jurisdiction.trycloudflare.com",
      protocol: "wss",
      clientPort: 443,
    },
    proxy: {
      "/api": {
        target: "https://earn-held-assembled-jurisdiction.trycloudflare.com",
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
