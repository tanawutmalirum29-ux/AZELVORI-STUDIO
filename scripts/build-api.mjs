import { build } from "esbuild";
import { rm } from "node:fs/promises";
await rm("services/api/dist", { recursive: true, force: true });
await build({
  entryPoints: ["services/api/src/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "services/api/dist/index.js",
  sourcemap: false,
});
