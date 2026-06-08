const os = require("node:os");
const path = require("node:path");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  outputDir: path.join(os.tmpdir(), "tv-client-manager-playwright-results"),
  timeout: 30000,
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
