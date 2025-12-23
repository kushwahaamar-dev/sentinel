import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  define: {
    global: "window",
    "process.env": {},
  },
  resolve: {
    alias: {
      // Required for @solana/web3.js in Vite 5
      buffer: "buffer/",
      process: "process/browser",
    },
  },
  optimizeDeps: {
    include: ["buffer", "process"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
