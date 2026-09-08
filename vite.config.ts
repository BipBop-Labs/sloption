import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/web" },
  server: {
    strictPort: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.BACKEND_URL ?? "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
});
