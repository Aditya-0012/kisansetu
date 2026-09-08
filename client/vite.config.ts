import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@kisansetu/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "KisanSetu — Farm to Market Network",
        short_name: "KisanSetu",
        description: "India's intelligent direct farm-to-market network.",
        theme_color: "#1F4D36",
        background_color: "#FAF7F0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // App-shell caching only — orders/payments/escrow always require a
        // live connection (spec: "never pretend critical financial
        // transactions can complete offline").
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/offline.html",
        runtimeCaching: [
          {
            urlPattern: /\/api\/(listings|prices|forecast)/,
            handler: "NetworkFirst",
            options: { cacheName: "kisansetu-read-cache", expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
