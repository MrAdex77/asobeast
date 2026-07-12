import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  webServer: [
    {
      command: "node e2e/mock-api.ts",
      port: 4100,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm build && pnpm start",
      port: 3000,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: { API_INTERNAL_URL: "http://localhost:4100" },
    },
  ],
});
