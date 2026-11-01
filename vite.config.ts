import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// MV3 entries: the background service worker and the side panel page
// (sidepanel.html, a real extension page with its own document). The
// content script keeps its own single-file build
// (vite.content.config.ts) — it must stay one classic script.
// No bundling tricks — keep 1:1 module mapping with prototype logic.
export default defineConfig({
  plugins: [
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
        background: "src/background/sw.ts",
        sidepanel: "sidepanel.html"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});
