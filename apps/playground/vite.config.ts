import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    alias: {
      "@cello/core": resolve(import.meta.dirname, "../../packages/core/src/index.ts"),
      "@cello/editor-core": resolve(import.meta.dirname, "../../packages/editor-core/src/index.ts"),
      "@cello/editor-react/styles.css": resolve(import.meta.dirname, "../../packages/editor-react/src/styles.css"),
      "@cello/editor-react": resolve(import.meta.dirname, "../../packages/editor-react/src/index.ts"),
      "@nachoggodino/cello/editor-core": resolve(import.meta.dirname, "../../packages/editor-core/src/index.ts"),
      "node:fs": resolve(import.meta.dirname, "src/shims/nodeFs.ts"),
      "node:path": resolve(import.meta.dirname, "src/shims/nodePath.ts")
    }
  },
  build: {
    outDir: "dist",
    manifest: true,
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/hyperformula/")) {
            return "spreadsheet";
          }
          return undefined;
        }
      }
    }
  }
});
