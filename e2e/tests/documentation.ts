import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";

/**
 * Per-step documentation capture for the deterministic suite.
 *
 * Every run writes screenshots and a short narrative into
 * `results/documentation/<scenario>/<project>/` (gitignored):
 *
 *   1.png    screenshot after the first documented step
 *   1.md     what the user did and what the system answered
 *   index.md overview of every step of this scenario on this project
 *
 * `<scenario>` is the spec file name without `.spec.ts`, `<project>` is the
 * Playwright project (`chrome-desktop`, `chrome-phone`, …), so the same
 * scenario can be compared across browsers and device classes.
 */

const DOCUMENTATION_ROOT = process.env.E2E_DOCUMENTATION_DIR
  ? resolve(process.env.E2E_DOCUMENTATION_DIR)
  : join(process.cwd(), "results", "documentation");

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scenario";

const numberedFiles = (directory: string): number[] =>
  readdirSync(directory)
    .map((name) => /^(\d+)\.md$/.exec(name)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value));

/** Directories already cleaned in this worker process. */
const prepared = new Set<string>();

/** Set E2E_DOC_DEBUG=1 to see why a documentation folder is created or removed. */
const debug = (message: string): void => {
  if (process.env.E2E_DOC_DEBUG === "1") console.log(`[documentation] ${message}`);
};

export interface StepNarrative {
  /** What the user does in this step. */
  user: string;
  /** What the application shows or does in response. */
  system: string;
}

interface RecordedStep {
  index: number;
  title: string;
  user: string;
  system: string;
  failed?: string;
}

export class ScenarioDocumentation {
  readonly scenario: string;
  readonly project: string;
  readonly title: string;
  readonly directory: string;
  private steps: RecordedStep[] = [];
  private finished = false;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
  ) {
    this.scenario = slug(basename(testInfo.file).replace(/\.spec\.[jt]s$/, ""));
    this.project = testInfo.project.name;
    this.title = testInfo.title;
    this.directory = join(DOCUMENTATION_ROOT, this.scenario, this.project);

    if (!prepared.has(this.directory)) {
      debug(`clean ${this.directory}`);
      rmSync(this.directory, { recursive: true, force: true });
      prepared.add(this.directory);
    } else {
      debug(`reuse ${this.directory}`);
    }
    mkdirSync(this.directory, { recursive: true });
  }

  /** True once at least one narrative step was recorded. */
  get used(): boolean {
    return this.steps.length > 0;
  }

  /**
   * Record one user-visible step.
   *
   * `action` is optional, so a step can also document an assertion-only
   * checkpoint. The screenshot is taken after the action finished, which is
   * exactly the state a documentation reader should see.
   */
  async step(
    title: string,
    narrative: StepNarrative,
    action?: () => Promise<void>,
  ): Promise<void> {
    if (action) {
      try {
        await action();
      } catch (error) {
        await this.record(title, narrative, error);
        throw error;
      }
    }
    await this.record(title, narrative);
  }

  private nextIndex(): number {
    const existing = numberedFiles(this.directory);
    const recorded = this.steps.length
      ? Math.max(...this.steps.map((step) => step.index))
      : 0;
    return Math.max(recorded, ...existing, 0) + 1;
  }

  private async record(
    title: string,
    narrative: StepNarrative,
    error?: unknown,
  ): Promise<void> {
    const index = this.nextIndex();
    const image = `${index}.png`;

    try {
      await this.page.screenshot({
        path: join(this.directory, image),
        fullPage: true,
        animations: "disabled",
      });
    } catch {
      // A closed or crashed page still gets its narrative; the next step or a
      // later run can supply the image.
    }

    const failed =
      error instanceof Error ? error.message : error ? String(error) : undefined;

    const step: RecordedStep = {
      index,
      title,
      user: narrative.user,
      system: failed
        ? `${narrative.system}\n\n**Step failed:** ${failed}`
        : narrative.system,
      failed,
    };
    this.steps.push(step);
    writeFileSync(join(this.directory, `${index}.md`), this.stepMarkdown(step, image));
  }

  private stepMarkdown(step: RecordedStep, image: string): string {
    return [
      `# ${step.index}. ${step.title}`,
      "",
      `- Scenario: ${this.scenario}`,
      `- Project: ${this.project}`,
      `- Test: ${this.title}`,
      "",
      "## User input",
      "",
      step.user,
      "",
      "## System response",
      "",
      step.system,
      "",
      `![Step ${step.index}: ${step.title}](${image})`,
      "",
    ].join("\n");
  }

  private indexMarkdown(): string {
    const lines = [
      `# ${this.scenario} — ${this.project}`,
      "",
      `Test: ${this.title}`,
      "",
      ...this.steps.map(
        (step) => `${step.index}. [${step.title}](${step.index}.md) — [screenshot](${step.index}.png)`,
      ),
      "",
    ];
    return lines.join("\n");
  }

  /**
   * Write the scenario index. Called by the fixture after every test.
   *
   * A test that never called `step()` still gets one final screenshot, so every
   * scenario has documentation even without explicit instrumentation.
   */
  async finish(error?: { message?: string }): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    debug(`finish ${this.directory} steps=${this.steps.length} error=${Boolean(error)}`);

    if (!this.steps.length) {
      const message = error?.message?.trim();
      await this.record(
        message ? "Failure" : "Final state",
        {
          user: this.title,
          system: message
            ? `The scenario stopped on an error: ${message}`
            : "End of the scenario. This final state was captured automatically; add `doc.step()` calls for a step-by-step narrative.",
        },
        error,
      );
    } else if (error && !this.steps[this.steps.length - 1]?.failed) {
      await this.record(
        "Failure",
        {
          user: "The scenario continues until it fails.",
          system: "The scenario stopped before this step completed.",
        },
        error,
      );
    }

    writeFileSync(join(this.directory, "index.md"), this.indexMarkdown());
  }
}
