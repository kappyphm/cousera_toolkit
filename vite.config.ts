import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// MV3: the background service worker is the only entry here. The
// toolbar popup was retired in favor of the in-page sidebar, which
// ships inside the content bundle (vite.content.config.ts).
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
