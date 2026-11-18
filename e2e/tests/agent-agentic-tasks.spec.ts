import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Locator } from "@playwright/test";

import { test, expect, openApp, MOCK_MODELS } from "./fixtures";

/**
 * Opt-in scenario: a local OpenCode agent doing real agentic work.
 *
 * Unlike `agent-opencode.spec.ts` (which types a `!` shell command), this one
 * sends a *prompt*. A scripted OpenAI-compatible model
 * (`scripts/scripted-model.mjs`) is registered as the OpenCode provider, so the
 * tool calls are deterministic and offline, while everything else is genuine:
 * OpenCode executes `write`, `shell`, `read` and `edit` in its project, the
 * files land on disk, and the app renders the tool cards from the server's
 * message timeline.
 *
 * Turn 1: create `hello.py`, run it with python3, read it back.
 * Turn 2: edit the greeting, run it again.
 *
 * Run it with `npm run test:opencode` or
 * `npm run test:opencode:agentic` (see the e2e README).
 */

const ENABLED = process.env.E2E_OPENCODE === "1";
// A server you started yourself has to configure the `scripted` provider on its
// own; the bundled wrapper writes it for this run.
const BUNDLED_SERVER = !process.env.E2E_OPENCODE_URL;
const SERVER_URL = (process.env.E2E_OPENCODE_URL ?? "http://127.0.0.1:4096").replace(/\/+$/, "");
const USERNAME = process.env.E2E_OPENCODE_USERNAME ?? "opencode";
const PASSWORD = process.env.E2E_OPENCODE_PASSWORD ?? "e2e-local-password";
const AGENT_NAME = "Agentic OpenCode agent";

/** The OpenCode working directory the wrapper (and so the agent's files) use. */
const PROJECT_DIR = resolve(
  process.cwd(),
  process.env.E2E_OPENCODE_PROJECT ?? "results/opencode/project",
);
const FILE = "hello.py";
const FILE_PATH = resolve(PROJECT_DIR, FILE);

const auth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;

/**
 * The app only offers OpenCode models that also exist in its own catalogue, so
 * the mocked `/models` has to carry the scripted model's id.
 */
const SCRIPTED_MODEL = {
  id: "agentic",
  name: "Scripted Agent",
  description: "Deterministic model that drives the agentic e2e scenario.",
  company: "Chat AI e2e",
  contextLength: 200000,
  releaseDate: "2026-01-01",
  external: false,
  input: ["text"],
  output: ["text"],
};

const FIRST_PROMPT = `Create ${FILE} with a short Python greeting and run it with python3.`;
const SECOND_PROMPT = "Change the greeting to say edited and run it again.";
const fileContent = (): string => {
  try {
    return readFileSync(FILE_PATH, "utf8");
  } catch {
    return "";
  }
};

/**
 * Expand a tool card and scroll it into the middle of the conversation pane.
 *
 * The pane is a scroll container, so a `fullPage` screenshot still clips it:
 * without this the output of the last card in the timeline is hidden behind
 * the composer, which looks like a collapsed card in the documentation.
 */
const expandToolCard = async (card: Locator): Promise<void> => {
  await card.locator("summary").click();
  await card.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  );
};

