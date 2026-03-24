import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const authFile = process.env.PLAYWRIGHT_AUTH_FILE;
const storageState = authFile && existsSync(authFile) ? authFile : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    storageState
  }
});
