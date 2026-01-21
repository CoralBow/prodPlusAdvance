import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/conceptnet": {
        target: "https://api.conceptnet.io",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/conceptnet/, ""),
        headers: {
          "User-Agent": "vite-dev-proxy",
        },
      },
    },
  },
});
