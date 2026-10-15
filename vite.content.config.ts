import { defineConfig } from "vite";

/** Builds a self-contained classic content script for Manifest V3. */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/content/content-script.ts",
      formats: ["iife"],
      name: "AiPolyRatingsContent",
      fileName: () => "content-script.js",
    },
  },
});
