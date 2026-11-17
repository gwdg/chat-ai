import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import {
  verifyScreenshot,
  visionConfigured,
  visionEnabled,
  visionStatus,
  type VisionVerdict,
} from "./vision";

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

interface StepNarrative {
  /** What the user does in this step. */
  user: string;
  /** What the application shows or does in response. */
  system: string;
  /**
   * What the screenshot of this step should visibly show, in one short
   * sentence. When set, the vision model checks the image after the run.
   */
  shows?: string;
}

interface RecordedStep {
  index: number;
  title: string;
  user: string;
  system: string;
  shows?: string;
  image?: string;
  vision?: VisionVerdict;
  visionError?: string;
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
      shows: narrative.shows,
      image,
      failed,
    };
    this.steps.push(step);
    this.writeStep(step);
  }

  private writeStep(step: RecordedStep): void {
    writeFileSync(
      join(this.directory, `${step.index}.md`),
      this.stepMarkdown(step),
    );
  }

  private stepMarkdown(step: RecordedStep): string {
    const lines = [
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
    ];

    if (step.shows) {
      lines.push("## Visual check", "", `Expected: ${step.shows}`, "");
      if (step.vision) {
        lines.push(
          `Verdict: ${step.vision.ok ? "**YES**" : "**NO**"} — ${step.vision.answer}`,
          "",
        );
      } else if (step.visionError) {
        lines.push(`Verdict: **not checked** — ${step.visionError}`, "");
      } else if (!visionEnabled) {
        lines.push(`Verdict: **not checked** — ${visionStatus()}`, "");
      } else {
        lines.push("Verdict: **pending**", "");
      }
    }

    lines.push(
      `![Step ${step.index}: ${step.title}](${step.image ?? `${step.index}.png`})`,
      "",
    );
    return lines.join("\n");
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
   * Write the scenario index and run the visual checks. Called by the fixture
   * after every test.
   *
   * A test that never called `step()` still gets one final screenshot, so every
   * scenario has documentation even without explicit instrumentation.
   *
   * When the scenario passed, every step with a `shows` expectation is checked
   * against its screenshot by the vision model. A `NO` verdict or a persistent
   * API error fails the test from this teardown, so the screenshots cannot
   * silently drift away from the narrative.
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

    if (!error && visionEnabled && !visionConfigured) {
      // Asking for checks without a model is a configuration error, not a
      // reason to report 50 unrelated failures once per screenshot.
      writeFileSync(join(this.directory, "index.md"), this.indexMarkdown());
      throw new Error(
        "Automatic screenshot checks are enabled, but no vision model is configured. " +
          "Set SAIA_API_ENDPOINT and SAIA_API_KEY, or run with E2E_VISION=0.",
      );
    }

    let mismatches: RecordedStep[] = [];
    let checkErrors: RecordedStep[] = [];
    if (!error && visionEnabled) {
      ({ mismatches, checkErrors } = await this.verifyScreenshots());
    }

    if (error) {
      for (const step of this.steps) {
        if (step.shows && !step.vision && !step.visionError) {
          step.visionError = "scenario failed; screenshots are not checked";
          this.writeStep(step);
        }
      }
    }

    writeFileSync(join(this.directory, "index.md"), this.indexMarkdown());

    if (!error && (mismatches.length || checkErrors.length)) {
      const describe = (step: RecordedStep): string =>
        `${step.index}. ${step.title}: ${
          step.vision
            ? `expected “${step.shows}” but the vision model said “${step.vision.answer}”`
            : `could not be checked (${step.visionError})`
        }`;
      throw new Error(
        `Screenshot documentation check failed for ${mismatches.length + checkErrors.length} step(s):\n` +
          [...mismatches, ...checkErrors].map(describe).join("\n"),
      );
    }
  }

  /**
   * Ask the vision model about every step that declares what it should show.
   * Verdicts are written back into the step Markdown, so a reader sees both the
   * expectation and the answer next to the screenshot.
   */
  private async verifyScreenshots(): Promise<{
    mismatches: RecordedStep[];
    checkErrors: RecordedStep[];
  }> {
    const candidates = this.steps.filter(
      (step) => step.shows && step.image && existsSync(join(this.directory, step.image)),
    );
    debug(
      `vision ${visionStatus()} steps=${candidates.length}/${this.steps.length}`,
    );

    await Promise.all(
      candidates.map(async (step) => {
        try {
          step.vision = await verifyScreenshot({
            imagePath: join(this.directory, step.image as string),
            expectation: step.shows as string,
          });
        } catch (failure) {
          step.visionError =
            failure instanceof Error ? failure.message : String(failure);
        }
        this.writeStep(step);
      }),
    );

    return {
      mismatches: candidates.filter((step) => step.vision && !step.vision.ok),
      checkErrors: candidates.filter((step) => step.visionError),
    };
  }
}
