import { readFile } from "node:fs/promises";
import type OpenAI from "openai";
import type { Page } from "playwright";
import { element, observe } from "./browser";
import type { Scenario, Viewport } from "./scenario";

const ACTION_TIMEOUT_MS = 5_000;
const SETTLE_MS = 800;
const SCROLL_PX = 600;
const MAX_WAIT_S = 30;
const JSON_OBJECT = /\{[\s\S]*\}/;
const ANSI = /\x1b\[[0-9;]*m/g;

const CHECKS = await readFile(new URL("../checks.md", import.meta.url), "utf8");

const SYSTEM_PROMPT = `You are a strict, sceptical QA tester using the web app Chat AI (a browser chat client for large language models).
You control a real browser. Each turn you get a screenshot where interactive elements carry red
numbered labels (added by the test harness, not part of the app), plus the list of those elements.

Follow the scenario, then judge it. Your job is to find defects, not to confirm success:
- Read all visible text carefully, including AI answers, before judging.
- Judge only what you see. If you cannot verify an expectation, it fails.
- A step that already looks done must still be performed and verified, never skipped.
- Report every defect you notice, even outside the scenario's scope.
- "passed" is true only if all expectations hold and no defect from the list below is visible.

${CHECKS}

Reply with exactly one JSON object, no prose around it:
{"thought": "<short reasoning, incl. which scenario steps are done>", "action": "<action>", ...args}

You have no memory between turns except the action log, which includes your earlier thoughts.
Trust it: don't redo finished steps.

Actions:
- {"action": "click", "id": 3}
- {"action": "type", "id": 5, "text": "hello", "submit": false}   (replaces field content; submit presses Enter)
- {"action": "press", "key": "Escape"}
- {"action": "scroll", "direction": "down"}   (or "up")
- {"action": "goto", "path": "/home"}
- {"action": "wait", "seconds": 3}   (e.g. while the AI answers)
- {"action": "done", "passed": false, "reason": "<each expectation: held/failed and why>", "defects": ["<defect seen>"]}`;

export enum Action {
    Click = "click",
    Type = "type",
    Press = "press",
    Scroll = "scroll",
    Goto = "goto",
    Wait = "wait",
    Done = "done",
    Invalid = "invalid",
}

export type Decision = { action: Action; thought?: string; [arg: string]: unknown };

export interface Step {
    index: number;
    url: string;
    prompt: string;
    shot: Buffer;
    reply: string;
    decision: Decision;
    error?: string;
}

export interface Result {
    passed: boolean;
    reason: string;
    defects: string[];
    steps: Step[];
}

export interface Vlm {
    client: OpenAI;
    model: string;
}

function actionLog(steps: Step[]): string {
    if (steps.length === 0) {
        return "(none yet)";
    }

    return steps
        .map((s) => {
            const { thought, ...args } = s.decision;
            const note = thought ? `\n   thought: ${thought}` : "";
            const err = s.error ? ` -> ERROR: ${s.error}` : "";
            return `${s.index}. ${JSON.stringify(args)}${err}${note}`;
        })
        .join("\n");
}

/**
 * First error line plus Playwright's distinct reasons from the call log, so the VLM learns
 * why an action failed, e.g. "Timeout 5000ms exceeded. (element is not visible)".
 */
function errorText(e: Error): string {
    const [first, ...rest] = e.message.replace(ANSI, "").split("\n");
    const reasons = new Set(
        rest.map((l) => l.replace(/^\s*-\s*/, "").trim()).filter((l) => /not visible|intercepts|not stable|outside|detached|disabled/.test(l)),
    );
    return reasons.size ? `${first} (${[...reasons].join("; ")})` : first;
}

/** One stateless VLM call: history goes in as a text log, only the current screenshot as image. */
async function ask(vlm: Vlm, prompt: string, shot: Buffer): Promise<string> {
    const resp = await vlm.client.chat.completions.create({
        model: vlm.model,
        temperature: 0,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${shot.toString("base64")}` } },
                ],
            },
        ],
    });
    return resp.choices[0]?.message.content ?? "";
}

function parseReply(reply: string): Decision {
    const match = reply.match(JSON_OBJECT);
    if (!match) {
        throw new Error("no JSON object in reply");
    }
    return JSON.parse(match[0]);
}

/**
 * Click via Playwright; if it deems the element not visible although it has a box on screen
 * (e.g. items in a <details> submenu inside a popover), click its center like a user would.
 */
async function click(page: Page, id: number): Promise<void> {
    const target = element(page, id);
    try {
        await target.click({ timeout: ACTION_TIMEOUT_MS });
    } catch (e) {
        const box = await target.boundingBox();
        if (!box) {
            throw e;
        }
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
}

async function act(page: Page, baseUrl: string, d: Decision): Promise<void> {
    const timeout = ACTION_TIMEOUT_MS;

    switch (d.action) {
        case Action.Click: {
            await click(page, Number(d.id));
            return;
        }
        case Action.Type: {
            const target = element(page, Number(d.id));
            await target.fill(String(d.text), { timeout });
            if (d.submit) {
                await target.press("Enter");
            }
            return;
        }
        case Action.Press: {
            await page.keyboard.press(String(d.key));
            return;
        }
        case Action.Scroll: {
            await page.mouse.wheel(0, d.direction === "up" ? -SCROLL_PX : SCROLL_PX);
            return;
        }
        case Action.Goto: {
            await page.goto(baseUrl + d.path, { waitUntil: "networkidle" });
            return;
        }
        case Action.Wait: {
            await page.waitForTimeout(Math.min(Number(d.seconds ?? 2), MAX_WAIT_S) * 1000);
            return;
        }
        default: {
            throw new Error(`unknown action ${JSON.stringify(d.action)}`);
        }
    }
}

export async function runScenario(
    page: Page, sc: Scenario, viewport: Viewport, baseUrl: string, vlm: Vlm,
): Promise<Result> {
    const steps: Step[] = [];

    for (let index = 1; index <= sc.maxSteps; index++) {
        await page.waitForTimeout(SETTLE_MS);
        const { shot, elements } = await observe(page);
        const url = page.url();
        const prompt = [
            `# Scenario: ${sc.title}\n\n${sc.instructions}`,
            `# Viewport\n${viewport}`,
            `# Current URL\n${url}`,
            `# Actions so far\n${actionLog(steps)}`,
            `# Interactive elements\n${elements.join("\n")}`,
        ].join("\n\n");

        // A malformed reply costs one step; the VLM gets the error in the next log
        const reply = await ask(vlm, prompt, shot);
        const step: Step = { index, url, prompt, shot, reply, decision: { action: Action.Invalid } };
        steps.push(step);
        try {
            step.decision = parseReply(reply);
        } catch (e) {
            step.error = (e as Error).message;
            continue;
        }

        const d = step.decision;
        console.log(`  ${String(index).padStart(2)}. ${d.action}: ${d.thought ?? ""}`);

        // The VLM's verdict ends the scenario
        if (d.action === Action.Done) {
            // Any listed defect fails the run, even if the VLM marked it passed
            const defects = Array.isArray(d.defects) ? d.defects.map(String) : [];
            const passed = d.passed === true && defects.length === 0;
            return { passed, reason: String(d.reason ?? ""), defects, steps };
        }

        // Failed actions are fed back so the VLM can recover
        try {
            await act(page, baseUrl, d);
        } catch (e) {
            step.error = errorText(e as Error);
        }
    }

    return { passed: false, reason: `no verdict within ${sc.maxSteps} steps`, defects: [], steps };
}
