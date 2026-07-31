import { defineConfig, devices } from "@playwright/test";

const localProxyBypass = ["127.0.0.1", "localhost"];
for (const key of ["NO_PROXY", "no_proxy"] as const) {
  const existing = process.env[key]?.split(",").filter(Boolean) ?? [];
  process.env[key] = [...new Set([...existing, ...localProxyBypass])].join(",");
}

export default defineConfig({
  testDir: "./tests/browser",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] }
    }
  ],
  webServer: {
    command: "npm run playground:dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe"
  }
});
