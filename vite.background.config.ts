import { defineConfig } from "vite";

/** Builds the Manifest V3 background service worker as an ES module. */
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/background/service-worker.ts",
      formats: ["es"],
      fileName: () => "service-worker.js",
    },
  },
});
