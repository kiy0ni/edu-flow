import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // En developpement, le front appelle /api et Vite relaie vers l'API.
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
