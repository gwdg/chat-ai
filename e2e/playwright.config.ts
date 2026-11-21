import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { defineConfig, devices, type Project } from "@playwright/test";

import { SAIA_FS_TARGET } from "./src/saiaFsTarget";

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

/**
 * A second mocked instance with the same upstreams but a lean deployment:
 * tools, feedback, choices, the browser agent, agents, Arcanas and sync are off
 * (`fixtures/front.e2e-gated.json`). The tutorial and use-case catalogs have to
 * omit exactly the guides those modules carry and keep the ungated ones. It
 * needs its own Vite server because every `VITE_MODULE_*` value is compiled in
 * at startup, so the default app cannot be reconfigured per test.
 */
const GATED_APP_URL =
  process.env.E2E_GATED_APP_URL ?? "http://127.0.0.1:8094";
const GATED_APP_PORT = new URL(GATED_APP_URL).port || "8094";
const GATED_SPEC = /tutorial-catalog-gated\.spec\.ts/;

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
 * Opt-in scenario against a real SAIA filesystem: the workspace's "SAIA Files"
 * drive. Chat AI normally reaches it at `<backendPath>/saia-fs`, which only a
 * deployment hop can serve (AGENTS.md §4.31), so the scenario runs in one of two
 * shapes — see `src/saiaFsTarget.ts` for how each variable is resolved:
 *
 * - a hop: `E2E_SAIA_FS_EDGE=harness` starts `scripts/saia-fs-edge.mjs`, a
 *   stand-in for the deployment edge, and the app keeps the deployment path;
 * - a bare instance: `E2E_SAIA_FS_URL` (default `http://127.0.0.1:8003`) is
 *   written as `saiaFsEndpoint`, and `fakeAuthHeaders` carries the identity
 *   because no hop stamps it.
 *
 * `/models`, `/user` and `/chat/completions` stay mocked, so no model is needed.
 */
const SAIA_FS_ENABLED = process.env.E2E_SAIA_FS === "1";
const SAIA_FS_SPEC = /saia-fs\.spec\.ts/;
const SAIA_FS_EDGE = SAIA_FS_TARGET.edge;
const SAIA_FS_EDGE_PORT = SAIA_FS_TARGET.edgePort;
const SAIA_FS_USER = SAIA_FS_TARGET.user;
const SAIA_FS_BACKEND_URL = SAIA_FS_TARGET.backendUrl;
const SAIA_FS_APP_URL =
  process.env.E2E_SAIA_FS_APP_URL ??
  (USE_EXTERNAL_APP ? APP_URL : "http://127.0.0.1:8093");
const SAIA_FS_APP_PORT = new URL(SAIA_FS_APP_URL).port || "8093";
const SAIA_FS_CONFIG_FILE = "results/front.e2e-saia-fs.json";

/**
 * Same app as the mocked matrix, built against whatever serves saia-fs.
 * `fakeAuthHeaders` gives the deployment hop the claim it maps onto
 * `x-auth-claim-uid`; without a hop it carries that header itself.
 */
function writeSaiaFsConfig(): void {
  const base = JSON.parse(readFileSync("fixtures/front.e2e.json", "utf8"));

  base.port = Number(SAIA_FS_APP_PORT);
  base.backendPath = SAIA_FS_BACKEND_URL;
  base.modelsPath = `${SAIA_FS_BACKEND_URL}/models`;
  base.userDataPath = `${SAIA_FS_BACKEND_URL}/user`;
  base.fakeAuthHeaders = SAIA_FS_TARGET.endpoint
    ? { oidc_claim_uid: SAIA_FS_USER, "x-auth-claim-uid": SAIA_FS_USER }
    : { oidc_claim_uid: SAIA_FS_USER };
  if (SAIA_FS_TARGET.endpoint) base.saiaFsEndpoint = SAIA_FS_TARGET.endpoint;

  mkdirSync(dirname(resolve(SAIA_FS_CONFIG_FILE)), { recursive: true });
  writeFileSync(SAIA_FS_CONFIG_FILE, `${JSON.stringify(base, null, 2)}\n`);
}

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

if (SAIA_FS_ENABLED && (REAL_MODEL_ENABLED || OPENCODE_ENABLED)) {
  throw new Error(
    "E2E_SAIA_FS is a separate opt-in mode with its own app instance; do not combine it with E2E_REAL_MODEL or E2E_OPENCODE.",
  );
}

if (REAL_MODEL_ENABLED && !USE_EXTERNAL_APP) writeRealConfig();
if (SAIA_FS_ENABLED && !USE_EXTERNAL_APP) writeSaiaFsConfig();

/**
 * The lean instance belongs to the default mocked mode. The opt-in modes start
 * their own app instance, and `E2E_APP_URL` (an app you already run) has an
 * unknown module set, so the gated project only exists when a gated URL is
 * given explicitly or the suite starts the server itself.
 */
