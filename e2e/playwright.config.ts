import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Deterministic browser suite.
 *
 * Unlike the VLM scenarios in `scenarios/`, these tests drive the app with explicit
 * selectors and mocked upstream APIs, so they need no model, no API key and no
 * judgement. Every run starts a dedicated Vite dev server on port 8090 unless
 * `E2E_APP_URL` points at an already running instance.
 */
const APP_URL = process.env.E2E_APP_URL ?? "http://127.0.0.1:8090";
const USE_EXTERNAL_APP = Boolean(process.env.E2E_APP_URL);

/** Opt-in integration scenario against a local `opencode serve` instance. */
const OPENCODE_ENABLED = process.env.E2E_OPENCODE === "1";
const OPENCODE_URL = (process.env.E2E_OPENCODE_URL ?? "http://127.0.0.1:4096").replace(/\/$/, "");
const START_OPENCODE = OPENCODE_ENABLED && !process.env.E2E_OPENCODE_URL;
const OPENCODE_SPEC = /agent-opencode\.spec\.ts/;

const webServer: any[] = [];
if (!USE_EXTERNAL_APP) {
  webServer.push({
    command:
      "CONFIG_LOCATION=../e2e/fixtures/front.e2e.json npm run dev -- --port 8090 --strictPort",
    cwd: "../front",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  });
}
if (START_OPENCODE) {
  // scripts/opencode-server.mjs sets a fixed password (E2E_OPENCODE_PASSWORD)
  // and waits for /api/info, so the scenario can authenticate deterministically.
  webServer.push({
    command: "node scripts/opencode-server.mjs",
    url: `${OPENCODE_URL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  });
}

/** Chrome is the default browser for the three device classes. */
// `browserName` is required for the iPad descriptor, which defaults to webkit.
const chrome = { browserName: "chromium", channel: "chrome" } as const;

const projects: Project[] = [
  {
    name: "chrome-desktop",
    testIgnore: OPENCODE_SPEC,
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "chrome-tablet",
    testIgnore: OPENCODE_SPEC,
    // 1194 x 834: below the app's 1280 px desktop breakpoint, so it keeps the
    // tablet layout (rail sidebar, drawer-free content) while still being wide.
    use: { ...devices["iPad Pro 11 landscape"], ...chrome },
  },
  {
    name: "chrome-phone",
    testIgnore: OPENCODE_SPEC,
    use: { ...devices["Pixel 7"], ...chrome },
  },
  {
    name: "firefox-desktop",
    testIgnore: OPENCODE_SPEC,
    // Same desktop class as chrome-desktop: 1280 x 720 squeezes the Meta chat
    // prompt row far enough that the model chip covers the send button.
    use: {
      ...devices["Desktop Firefox"],
      viewport: { width: 1440, height: 900 },
    },
  },
];

if (OPENCODE_ENABLED) {
  // One desktop run: the scenario drives the local agent UI and its shell turn,
  // not device-specific layout.
  projects.push({
    name: "opencode-local",
    testMatch: OPENCODE_SPEC,
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      viewport: { width: 1440, height: 900 },
    },
  });
}

// WebKit needs host libraries that a plain `npm i` does not install. Enable it
// explicitly after `npx playwright install-deps webkit`.
if (process.env.E2E_WEBKIT === "1") {
  projects.push({
    name: "webkit-desktop",
    testIgnore: OPENCODE_SPEC,
    use: { ...devices["Desktop Safari"] },
  });
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "results/html", open: "never" }],
  ],
  outputDir: "results/test-results",
  use: {
    baseURL: APP_URL,
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer,
  projects,
});
