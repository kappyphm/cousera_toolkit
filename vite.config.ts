import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// MV3: content + background + popup are separate entries.
// No bundling tricks — keep 1:1 module mapping with prototype logic.
export default defineConfig({
  plugins: [
    react(),
    // Copy unpacked-extension statics so dist/ loads directly.
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "welcome.html", dest: "." }
      ]
    })
  ],
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
