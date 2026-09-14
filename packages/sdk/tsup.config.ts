import { defineConfig } from "tsup";

export default defineConfig({
  entry: { statify: "src/browser/index.ts" },
  format: ["iife"],
  globalName: "Statify",
  minify: true,
  clean: true,
  dts: false,
  sourcemap: false,
  outDir: "dist",
  noExternal: ["@statify/shared"],
});
