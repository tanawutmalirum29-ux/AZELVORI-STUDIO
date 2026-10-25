import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./tests/e2e-public",
  outputDir: "public-test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "public-report" }]],
  use: { ...base.use, baseURL: "http://127.0.0.1:4175" },
  webServer: {
    command: "npx vite --config apps/web/vite.config.ts --host 0.0.0.0 --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_API_BASE_URL: "https://api.example.test",
      VITE_PUBLIC_INTAKE_ENABLED: "true",
      VITE_PRIVACY_CONTACT_EMAIL: "privacy@example.test",
      VITE_SITE_URL: "http://127.0.0.1:4175",
    },
  },
});
