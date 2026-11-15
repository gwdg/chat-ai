import { test, expect, openApp } from "./fixtures";

/**
 * Opt-in integration scenario: a local OpenCode agent, as a user would add it.
 *
 * Unlike the other specs, this one talks to a real `opencode serve` process
 * instead of mocking it. The Playwright config starts that server through
 * `scripts/opencode-server.mjs` when `E2E_OPENCODE=1`, with a fixed password and
 * port, and the app uses the agent in "Local agent" mode.
 *
 * The turn is a `!` shell command rather than a model prompt: it proves the
 * browser→server session, prompt and event path without depending on a model
 * provider or network access. Run it with `npm run test:opencode`.
 */

const ENABLED = process.env.E2E_OPENCODE === "1";
const SERVER_URL = (process.env.E2E_OPENCODE_URL ?? "http://127.0.0.1:4096").replace(/\/+$/, "");
const USERNAME = process.env.E2E_OPENCODE_USERNAME ?? "opencode";
const PASSWORD = process.env.E2E_OPENCODE_PASSWORD ?? "e2e-local-password";
const AGENT_NAME = "Local OpenCode agent";
const MARKER = "opencode-local-ok";

const auth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;

test.describe("local OpenCode agent", () => {
  test.skip(
    !ENABLED,
    "set E2E_OPENCODE=1 to run the local OpenCode scenario (npm run test:opencode)",
  );

  test("connects to a local server and runs a shell turn", async ({
    page,
    request,
    doc,
  }) => {
    test.slow();

    const dialog = page.getByRole("dialog");

    await doc.step(
      "Open the app",
      {
        user: "The user opens Chat AI with the Agents module enabled.",
        system: "An empty conversation is shown and the sidebar has an Agents section.",
      },
      () => openApp(page),
    );

    await doc.step(
      "Open the add-agent form",
      {
        user: "The user clicks the Spawn agent button in the Agents section.",
        system:
          "The Add agent dialog opens with a name, a Local agent toggle (on by default), an opencode server URL and a password field.",
      },
      async () => {
        // Add the agent through the sidebar, exactly as the UI offers it.
        await page.locator('[data-guide="agents-spawn"]').click();
        await expect(
          dialog.getByRole("heading", { name: "Add agent" }),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Configure the local agent",
      {
        user: "The user enters a name, the local server URL and its password.",
        system:
          "The form keeps Local agent checked, so the app will connect to this server directly instead of the configured defaults.",
      },
      async () => {
        await dialog
          .locator("label", { hasText: "Agent name" })
          .locator("input")
          .fill(AGENT_NAME);

        // Local mode is the default and is what points the app at this server.
        await expect(
          dialog
            .locator("label", { hasText: "Local agent" })
            .locator('input[type="checkbox"]'),
        ).toBeChecked();

        await dialog
          .locator("label", { hasText: "opencode server" })
          .locator("input")
          .fill(SERVER_URL);
        await dialog.locator('input[type="password"]').fill(PASSWORD);
      },
    );

    await doc.step(
      "Create the agent and its session",
      {
        user: "The user clicks Add agent.",
        system:
          "The app verifies the server, creates an OpenCode session named “Local OpenCode agent agent” and closes the dialog only after both calls succeeded.",
      },
      async () => {
        await dialog
          .getByRole("button", { name: "Add agent", exact: true })
          .click();

        // The modal closes only after GET /api/info and POST /api/session succeeded.
        await expect(dialog).toBeHidden({ timeout: 30_000 });

        // The server owns the session the app just created. It can appear a moment
        // after POST /api/session resolves, so poll instead of reading once.
        await expect
          .poll(
            async () => {
              const response = await request.get(`${SERVER_URL}/api/session`, {
                headers: { Authorization: auth },
              });
              if (!response.ok()) return [];
              const payload = await response.json();
              const sessions = Array.isArray(payload)
                ? payload
                : payload?.data ?? [];
              return sessions.map(
                (session: { title?: string }) => session.title,
              );
            },
            { timeout: 15_000 },
          )
          .toContain(`${AGENT_NAME} agent`);
      },
    );

    await doc.step(
      "The sidebar reports a healthy connection",
      {
        user: "The user looks at the new agent row.",
        system:
          "The sidebar polls the local server and shows the green status “Connected and idle” next to the agent instead of an unknown state.",
      },
      async () => {
        await expect(
          page.getByRole("status", { name: "Connected and idle" }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Open the agent workspace",
      {
        user: "The user clicks the agent row.",
        system:
          "The agent page opens with its files panel, an empty conversation and a composer bound to the OpenCode session.",
      },
      async () => {
        await page.locator(`button[title="${SERVER_URL}"]`).first().click();
        await expect(page).toHaveURL(/\/agent\/[^/]+$/, { timeout: 15_000 });
        await expect(page.locator("textarea").first()).toHaveAttribute(
          "placeholder",
          "No messages yet. Ask the agent something.",
        );
      },
    );

    await doc.step(
      "Run a shell turn",
      {
        user: "The user sends the shell command !echo opencode-local-ok.",
        system:
          "OpenCode runs the command in the session and streams its output back through the event stream, shown inline in the conversation.",
      },
      async () => {
        const composer = page.locator("textarea").first();
        await composer.fill(`!echo ${MARKER}`);
        await composer.press("Enter");
        await expect(
          page.getByText(MARKER, { exact: false }).first(),
        ).toBeVisible({ timeout: 30_000 });
      },
    );
  });
});
