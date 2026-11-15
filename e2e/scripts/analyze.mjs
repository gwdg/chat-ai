#!/usr/bin/env node
/**
 * Environment check and result analysis for the deterministic Playwright suite.
 *
 *   node scripts/analyze.mjs                 # check, run every project, analyse
 *   node scripts/analyze.mjs --check         # environment only, run nothing
 *   node scripts/analyze.mjs --project=chrome-desktop
 *   node scripts/analyze.mjs --grep "upload" --json
 *
 * The check answers "can this machine run the suite at all?" before a run:
 * Playwright and its browser bundles, system Chrome for the `channel: "chrome"`
 * projects, host libraries (WebKit), and the project/test matrix from the real
 * config. The run writes Playwright's JSON report under `results/analysis/`
 * and turns it into per-project totals, coverage gaps and the first lines of
 * every failure (plus the trace path), so a red run is readable without
 * opening the HTML report.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform, release, arch } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS_DIR = join(E2E_DIR, "results", "analysis");
const NPX = platform() === "win32" ? "npx.cmd" : "npx";
const PLAYWRIGHT_PKG = join(E2E_DIR, "node_modules", "playwright-core", "package.json");
const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const ANSI = /\u001b\[[0-9;]*m/g;

const color = (code, text) => (USE_COLOR ? `\u001b[${code}m${text}\u001b[0m` : text);
const green = (text) => color("32", text);
const red = (text) => color("31", text);
const yellow = (text) => color("33", text);
const dim = (text) => color("2", text);
const bold = (text) => color("1", text);

const cli = parseArgs({
  args: process.argv.slice(2),
  options: {
    check: { type: "boolean", default: false },
    project: { type: "string", multiple: true },
    grep: { type: "string" },
    workers: { type: "string" },
    headed: { type: "boolean", default: false },
    /** Maximum failures printed with an error excerpt. */
    "max-failures": { type: "string", default: "10" },
    /** Emit machine-readable JSON instead of the human report. */
    json: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const selectedProjects = cli.values.project ?? [];
const maxFailures = Number(cli.values["max-failures"]) || 10;

function fail(message) {
  console.error(red(`✘ ${message}`));
  process.exit(2);
}

if (!existsSync(PLAYWRIGHT_PKG)) {
  fail(`Playwright is not installed in ${E2E_DIR}. Run "npm i" (or npm run setup:e2e) first.`);
}

const stripAnsi = (text) => String(text ?? "").replace(ANSI, "");
const oneLine = (text) => stripAnsi(text).split("\n").find((line) => line.trim()) ?? "";

/** First lines of a Playwright error, without the repeated call log. */
function errorExcerpt(error, lines = 5) {
  const message = stripAnsi(typeof error === "string" ? error : error?.message);
  return message
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !/^Call log:$/.test(line))
    .slice(0, lines);
}

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function playwrightVersion() {
  try {
    return JSON.parse(readFileSync(PLAYWRIGHT_PKG, "utf8")).version;
  } catch {
    return "unknown";
  }
}

function browserCacheDir() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (platform() === "darwin") return join(homedir(), "Library", "Caches", "ms-playwright");
  if (platform() === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "ms-playwright");
  }
  return join(homedir(), ".cache", "ms-playwright");
}

/** Installed Playwright browser bundles, one entry per browser. */
function installedBrowsers() {
  const dir = browserCacheDir();
  if (!existsSync(dir)) return {};
  const found = {};
  for (const entry of readdirSync(dir)) {
    const match = /^(chromium|firefox|webkit)-(\d+)$/.exec(entry);
    if (!match) continue;
    const [, name, revision] = match;
    if (!found[name] || Number(revision) > Number(found[name])) found[name] = revision;
  }
  return found;
}

