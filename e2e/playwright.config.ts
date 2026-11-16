import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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
const OPENCODE_SPEC = /agent-(opencode|agentic-tasks)\.spec\.ts/;

/**
 * The agentic scenario needs a model whose tool calls are deterministic, so the
 * bundled OpenCode project gets a `scripted` provider pointing at
 * `scripts/scripted-model.mjs`. An OpenCode instance you started yourself
 * (`E2E_OPENCODE_URL`) has to configure that provider on its own, which is why
 * the scenario skips in that case.
 */
const SCRIPTED_MODEL_PORT = process.env.E2E_SCRIPTED_MODEL_PORT ?? "4100";
const SCRIPTED_MODEL_URL = (
  process.env.E2E_SCRIPTED_MODEL_URL ??
  `http://127.0.0.1:${SCRIPTED_MODEL_PORT}`
).replace(/\/+$/, "");
const START_SCRIPTED_MODEL = START_OPENCODE && !process.env.E2E_SCRIPTED_MODEL_URL;

/**
 * Opt-in scenario against a real model: the app talks to a back service you
 * started (`E2E_BACKEND_URL`), which holds the API key. The project runs its own
 * app instance, because the backend URLs are compiled into the bundle at Vite
 * startup (`VITE_BACKEND_ENDPOINT` etc.), so the mocked config cannot be reused.
 */
const REAL_MODEL_ENABLED = process.env.E2E_REAL_MODEL === "1";
const REAL_BACKEND_URL = (
  process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8081"
).replace(/\/+$/, "");
const REAL_APP_URL =
  process.env.E2E_REAL_APP_URL ??
  (USE_EXTERNAL_APP ? APP_URL : "http://127.0.0.1:8092");
const REAL_APP_PORT = new URL(REAL_APP_URL).port || "8092";
/** Generated from `fixtures/front.e2e.json`; gitignored with the rest of results/. */
const REAL_CONFIG_FILE = "results/front.e2e-real.json";
const REAL_SPEC = /chat-real-model\.spec\.ts/;

/**
 * Point a copy of the mocked front-end config at the back service the user is
 * running. Every other key (modules, prompt defaults, title model) stays the
 * same, so the real-model scenario renders the same app.
 */
function writeRealConfig(): void {
  const base = JSON.parse(readFileSync("fixtures/front.e2e.json", "utf8"));
  const modelId =
    (process.env.E2E_REAL_MODEL_ID ?? "").trim() || base.default.model.id;

  base.port = Number(REAL_APP_PORT);
  base.backendPath = REAL_BACKEND_URL;
  base.modelsPath = `${REAL_BACKEND_URL}/models`;
  base.userDataPath = `${REAL_BACKEND_URL}/user`;
  base.titleGenerationModel = modelId;
  // The stored default is replaced by the matching entry from the real /models
  // response as soon as it arrives, so the name only matters until then.
  base.default.model = { id: modelId, name: modelId };

  mkdirSync(dirname(resolve(REAL_CONFIG_FILE)), { recursive: true });
  writeFileSync(REAL_CONFIG_FILE, `${JSON.stringify(base, null, 2)}\n`);
}

if (REAL_MODEL_ENABLED && OPENCODE_ENABLED) {
  throw new Error(
    "E2E_REAL_MODEL and E2E_OPENCODE are separate opt-in modes with their own app instance; run them one at a time.",
  );
}

if (REAL_MODEL_ENABLED && !USE_EXTERNAL_APP) writeRealConfig();

const webServer: any[] = [];
if (!USE_EXTERNAL_APP && !REAL_MODEL_ENABLED) {
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
  // When the scripted model runs too, its URL is written into the project's
  // opencode.json as the `scripted` provider, which is what makes the agentic
  // scenario's tool calls deterministic.
  webServer.push({
    command: "node scripts/opencode-server.mjs",
    url: `${OPENCODE_URL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    ...(START_SCRIPTED_MODEL
      ? { env: { E2E_SCRIPTED_MODEL_URL: SCRIPTED_MODEL_URL } }
      : {}),
  });
}
if (START_SCRIPTED_MODEL) {
  // Offline stand-in for a model: answers the OpenAI chat-completions API with
  // a fixed write → shell → read script (scripts/scripted-model.mjs).
  webServer.push({
    command: "node scripts/scripted-model.mjs",
    url: `${SCRIPTED_MODEL_URL}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  });
}
if (REAL_MODEL_ENABLED && !USE_EXTERNAL_APP) {
  // Same front end, but with the generated config that points at the user's
  // back service, so the answer comes from a real model and streams for real.
  webServer.push({
    command: `CONFIG_LOCATION=../e2e/${REAL_CONFIG_FILE} npm run dev -- --port ${REAL_APP_PORT} --strictPort`,
    cwd: "../front",
    url: REAL_APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  });
}

/** Chrome is the default browser for the three device classes. */
// `browserName` is required for the iPad descriptor, which defaults to webkit.
const chrome = { browserName: "chromium", channel: "chrome" } as const;

/** The mocked matrix: Chrome desktop/tablet/phone plus Firefox desktop. */
const deviceProjects: Project[] = [
  {
    name: "chrome-desktop",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC],
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "chrome-tablet",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC],
    // 1194 x 834: below the app's 1280 px desktop breakpoint, so it keeps the
    // tablet layout (rail sidebar, drawer-free content) while still being wide.
    use: { ...devices["iPad Pro 11 landscape"], ...chrome },
  },
  {
    name: "chrome-phone",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC],
    use: { ...devices["Pixel 7"], ...chrome },
  },
  {
    name: "firefox-desktop",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC],
    // Same desktop class as chrome-desktop: 1280 x 720 squeezes the Meta chat
    // prompt row far enough that the model chip covers the send button.
    use: {
      ...devices["Desktop Firefox"],
      viewport: { width: 1440, height: 900 },
    },
  },
];

/**
 * The two suites are separate modes: `npm run test:e2e` runs the mocked matrix
 * above, `npm run test:real` (E2E_REAL_MODEL=1) runs the same device classes
 * against the app instance that talks to the user's back service.
 */
const realApp = { baseURL: REAL_APP_URL, mockUpstream: false } as const;

const realDeviceProjects: Project[] = [
  {
    name: "chrome-desktop",
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      ...realApp,
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "chrome-tablet",
    use: { ...devices["iPad Pro 11 landscape"], ...chrome, ...realApp },
  },
  {
    name: "chrome-phone",
    use: { ...devices["Pixel 7"], ...chrome, ...realApp },
  },
  {
    name: "firefox-desktop",
    use: {
      ...devices["Desktop Firefox"],
      ...realApp,
      viewport: { width: 1440, height: 900 },
    },
  },
];

const projects: Project[] = REAL_MODEL_ENABLED ? realDeviceProjects : deviceProjects;

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
// explicitly after `npx playwright install-deps webkit`. It runs the mocked
// matrix, so the opt-in modes do not add it.
if (!REAL_MODEL_ENABLED && !OPENCODE_ENABLED && process.env.E2E_WEBKIT === "1") {
  projects.push({
    name: "webkit-desktop",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC],
    use: { ...devices["Desktop Safari"] },
  });
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  // Screenshot validation happens in the documentation fixture teardown, so the
  // timeout has to cover the vision requests as well. With E2E_VISION=0 there
  // is nothing to wait for and the tighter limit catches slow scenarios.
  timeout: ["0", "false", "no"].includes(
    (process.env.E2E_VISION ?? "").toLowerCase(),
  )
    ? 60_000
    : 120_000,
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
