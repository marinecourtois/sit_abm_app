import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("katex")) return "katex";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("d3-")) return "d3";
          if (/react-dom|react-router|scheduler|\/react\//.test(id)) return "react";
        },
      },
    },
  },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8765" } },
});
