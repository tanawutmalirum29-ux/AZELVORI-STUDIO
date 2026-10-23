import { defineConfig } from "@playwright/test";
const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 40000,
  expect: { timeout: 7000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  projects: (["chromium", "webkit"] as const).flatMap((browserName) =>
    sizes.map((viewport) => ({
      name: `${browserName}-${viewport.width}x${viewport.height}`,
      use: { browserName, viewport },
    })),
  ),
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
