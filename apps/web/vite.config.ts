import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    react(),
    {
      name: "local-responsive-qa",
      configureServer(server) {
        server.middlewares.use("/__qa", (_request, response) => {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            readFileSync(
              fileURLToPath(
                new URL("../../tests/ui-harness.html", import.meta.url),
              ),
              "utf8",
            ),
          );
        });
      },
    },
  ],
  server: { allowedHosts: ["terminal.local"], port: 4173, strictPort: true },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 300 },
});