test.describe("agentic tasks in a local OpenCode agent", () => {
  test.skip(
    !ENABLED,
    "set E2E_OPENCODE=1 to run the local OpenCode scenarios (npm run test:opencode)",
  );
  test.skip(
    !BUNDLED_SERVER,
    "the scripted model is only configured for the bundled OpenCode server; " +
      "configure a `scripted` provider yourself or unset E2E_OPENCODE_URL",
  );

  test("writes, runs, reads and edits a script", async ({
    page,
    request,
    doc,
  }) => {
    test.slow();

    // A previous run leaves its file behind; the first write must be visible as
    // a new one, not as an overwrite of unknown content.
    rmSync(FILE_PATH, { force: true });

    // Registered after the fixture's mocked routes, so it replaces /models with
    // the catalogue that also contains the scripted model.
    await page.route(/\/models(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [...MOCK_MODELS, SCRIPTED_MODEL] }),
      }),
    );

    const dialog = page.getByRole("dialog");
    const composer = page.locator("textarea").first();

    await doc.step(
      "Open Chat AI",
      {
        user: "The user opens Chat AI with the Agents module enabled.",
        system:
          "An empty conversation is shown. The sidebar lists the Chats, Workspace and Agents sections.",
        shows: "the Chat AI page with the sidebar and an Agents section",
      },
      () => openApp(page),
    );

    await doc.step(
      "Open the add-agent form",
      {
        user: "The user clicks the Spawn agent button in the Agents section.",
        system:
          "The Add agent dialog opens with a name field, the connection choice (GWDG service or OpenCode server), the server URL and its password.",
        shows: "the Add agent dialog with an agent name field and connection settings",
      },
      async () => {
        await page.locator('[data-guide="agents-spawn"]').click();
        await expect(dialog.getByRole("heading", { name: "Add agent" })).toBeVisible();
      },
    );

    await doc.step(
      "Connect the local OpenCode server",
      {
        user:
          "The user picks “OpenCode server”, names the agent and enters the local server URL and its password.",
        system:
          "The dialog switches from the GWDG agent service to a direct connection, so Chat AI talks to this `opencode serve` itself.",
        shows: "the Add agent dialog in OpenCode server mode, filled with a name, URL and password",
      },
      async () => {
        await dialog
          .getByRole("button", { name: "OpenCode server", exact: true })
          .click();

        await dialog
          .locator("label", { hasText: "Agent name" })
          .locator("input")
          .fill(AGENT_NAME);

        await dialog
          .locator("label", { hasText: "opencode server" })
          .locator("input")
          .fill(SERVER_URL);
        await dialog.locator('input[type="password"]').fill(PASSWORD);
      },
    );

    await doc.step(
      "Create the agent",
      {
        user: "The user clicks Add agent.",
        system:
          "Chat AI verifies the server, creates an OpenCode session and closes the dialog only after both calls succeeded.",
        shows: `the Chat AI page with the new ${AGENT_NAME} in the sidebar and no dialog`,
      },
      async () => {
        await dialog.getByRole("button", { name: "Add agent", exact: true }).click();
        await expect(dialog).toBeHidden({ timeout: 30_000 });

        // The server owns the session; it can appear a moment after POST resolves.
        await expect
          .poll(
            async () => {
              const response = await request.get(`${SERVER_URL}/api/session`, {
                headers: { Authorization: auth },
              });
              if (!response.ok()) return [];
              const payload = await response.json();
              const sessions = Array.isArray(payload) ? payload : payload?.data ?? [];
              return sessions.map((session: { title?: string }) => session.title);
            },
            { timeout: 15_000 },
          )
          .toContain(`${AGENT_NAME} agent`);
      },
    );

    await doc.step(
      "Open the agent workspace",
      {
        user: "The user clicks the agent row in the sidebar.",
        system:
          "The agent page opens with its files panel, an empty conversation and a composer bound to the OpenCode session.",
        shows: "the agent page with a files panel and an empty conversation composer",
      },
      async () => {
        await expect(
          page.getByRole("status", { name: "Connected and idle" }),
        ).toBeVisible({ timeout: 20_000 });
        await page.locator(`button[title="${SERVER_URL}"]`).first().click();
        await expect(page).toHaveURL(/\/agent\/[^/]+$/, { timeout: 15_000 });
        await expect(composer).toHaveAttribute(
          "placeholder",
          "No messages yet. Ask the agent something.",
        );
      },
    );

    await doc.step(
      "The session uses the scripted model",
      {
        user: "The user looks at the model chip in the composer.",
        system:
          "The session's model is Scripted Agent, the deterministic provider the isolated OpenCode project was configured with. The tool calls below are real; only the model's choices are fixed.",
        shows: "the composer model chip naming Scripted Agent",
      },
      async () => {
        await expect(
          page.locator(".model-selector").filter({ hasText: "Scripted Agent" }),
        ).toBeVisible({ timeout: 15_000 });
      },
    );

    await doc.step(
      "Ask the agent to create and run a script",
      {
        user: `The user sends: “${FIRST_PROMPT}”`,
        system:
          "Chat AI posts the prompt to the OpenCode session. The agent receives the tool catalogue and answers with a `write` call.",
        shows: "the agent conversation with a running task and no error banner",
      },
      async () => {
        await composer.fill(FIRST_PROMPT);
        await composer.press("Enter");
        await expect(composer).toHaveValue("");

        // The write call is the agent's first action. It appears once OpenCode
        // has executed it, so this also waits for the tool loop to start.
        await expect(
          page.locator("details").filter({ hasText: `write(${FILE})` }).first(),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    await doc.step(
      "The agent writes hello.py",
      {
        user: "The user expands the write tool call.",
        system:
          `OpenCode executed the write in its project directory. The card shows the call's input (path and content) and its result. ${FILE} now exists on disk in ${PROJECT_DIR}.`,
        shows: `an expanded write(${FILE}) card with the file content and a completed status`,
      },
      async () => {
        const card = page
          .locator("details")
          .filter({ hasText: `write(${FILE})` })
          .first();
        await expandToolCard(card);
        await expect(card).toContainText(`"path": "${FILE}"`);
        await expect(card).toContainText("hello from the scripted agent");
        await expect(card).toContainText("completed");

        await expect
          .poll(fileContent, { timeout: 10_000 })
          .toContain("hello from the scripted agent");
      },
    );

    await doc.step(
      "The agent runs the script",
      {
        user: "The user expands the shell tool call.",
        system:
          "OpenCode ran `python3 hello.py`. The card reports the command, the exit status and the program's stdout, which proves the file is valid Python rather than just text.",
        shows: "an expanded shell(python3 hello.py) card with the printed greeting and a completed status",
      },
      async () => {
        const card = page
          .locator("details")
          .filter({ hasText: `shell(python3 ${FILE})` })
          .first();
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expandToolCard(card);
        await expect(card).toContainText("hello from the scripted agent");
        await expect(card).toContainText("completed");
      },
    );

    await doc.step(
      "The agent verifies the file",
      {
        user: "The user expands the read tool call.",
        system:
          "The agent read the file it had just written and received the line-numbered content, so it can confirm what is on disk.",
        shows: `an expanded read(${FILE}) card showing the line-numbered file content`,
      },
      async () => {
        const card = page
          .locator("details")
          .filter({ hasText: `read(${FILE})` })
          .first();
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expandToolCard(card);
        await expect(card).toContainText(`print("hello from the scripted agent")`);
      },
    );

    await doc.step(
      "The agent reports the result",
      {
        user: "The user reads the agent's answer.",
        system:
          "The final assistant message names the file it created and the output it observed, closing the tool loop for this turn.",
        shows: "an assistant message stating that hello.py was created, run and read back",
      },
      async () => {
        const answer = page
          .locator(".markdown-body")
          .filter({ hasText: "Done. I created" });
        await expect(answer).toBeVisible({ timeout: 30_000 });
        await answer.evaluate((element) =>
          element.scrollIntoView({ block: "center" }),
        );
      },
    );

    await doc.step(
      "Preview the generated file",
      {
        user: `The user clicks “Preview” on the write card.`,
        system:
          `The docked preview panel loads ${FILE} from the agent server and renders its text, so the file the agent wrote is inspectable without leaving Chat AI.`,
        shows: `a preview panel titled ${FILE} showing the Python source`,
      },
      async () => {
        await page.getByRole("button", { name: `Preview ${FILE}` }).first().click();
        const panel = page.locator(`aside[aria-label="${FILE}"]`);
        await expect(panel).toBeVisible({ timeout: 15_000 });
        await expect(panel.getByRole("heading", { name: FILE })).toBeVisible();
        await expect(panel.locator("pre")).toContainText("hello from the scripted agent");
      },
    );

    await doc.step(
      "Ask for a second, editing task",
      {
        user: `The user closes the preview and sends: “${SECOND_PROMPT}”`,
        system:
          "The agent now answers with an `edit` call that replaces the greeting, runs the script again and reports the new output.",
        shows: "the conversation after the second prompt with an edit tool call",
      },
      async () => {
        await page.locator(`aside[aria-label="${FILE}"] button[aria-label="Close"]`).click();
        await expect(page.locator(`aside[aria-label="${FILE}"]`)).toBeHidden();

        await composer.fill(SECOND_PROMPT);
        await composer.press("Enter");
        await expect(composer).toHaveValue("");

        await expect(
          page.locator("details").filter({ hasText: `edit(${FILE})` }).first(),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    await doc.step(
      "The agent edits and re-runs the script",
      {
        user: "The user expands the second shell call.",
        system:
          "The edited file prints the new greeting. The edit is a targeted replacement, not a rewrite, and the shell output comes from the changed file on disk.",
        shows: "an expanded shell card with the edited greeting and a completed status",
      },
      async () => {
        const shellCards = page
          .locator("details")
          .filter({ hasText: `shell(python3 ${FILE})` });
        // The first card belongs to the first run, this one to the edited file.
        const card = shellCards.last();
        await expect(card).toContainText("hello from the edited agent", {
          timeout: 30_000,
        });
        await expandToolCard(card);
        await expect(card).toContainText("completed");

        await expect
          .poll(fileContent, { timeout: 10_000 })
          .toContain("hello from the edited agent");
        expect(fileContent()).not.toContain("hello from the scripted agent");

        await expect(
          page.locator(".markdown-body").filter({ hasText: "The greeting now says" }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );
  });
});
