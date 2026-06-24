import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed dev-server port and ignores its own folder for HMR.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Prevent Vite from clobbering Rust compiler errors in the terminal.
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Tauri sources are watched by the Rust side, not Vite.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce a build Tauri can bundle.
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
});