const GATED_ENABLED =
  !REAL_MODEL_ENABLED &&
  !SAIA_FS_ENABLED &&
  !OPENCODE_ENABLED &&
  (!USE_EXTERNAL_APP || Boolean(process.env.E2E_GATED_APP_URL));

const webServer: any[] = [];
if (!USE_EXTERNAL_APP && !REAL_MODEL_ENABLED && !SAIA_FS_ENABLED) {
  webServer.push({
    command:
      "CONFIG_LOCATION=../e2e/fixtures/front.e2e.json npm run dev -- --port 8090 --strictPort",
    cwd: "../front",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  });
}
if (GATED_ENABLED && !process.env.E2E_GATED_APP_URL) {
  // Same upstreams, different modules: the catalogs have to follow the build.
  webServer.push({
    command: `CONFIG_LOCATION=../e2e/fixtures/front.e2e-gated.json npm run dev -- --port ${GATED_APP_PORT} --strictPort`,
    cwd: "../front",
    url: GATED_APP_URL,
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
if (SAIA_FS_ENABLED && SAIA_FS_EDGE) {
  // The deployment hop chat-ai expects, for a local stack that has none.
  webServer.push({
    command: "node scripts/saia-fs-edge.mjs",
    url: `http://127.0.0.1:${SAIA_FS_EDGE_PORT}/__edge/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      E2E_SAIA_FS_EDGE_PORT: SAIA_FS_EDGE_PORT,
      E2E_SAIA_FS_USER: SAIA_FS_USER,
      ...(process.env.E2E_SAIA_FS_REGISTRY
        ? { E2E_SAIA_FS_REGISTRY: process.env.E2E_SAIA_FS_REGISTRY }
        : {}),
    },
  });
}
if (SAIA_FS_ENABLED && !USE_EXTERNAL_APP) {
  // Same front end, built against the backend that serves `/saia-fs`.
  webServer.push({
    command: `CONFIG_LOCATION=../e2e/${SAIA_FS_CONFIG_FILE} npm run dev -- --port ${SAIA_FS_APP_PORT} --strictPort`,
    cwd: "../front",
    url: SAIA_FS_APP_URL,
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
    testIgnore: [OPENCODE_SPEC, REAL_SPEC, SAIA_FS_SPEC, GATED_SPEC],
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "chrome-tablet",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC, SAIA_FS_SPEC, GATED_SPEC],
    // 1194 x 834: below the app's 1280 px desktop breakpoint, so it keeps the
    // tablet layout (rail sidebar, drawer-free content) while still being wide.
    use: { ...devices["iPad Pro 11 landscape"], ...chrome },
  },
  {
    name: "chrome-phone",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC, SAIA_FS_SPEC, GATED_SPEC],
    use: { ...devices["Pixel 7"], ...chrome },
  },
  {
    name: "firefox-desktop",
    testIgnore: [OPENCODE_SPEC, REAL_SPEC, SAIA_FS_SPEC, GATED_SPEC],
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
    testIgnore: [GATED_SPEC],
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      ...realApp,
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: "chrome-tablet",
    testIgnore: [GATED_SPEC],
    use: { ...devices["iPad Pro 11 landscape"], ...chrome, ...realApp },
  },
  {
    name: "chrome-phone",
    testIgnore: [GATED_SPEC],
    use: { ...devices["Pixel 7"], ...chrome, ...realApp },
  },
  {
    name: "firefox-desktop",
    testIgnore: [GATED_SPEC],
    use: {
      ...devices["Desktop Firefox"],
      ...realApp,
      viewport: { width: 1440, height: 900 },
    },
  },
];

const projects: Project[] = SAIA_FS_ENABLED
  ? []
  : REAL_MODEL_ENABLED
    ? realDeviceProjects
    : deviceProjects;

if (GATED_ENABLED) {
  // One desktop run: the scenario compares catalog contents against the module
  // set in `fixtures/front.e2e-gated.json`, not device-specific layout.
  projects.push({
    name: "tutorial-gated",
    testMatch: GATED_SPEC,
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      baseURL: GATED_APP_URL,
      viewport: { width: 1440, height: 900 },
    },
  });
}

if (SAIA_FS_ENABLED) {
  // One desktop run: the scenario drives the workspace Sources rail and the
  // service round trip, not device-specific layout.
  projects.push({
    name: "saia-fs",
    testMatch: SAIA_FS_SPEC,
    use: {
      ...devices["Desktop Chrome"],
      ...chrome,
      baseURL: SAIA_FS_APP_URL,
      viewport: { width: 1440, height: 900 },
    },
  });
}

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
    testIgnore: [OPENCODE_SPEC, REAL_SPEC, SAIA_FS_SPEC, GATED_SPEC],
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
