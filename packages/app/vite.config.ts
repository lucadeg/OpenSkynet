import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sediman/server": path.resolve(__dirname, "../server/src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_"],
  build: {
    target: "chrome105",
    minify: !process.env.DEBUG ? "esbuild" : false,
    sourcemaps: !!process.env.DEBUG,
  },
}));
