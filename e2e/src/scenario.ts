import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse } from "yaml";

export enum Viewport {
    Desktop = "desktop",
    Mobile = "mobile",
}

export const VIEWPORT_SIZES = {
    [Viewport.Desktop]: { width: 1366, height: 900 },
    [Viewport.Mobile]: { width: 390, height: 844 },
};

export enum Language {
    En = "en",
    De = "de-de",
}

// i18next-browser-languagedetector falls back to navigator.language, set via the context locale
export const LOCALES = {
    [Language.En]: "en-US",
    [Language.De]: "de-DE",
};

// Optional YAML frontmatter; everything after it is passed verbatim to the VLM
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
const DEFAULT_MAX_STEPS = 25;

export interface Scenario {
    name: string;
    title: string;
    start: string;
    viewports: Viewport[];
    language: Language;
    maxSteps: number;
    instructions: string;
}

function oneOf<T extends string>(values: Record<string, T>, value: unknown, fallback: T): T {
    if (value === undefined) {
        return fallback;
    }
    if (!Object.values(values).includes(value as T)) {
        throw new Error(`invalid value ${JSON.stringify(value)}, expected one of ${Object.values(values)}`);
    }
    return value as T;
}

export async function loadScenario(path: string): Promise<Scenario> {
    const text = await readFile(path, "utf8");
    const match = text.match(FRONTMATTER);
    const meta = match ? (parse(match[1]) ?? {}) : {};
    const name = basename(path, ".md");

    return {
        name,
        title: meta.title ?? name,
        start: meta.start ?? "/",
        // Every scenario runs on desktop and mobile unless narrowed, e.g. `viewports: [desktop]`
        viewports: (meta.viewports ?? Object.values(Viewport)).map((v: unknown) => oneOf(Viewport, v, Viewport.Desktop)),
        language: oneOf(Language, meta.language, Language.En),
        maxSteps: Number(meta.max_steps ?? DEFAULT_MAX_STEPS),
        instructions: (match ? text.slice(match[0].length) : text).trim(),
    };
}
