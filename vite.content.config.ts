import { defineConfig } from "vite";

// Separate single-entry build for the MV3 content script.
// A content script is injected as a CLASSIC script: any static ESM `import`
// of a shared chunk (e.g. rolldown-runtime.js from a multi-entry build) is a
// parse error that silently kills the whole script — no logs, no message
// listener ("Could not establish connection. Receiving end does not exist").
// Single input => Rolldown emits one self-contained assets/content.js.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        content: "src/content/main.ts"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]"
      }
    }
  }
});
