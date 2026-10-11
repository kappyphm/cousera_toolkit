import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MV3: content + background + popup are separate entries.
// No bundling tricks — keep 1:1 module mapping with prototype logic.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: "popup.html",
        content: "src/content/main.ts",
        background: "src/background/sw.ts"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});
