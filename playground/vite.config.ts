import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    alias: {
      "@cello/core": resolve(import.meta.dirname, "../src/index.ts"),
      "node:fs": resolve(import.meta.dirname, "src/shims/nodeFs.ts"),
      "node:path": resolve(import.meta.dirname, "src/shims/nodePath.ts")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
