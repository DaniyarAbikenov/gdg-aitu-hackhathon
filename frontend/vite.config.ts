import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: false } },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Core libraries change less often than app code; their chunks stay cached across releases.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (
            /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(
              id,
            )
          )
            return "react";
          if (/node_modules[\\/](@tanstack|axios|zustand)[\\/]/.test(id))
            return "data";
          if (/node_modules[\\/](i18next|react-i18next)[\\/]/.test(id))
            return "i18n";
          // UI libraries stay with the lazy pages that use them.
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