function systemChrome() {
  const candidates = ["google-chrome", "google-chrome-stable"];
  for (const binary of candidates) {
    try {
      const version = execFileSync(binary, ["--version"], {
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return { binary, version };
    } catch {
      // try the next binary
    }
  }
  return undefined;
}

/** The browser a project needs, from its configured name. */
function browserForProject(name) {
  if (name.startsWith("firefox")) return "firefox";
  if (name.startsWith("webkit")) return "webkit";
  return "chrome";
}

function browserHint(browser, message) {
  if (browser === "chrome") {
    if (/Executable doesn't exist|channel/i.test(message))
      return 'Google Chrome is missing. Install it, or run with "npm run setup:e2e -- --install-chrome".';
    return "Google Chrome could not start. Run \"google-chrome --version\" and reinstall the package.";
  }
  if (/libnss3|libgtk|libasound|error while loading shared libraries|Missing libraries/i.test(message))
    return `Host libraries are missing: sudo npx playwright install-deps ${browser}`;
  if (/Executable doesn't exist/i.test(message)) return `Browser bundle is missing: npx playwright install ${browser}`;
  return `Run "npx playwright install --with-deps ${browser}" and retry.`;
}

async function probeBrowser(browser) {
  const playwright = await import(
    pathToFileURL(join(E2E_DIR, "node_modules", "playwright", "index.mjs")).href
  );
  const started = Date.now();
  try {
    const launcher =
      browser === "chrome" ? playwright.chromium : playwright[browser];
    if (!launcher) throw new Error(`unknown browser ${browser}`);
    const instance = await launcher.launch({
      headless: true,
      timeout: 30_000,
      ...(browser === "chrome" ? { channel: "chrome" } : {}),
    });
    const version = instance.version();
    await instance.close();
    return { ok: true, version, ms: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - started,
      message: oneLine(error?.message ?? error),
      hint: browserHint(browser, String(error?.message ?? error)),
    };
  }
}

/**
 * The real project/test matrix, read through `playwright test --list` so the
 * check uses the config instead of a hard-coded list. `--list` does not start
 * the web server.
 */
function listMatrix() {
  const result = spawnSync(NPX, ["playwright", "test", "--list", "--reporter=json"], {
    cwd: E2E_DIR,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: 120_000,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      message: errorExcerpt(result.stderr || result.stdout || "playwright test --list failed").join(" "),
    };
  }
  const report = JSON.parse(result.stdout);
  const specs = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        specs.push({ file: spec.file ?? suite.file, title: spec.title, project: test.projectName });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return {
    ok: true,
    projects: (report.config?.projects ?? []).map((project) => project.name),
    specs,
    files: [...new Set(specs.map((spec) => spec.file))].sort(),
  };
}

function opencodeInfo() {
  try {
    const version = execFileSync("opencode", ["--version"], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return { version };
  } catch {
    return undefined;
  }
}

/** Probe an already running OpenCode server, used by the opt-in local-agent suite. */
async function probeOpencode() {
  const url = (process.env.E2E_OPENCODE_URL ?? "").replace(/\/+$/, "");
  if (!url) return { configured: false };
  const username = process.env.E2E_OPENCODE_USERNAME ?? "opencode";
  const password = process.env.E2E_OPENCODE_PASSWORD ?? "e2e-local-password";
  try {
    const response = await fetch(`${url}/api/info`, {
      headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { configured: true, ok: false, url, message: `HTTP ${response.status}` };
    }
    const info = await response.json();
    return { configured: true, ok: true, url, version: info?.version };
  } catch (error) {
    return { configured: true, ok: false, url, message: oneLine(error?.message ?? error) };
  }
}

async function environmentCheck() {
  const browsers = installedBrowsers();
  const chrome = systemChrome();
  const matrix = listMatrix();
  const projects = matrix.ok ? matrix.projects : [];
  const needed = new Set(
    (selectedProjects.length ? selectedProjects : projects).map(browserForProject),
  );
  const probes = {};
  for (const browser of needed) probes[browser] = await probeBrowser(browser);
  const opencode = {
    binary: opencodeInfo(),
    server: await probeOpencode(),
  };

  const env = {
    node: process.version,
    platform: `${platform()} ${release()} ${arch()}`,
    playwright: playwrightVersion(),
    browsers,
    browserCache: browserCacheDir(),
    systemChrome: chrome ?? null,
    probes,
    opencode,
    matrix: matrix.ok
      ? {
          ok: true,
          projects,
          specs: matrix.files.length,
          cases: matrix.specs.length,
          specsByProject: Object.fromEntries(
            projects.map((project) => [
              project,
              new Set(matrix.specs.filter((spec) => spec.project === project).map((spec) => `${spec.file}::${spec.title}`)).size,
            ]),
          ),
        }
      : { ok: false, message: matrix.message },
  };

  return { env, matrix };
}

function printEnvironment(env) {
  console.log(bold("Environment"));
  const rows = [
    ["node", env.node],
    ["platform", env.platform],
    ["playwright", env.playwright],
    [
      "browsers",
      Object.entries(env.browsers)
        .map(([name, revision]) => `${name}-${revision}`)
        .join(", ") || `none in ${env.browserCache}`,
    ],
    ["system chrome", env.systemChrome ? `${env.systemChrome.version} (${env.systemChrome.binary})` : "not found"],
    [
      "opencode",
      env.opencode?.binary
        ? env.opencode.binary.version
        : process.env.E2E_OPENCODE === "1"
          ? red("not found (needed by npm run test:opencode)")
          : "not installed (optional)",
    ],
  ];
  for (const [label, value] of rows) console.log(`  ${label.padEnd(15)} ${value}`);

  const oc = env.opencode?.server;
  if (oc?.configured) {
    console.log(
      `  ${"opencode server".padEnd(15)} ${
        oc.ok ? `${green("ok")} ${dim(`(${oc.version ?? "unknown"}, ${oc.url})`)}` : `${red("failed")} ${dim(`${oc.url} ${oc.message ?? ""}`)}`
      }`,
    );
  }

  for (const [browser, probe] of Object.entries(env.probes)) {
    const label = `${browser} launch`.padEnd(15);
    if (probe.ok) {
      console.log(`  ${label} ${green("ok")} ${dim(`(${probe.version}, ${probe.ms} ms)`)}`);
    } else {
      console.log(`  ${label} ${red("failed")} ${dim(probe.message ?? "")}`);
      if (probe.hint) console.log(`  ${"".padEnd(15)} ${yellow(probe.hint)}`);
    }
  }

  if (env.matrix.ok) {
    const perProject = Object.entries(env.matrix.specsByProject)
      .map(([project, count]) => `${project}: ${count}`)
      .join(", ");
    console.log(
      `  ${"matrix".padEnd(15)} ${env.matrix.specs} specs × ${env.matrix.projects.length} projects = ` +
        `${env.matrix.cases} cases ${dim(`(${perProject})`)}`,
    );
  } else {
    console.log(`  ${"matrix".padEnd(15)} ${red("config error")} ${env.matrix.message}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Flat rows: one per spec/project, with the last attempt's outcome. */
function reportRows(report) {
  const rows = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = test.results?.[test.results.length - 1];
        rows.push({
          file: spec.file ?? suite.file,
          title: spec.title,
          line: spec.line,
          project: test.projectName,
          status: test.status,
          outcome: last?.status ?? "unknown",
          duration: (test.results ?? []).reduce((sum, result) => sum + (result.duration ?? 0), 0),
          error: last?.error,
          errors: (last?.errors ?? []).map((entry) => entry.message ?? entry.value ?? ""),
          attachments: last?.attachments ?? [],
          retries: Math.max(0, (test.results?.length ?? 1) - 1),
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return rows;
}

const key = (row) => `${row.file}::${row.title}`;

function analyze(report, matrix, { filtered }) {
  const rows = reportRows(report);
  const projects = [...new Set(rows.map((row) => row.project))].sort();
  const stats = report.stats ?? {};
  const totals = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const row of rows) {
    if (row.status === "expected") totals.passed += 1;
    else if (row.status === "unexpected") totals.failed += 1;
    else if (row.status === "flaky") totals.flaky += 1;
    else if (row.status === "skipped") totals.skipped += 1;
  }

  const perProject = {};
  for (const project of projects) {
    perProject[project] = { passed: 0, failed: 0, flaky: 0, skipped: 0, duration: 0 };
  }
  for (const row of rows) {
    const bucket = perProject[row.project];
    bucket.duration += row.duration;
    if (row.status === "expected") bucket.passed += 1;
    else if (row.status === "unexpected") bucket.failed += 1;
    else if (row.status === "flaky") bucket.flaky += 1;
    else if (row.status === "skipped") bucket.skipped += 1;
  }

  const failures = rows.filter((row) => row.status === "unexpected");
  const flaky = rows.filter((row) => row.status === "flaky");

  let gaps = [];
  if (matrix.ok && !filtered) {
    const actual = new Set(rows.map((row) => `${row.project}::${key(row)}`));
    gaps = matrix.specs
      .filter((spec) => !actual.has(`${spec.project}::${spec.file}::${spec.title}`))
      .map((spec) => ({ project: spec.project, file: spec.file, title: spec.title }));
  }

  return {
    rows,
    projects,
    totals,
    perProject,
    failures,
    flaky,
    gaps,
    duration: stats.duration ?? rows.reduce((sum, row) => sum + row.duration, 0),
    errors: (report.errors ?? []).map((error) => errorExcerpt(error.message ?? error.value ?? error, 6)),
  };
}

function traceOf(row) {
  const trace = row.attachments.find((attachment) => attachment.name === "trace" && attachment.path);
  return trace?.path ? relative(E2E_DIR, trace.path) : undefined;
}

function printRun(summary, reportPath, logPath, skippedProjects, filtered) {
  const { totals, perProject, failures, flaky, gaps, errors } = summary;
  const passed = totals.failed === 0 && errors.length === 0;

  console.log(bold("\nRun"));
  console.log(`  ${"duration".padEnd(15)} ${(summary.duration / 1000).toFixed(1)} s`);
  console.log(
    `  ${"result".padEnd(15)} ${
      passed ? green("PASS") : red("FAIL")
    } ${totals.passed} passed, ${totals.failed} failed, ${totals.flaky} flaky, ${totals.skipped} skipped`,
  );
  if (skippedProjects.length) {
    console.log(`  ${"not run".padEnd(15)} ${yellow(skippedProjects.join(", "))} (browser unavailable)`);
  }

  if (summary.projects.length) {
    console.log(bold("\nProjects"));
    console.log(`  ${"project".padEnd(18)} ${"pass".padStart(5)} ${"fail".padStart(5)} ${"flaky".padStart(6)} ${"skip".padStart(5)}`);
    for (const project of summary.projects) {
      const bucket = perProject[project];
      console.log(
        `  ${project.padEnd(18)} ${String(bucket.passed).padStart(5)} ${String(bucket.failed).padStart(5)} ` +
          `${String(bucket.flaky).padStart(6)} ${String(bucket.skipped).padStart(5)}`,
      );
    }
  }

  if (errors.length) {
    console.log(bold("\nRun errors"));
    for (const excerpt of errors) {
      console.log(`  ${red("✘")} ${excerpt[0] ?? "unknown error"}`);
      for (const line of excerpt.slice(1, 4)) console.log(`    ${dim(line)}`);
    }
  }

  if (failures.length) {
    console.log(bold(`\nFailures (${failures.length})`));
    for (const row of failures.slice(0, maxFailures)) {
      const location = `${row.file}:${row.line}`;
      console.log(`  ${red("✘")} ${location} → ${row.title} ${dim(`[${row.project}]`)}`);
      const excerpt = errorExcerpt(row.error ?? row.errors[0] ?? "no error message", 4);
      for (const line of excerpt) console.log(`    ${line}`);
      const trace = traceOf(row);
      if (trace) console.log(`    ${dim(`trace: ${trace}`)}`);
    }
    if (failures.length > maxFailures) {
      console.log(`  ${dim(`… ${failures.length - maxFailures} more (see the HTML report)`)}`);
    }
  }

  if (flaky.length) {
    console.log(bold(`\nFlaky (${flaky.length})`));
    for (const row of flaky) {
      console.log(`  ${yellow("!")} ${row.file}:${row.line} → ${row.title} ${dim(`[${row.project}]`)}`);
    }
  }

  if (gaps.length) {
    console.log(bold(`\nCoverage gaps (${gaps.length})`));
    for (const gap of gaps.slice(0, maxFailures)) {
      console.log(`  ${yellow("!")} ${gap.file} → ${gap.title} ${dim(`[${gap.project}]`)} did not run`);
    }
    if (gaps.length > maxFailures) {
      console.log(`  ${dim(`… ${gaps.length - maxFailures} more`)}`);
    }
  } else if (filtered) {
    console.log(bold("\nCoverage"));
    console.log(`  ${dim("not checked for a filtered run")}`);
  } else if (summary.projects.length) {
    console.log(bold("\nCoverage"));
    const expected = summary.projects.length;
    console.log(`  ${green("ok")} every listed spec produced a result in ${expected} project${expected === 1 ? "" : "s"}`);
  }

  console.log(bold("\nArtifacts"));
  if (reportPath) console.log(`  ${reportPath}`);
  if (logPath) console.log(`  ${logPath}`);
  console.log(`  ${join(E2E_DIR, "results", "html", "index.html")} ${dim("(npm run test:e2e:report)")}`);
}

async function main() {
  const { env, matrix } = await environmentCheck();

  if (cli.values.json && cli.values.check) {
    console.log(JSON.stringify(env, null, 2));
  } else {
    printEnvironment(env);
  }

  const envProblems = Object.entries(env.probes)
    .filter(([, probe]) => !probe.ok)
    .map(([browser, probe]) => `${browser}: ${probe.message ?? "failed to launch"}`);
  if (env.opencode?.server?.configured && !env.opencode.server.ok) {
    envProblems.push(`opencode server: ${env.opencode.server.message ?? "unreachable"}`);
  }
  if (process.env.E2E_OPENCODE === "1" && !env.opencode?.binary) {
    envProblems.push("opencode: not installed (required by E2E_OPENCODE=1)");
  }

  if (cli.values.check) {
    if (cli.values.json) process.exit(envProblems.length || !env.matrix.ok ? 2 : 0);
    if (envProblems.length || !env.matrix.ok) {
      console.log(`\n${red("✘ environment is not ready")} ${dim("fix the entries above, or run npm run setup:e2e")}`);
      process.exit(2);
    }
    console.log(`\n${green("✔ environment is ready")}`);
    return;
  }

  if (!matrix.ok) fail(`Playwright cannot list the suite: ${matrix.message}`);

  const requested = selectedProjects.length ? selectedProjects : matrix.projects;
  const unknown = requested.filter((project) => !matrix.projects.includes(project));
  if (unknown.length) fail(`unknown project(s): ${unknown.join(", ")} (available: ${matrix.projects.join(", ")})`);

  const skippedProjects = requested.filter((project) => !env.probes[browserForProject(project)]?.ok);
  const runnable = requested.filter((project) => !skippedProjects.includes(project));
  if (!runnable.length) {
    fail("no runnable projects: every requested browser failed to launch (see above)");
  }

  const filtered = Boolean(selectedProjects.length || cli.values.grep);
  if (filtered) {
    console.log(dim(`\nFiltered run: coverage gaps are not reported (${runnable.join(", ")}${cli.values.grep ? `, grep "${cli.values.grep}"` : ""})`));
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = timestamp();
  const reportPath = join(RESULTS_DIR, `report-${stamp}.json`);
  const logPath = join(RESULTS_DIR, `run-${stamp}.log`);
  const args = ["playwright", "test", "--reporter=json"];
  for (const project of runnable) args.push("--project", project);
  if (cli.values.grep) args.push("--grep", cli.values.grep);
  if (cli.values.workers) args.push("--workers", cli.values.workers);
  if (cli.values.headed) args.push("--headed");

  if (!cli.values.json) console.log(bold("\nRunning ") + `npx ${args.join(" ")}`);

  const result = spawnSync(NPX, args, {
    cwd: E2E_DIR,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath, FORCE_COLOR: cli.values.json ? "0" : process.env.FORCE_COLOR },
    stdio: cli.values.json ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: cli.values.json ? "utf8" : undefined,
  });

  if (cli.values.json) {
    writeFileSync(logPath, `${result.stdout ?? ""}${result.stderr ?? ""}`);
  }

  if (!existsSync(reportPath)) {
    const log = cli.values.json ? `${result.stdout ?? ""}${result.stderr ?? ""}` : "";
    if (cli.values.json) console.error(log);
    fail("Playwright produced no JSON report (see the run log above)");
  }

  const summary = analyze(readJson(reportPath), matrix, { filtered });
  summary.skippedProjects = skippedProjects;
  summary.environment = env;
  summary.artifacts = { report: relative(E2E_DIR, reportPath), log: relative(E2E_DIR, logPath) };
  writeFileSync(join(RESULTS_DIR, "latest.json"), JSON.stringify(summary, null, 2));

  if (cli.values.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    if (skippedProjects.length) {
      for (const project of skippedProjects) {
        const browser = browserForProject(project);
        const probe = env.probes[browser];
        console.log(`\n${yellow("!")} ${project} was not run: ${browser} ${probe?.message ?? "unavailable"}`);
        if (probe?.hint) console.log(`  ${probe.hint}`);
      }
    }
    printRun(summary, relative(E2E_DIR, reportPath), relative(E2E_DIR, logPath), skippedProjects, filtered);
    writeFileSync(join(RESULTS_DIR, "latest.json"), JSON.stringify(summary, null, 2));
    console.log(`\n${dim("summary saved to results/analysis/latest.json")}`);
  }

  const failed = summary.totals.failed > 0 || summary.totals.flaky > 0 || summary.errors.length > 0;
  if (envProblems.length || failed) process.exit(1);
}

await main();
