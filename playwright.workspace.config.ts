import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/e2e-workspace",
  outputDir: "workspace-test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "workspace-report" }],
  ],
  use: { ...base.use, baseURL: "http://127.0.0.1:4174" },
  webServer: {
    command:
      "npx vite --config apps/web/vite.config.ts --host 0.0.0.0 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_API_BASE_URL: "https://api.example.test",
      VITE_COGNITO_AUTHORITY:
        "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_QATEST",
      VITE_COGNITO_CLIENT_ID: "qa-client",
      VITE_COGNITO_DOMAIN: "https://qa.auth.ap-southeast-1.amazoncognito.com",
      VITE_PUBLIC_INTAKE_ENABLED: "false",
    },
  },
});
