import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Screenshot validation with a vision model on the SAIA endpoint.
 *
 * Documentation screenshots are only useful when they show the state the
 * narrative promises, so every step may declare `shows` and the run asks Gemma
 * whether the image matches. This catches layout regressions that assertions on
 * DOM nodes miss, for example a sidebar drawer covering the page on phones.
 *
 * Credentials come from SAIA_API_ENDPOINT/SAIA_API_KEY or from
 * `secrets/back.json` (the same file the back proxy uses). They are read at
 * runtime and never sent anywhere except the configured endpoint.
 *
 *   E2E_VISION=0   disable the checks (default when no credentials exist)
 *   E2E_VISION=1   require the checks; fail if credentials are missing
 */

const DEFAULT_MODEL = "gemma-4-31b-it";
const MODEL = process.env.E2E_VISION_MODEL ?? DEFAULT_MODEL;
const MAX_CONCURRENT = Number(process.env.E2E_VISION_CONCURRENCY ?? 3);
const REQUEST_TIMEOUT_MS = 90_000;

interface Credentials {
  endpoint: string;
  apiKey: string;
}

const readSecrets = (): Credentials | null => {
  const endpoint = process.env.SAIA_API_ENDPOINT?.trim();
  const apiKey = process.env.SAIA_API_KEY?.trim();
  if (endpoint && apiKey) {
    return { endpoint: endpoint.replace(/\/+$/, ""), apiKey };
  }

  // Playwright runs from `e2e/`; accept either layout so the helper also works
  // when called from the repository root.
  for (const path of [
    join(process.cwd(), "..", "secrets", "back.json"),
    join(process.cwd(), "secrets", "back.json"),
  ]) {
    if (!existsSync(path)) continue;
    try {
      const config = JSON.parse(readFileSync(path, "utf8")) as {
        apiEndpoint?: string;
        apiKey?: string;
      };
      if (config.apiEndpoint && config.apiKey) {
        return {
          endpoint: config.apiEndpoint.replace(/\/+$/, ""),
          apiKey: config.apiKey,
        };
      }
    } catch {
      // Fall through to the next candidate.
    }
  }
  return null;
};

const credentials = readSecrets();
const mode = (process.env.E2E_VISION ?? "auto").toLowerCase();
const enabled =
  mode === "1" || mode === "true" || mode === "yes"
    ? true
    : mode === "0" || mode === "false" || mode === "no"
      ? false
      : Boolean(credentials);

/** True when screenshots should be validated by the vision model. */
export const visionEnabled = enabled;

/** True when an endpoint and key are available for the checks. */
export const visionConfigured = Boolean(credentials);

/** Human-readable reason, used in the README and in failure messages. */
export const visionStatus = (): string => {
  if (!enabled) {
    return mode === "0" || mode === "false" || mode === "no"
      ? "disabled with E2E_VISION=0"
      : "disabled: no SAIA credentials found (set SAIA_API_ENDPOINT/SAIA_API_KEY or E2E_VISION=1)";
  }
  if (!credentials) {
    return "enabled but SAIA_API_ENDPOINT/SAIA_API_KEY are missing";
  }
  return `enabled with ${MODEL} at ${credentials.endpoint}`;
};

let active = 0;
const waiters: Array<() => void> = [];

const withSlot = async <T>(task: () => Promise<T>): Promise<T> => {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
};

export interface VisionVerdict {
  ok: boolean;
  answer: string;
}

const stripMarkup = (text: string): string =>
  text
    .replace(/\$([^$]*)\$/g, "$1")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Ask the vision model whether the screenshot shows the promised state.
 *
 * A transport or API failure is reported as an error (the caller decides
 * whether that should fail the test), while a successful `NO` is a normal
 * verdict with `ok: false`.
 */
export async function verifyScreenshot({
  imagePath,
  expectation,
}: {
  imagePath: string;
  expectation: string;
}): Promise<VisionVerdict> {
  if (!credentials) {
    throw new Error(
      "vision check requested, but SAIA_API_ENDPOINT/SAIA_API_KEY are not configured",
    );
  }

  const base64 = readFileSync(imagePath).toString("base64");
  const prompt =
    "You are validating a screenshot used in product documentation.\n" +
    `Question: does this screenshot show ${expectation}?\n` +
    "Answer on the first line with exactly YES or NO, then give one short " +
    "sentence of visual evidence. Do not mention that an image was attached.";

  const run = async (): Promise<VisionVerdict> => {
    const response = await fetch(`${credentials.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 120,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`vision endpoint responded with ${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const answer = stripMarkup(raw);
    const lead = answer.replace(/^[^A-Za-z]+/, "");
    if (!/^(yes|no)\b/i.test(lead)) {
      throw new Error(`vision model did not answer YES/NO: ${raw.slice(0, 200)}`);
    }
    const ok = /^yes\b/i.test(lead);
    const evidence = lead.replace(/^(yes|no)\b[\s.:;-]*/i, "").trim();
    return { ok, answer: evidence || lead };
  };

  // Transient gateway/network errors should not turn the documentation check
  // into a flaky test. A real NO is returned immediately.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await withSlot(run);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
}
