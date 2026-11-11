import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "./agent";
import type { Scenario, Viewport } from "./scenario";

export interface ScenarioRun {
    scenario: Scenario;
    viewport: Viewport;
    result: Result;
    model: string;
}

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const verdict = (passed: boolean) =>
    `<span class="badge ${passed ? "pass" : "fail"}">${passed ? "PASS" : "FAIL"}</span>`;

const STYLE = `
body { font: 14px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 1400px; padding: 16px; background: #f6f6f7; color: #111; }
h1, h2 { margin: .5em 0; }
.badge { font-weight: bold; padding: 1px 8px; border-radius: 4px; color: #fff; }
.pass { background: #16a34a; } .fail { background: #dc2626; }
summary h2 { display: inline; font-size: 1.1em; }
.scenario { background: #fff; border-radius: 8px; padding: 12px 16px; margin: 16px 0; }
.step { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; border-top: 1px solid #ddd; padding: 12px 0; }
.step img { max-width: 100%; max-height: 80vh; border: 1px solid #ccc; }
.thought { font-style: italic; }
.error { color: #dc2626; }
pre { white-space: pre-wrap; background: #f1f1f3; padding: 8px; font-size: 12px; max-height: 400px; overflow: auto; }
@media (max-width: 800px) { .step { grid-template-columns: 1fr; } }
`;

/** Writes screenshots and one self-contained index.html showing exactly what the VLM saw and answered. */
export async function writeReport(dir: string, runs: ScenarioRun[]): Promise<string> {
    const sections: string[] = [];

    for (const { scenario: sc, viewport, result, model } of runs) {
        const id = `${sc.name}-${viewport}`;
        const shotDir = join(dir, id);
        await mkdir(shotDir, { recursive: true });

        const steps: string[] = [];
        for (const s of result.steps) {
            const shot = `${id}/step-${String(s.index).padStart(2, "0")}.png`;
            await writeFile(join(dir, shot), s.shot);

            const { thought, ...args } = s.decision;
            steps.push(`
<div class="step">
  <a href="${shot}"><img src="${shot}" alt="Step ${s.index} screenshot" loading="lazy"></a>
  <div>
    <h3>Step ${s.index}</h3>
    <div><code>${esc(s.url)}</code></div>
    <p class="thought">${esc(String(thought ?? ""))}</p>
    <pre>${esc(JSON.stringify(args, null, 2))}</pre>
    ${s.error ? `<p class="error">Error: ${esc(s.error)}</p>` : ""}
    <details><summary>Prompt sent to VLM</summary><pre>${esc(s.prompt)}</pre></details>
    <details><summary>Raw reply</summary><pre>${esc(s.reply)}</pre></details>
  </div>
</div>`);
        }

        sections.push(`
<details class="scenario" id="${esc(id)}">
  <summary><h2>${verdict(result.passed)} ${esc(sc.title)} <small>(${viewport})</small></h2></summary>
  <p><code>${esc(sc.name)}.md</code> · ${viewport} · ${sc.language} · ${esc(model)} · ${result.steps.length} steps</p>
  <p><strong>Verdict:</strong> ${esc(result.reason)}</p>
  ${result.defects.length ? `<ul class="error">${result.defects.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
  <details><summary>Scenario</summary><pre>${esc(sc.instructions)}</pre></details>
  ${steps.join("")}
</details>`);
    }

    const passed = runs.filter((r) => r.result.passed).length;

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat AI e2e report</title><style>${STYLE}</style></head>
<body>
<h1>Chat AI e2e: ${passed}/${runs.length} passed</h1>
${sections.join("")}
</body></html>`;

    const index = join(dir, "index.html");
    await writeFile(index, html);
    return index;
}
