import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "../public",
  root: "android-web",
  build: {
    emptyOutDir: true,
    outDir: "../dist-android",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
