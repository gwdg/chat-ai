import OpenAI from "openai";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { runScenario, type Vlm } from "./agent";
import { writeReport, type ScenarioRun } from "./report";
import { loadScenario, LOCALES, VIEWPORT_SIZES } from "./scenario";

const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(E2E_DIR, "..");
const SCENARIO_DIR = resolve(E2E_DIR, "scenarios");
const RESULTS_DIR = resolve(E2E_DIR, "results");

const DEFAULT_APP_URL = "http://localhost:8080";
const DEFAULT_VLM_MODEL = "gemma-4-31b-it";

interface BackConfig {
    apiEndpoint?: string;
    apiKey?: string;
}

/** The VLM uses the same SAIA endpoint and key as the back service, unless overridden by env. */
async function vlmFromConfig(): Promise<Vlm> {
    const path = resolve(REPO_ROOT, process.env.E2E_BACK_CONFIG ?? "secrets/back.json");
    const back: BackConfig = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
    const baseURL = process.env.E2E_VLM_URL || back.apiEndpoint;
    const apiKey = process.env.E2E_VLM_KEY || back.apiKey;
    if (!baseURL || !apiKey) {
        console.error(`no VLM endpoint/key: set apiEndpoint + apiKey in ${path} or E2E_VLM_URL + E2E_VLM_KEY`);
        process.exit(2);
    }
    return { client: new OpenAI({ baseURL, apiKey }), model: process.env.E2E_VLM_MODEL || DEFAULT_VLM_MODEL };
}

function timestamp(): string {
    // 2026-11-11T21:35:32.123Z -> 20261111-213532
    return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: { headed: { type: "boolean", default: false } },
        allowPositionals: true,
    });

    const vlm = await vlmFromConfig();
    const appUrl = (process.env.E2E_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");

    const paths = positionals.length
        ? positionals.map((p) => resolve(p))
        : readdirSync(SCENARIO_DIR).filter((f) => f.endsWith(".md")).sort().map((f) => resolve(SCENARIO_DIR, f));
    const scenarios = await Promise.all(paths.map(loadScenario));

    const runs: ScenarioRun[] = [];
    const browser = await chromium.launch({ headless: !values.headed });

    for (const sc of scenarios) {
        for (const viewport of sc.viewports) {
            console.log(`▶ ${sc.name} (${viewport}, ${sc.language}, ${vlm.model})`);

            // Fresh context per run: empty IndexedDB and localStorage, so no chats leak between scenarios
            const context = await browser.newContext({
                viewport: VIEWPORT_SIZES[viewport],
                locale: LOCALES[sc.language],
            });
            const page = await context.newPage();
            await page.goto(appUrl + sc.start, { waitUntil: "networkidle" });

            const result = await runScenario(page, sc, viewport, appUrl, vlm);
            await context.close();

            runs.push({ scenario: sc, viewport, result, model: vlm.model });
            const defects = result.defects.map((d) => `\n    - ${d}`).join("");
            console.log(`${result.passed ? "✔ PASS" : "✘ FAIL"} ${sc.name}/${viewport}: ${result.reason}${defects}\n`);
        }
    }

    await browser.close();

    const report = await writeReport(resolve(RESULTS_DIR, timestamp()), runs);
    const passed = runs.filter((r) => r.result.passed).length;
    console.log(`${passed}/${runs.length} passed. Report: file://${report}`);
    process.exit(passed === runs.length ? 0 : 1);
}

await main();
