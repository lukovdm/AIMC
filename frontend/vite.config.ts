import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL || "http://localhost:8000";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "AIMC – Markov Chain Editor",
          short_name: "AIMC",
          description:
            "Capture, annotate and simulate hand-drawn Markov chains",
          theme_color: "#1a1a2e",
          background_color: "#1a1a2e",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
        workbox: {
          // Cache app shell – do NOT cache camera/API calls
          globPatterns: ["**/*.{js,css,html,svg,woff2}"],
          navigateFallback: "index.html",
          runtimeCaching: [],
        },
      }),
    ],
    server: {
      proxy: {
        // Forward /api/* to the aimc backend during vite dev.
        // Override with: VITE_API_BASE_URL=http://localhost:8000 npm run dev
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
