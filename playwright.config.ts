import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 3100",
    env: { FINANCE_E2E: "1", FINANCE_DATA_FILE: ".data/e2e.json" },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
  },
  reporter: "list",
});
