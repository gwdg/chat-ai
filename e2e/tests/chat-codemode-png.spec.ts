import { expect, mockApi, openApp, openSidebar, test } from "./fixtures";

/**
 * The codemode tool runs model-written JavaScript in a QuickJS worker and
 * reaches the workspace through `tools.write`. This scenario mocks the model's
 * tool call, then lets the real agent loop, codemode sandbox and workspace
 * attachment make the file, and asserts the PNG appears in the reply.
 */

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const WORKSPACE = "Codemode workspace";

const code =
  `const result = await tools.write({ path: "/generated/pixel.png", ` +
  `content: "${PNG_BASE64}", encoding: "base64" });\n` +
  `text(result);\nreturn "created";`;

test.beforeEach(async ({ context }) => {
  // The right-hand panel starts collapsed to a rail below 1280 px. The scenario
  // needs its Files tab, and an explicit value overrides the viewport default.
  await context.addInitScript(() => {
    localStorage.setItem("chatai.meta.changes-collapsed", "false");
  });
});

test.describe("codemode", () => {
  test("creates a PNG file through the codemode tool", async ({
    page,
    doc,
  }) => {
    await mockApi(page, {
      toolCall: { name: "codemode", arguments: { code } },
      reply: () => "Created the PNG with codemode.",
    });

    await doc.step(
      "Open the app",
      {
        user: "The user opens Chat AI.",
        system: "An empty conversation with the prompt box is shown.",
        shows:
          "the Chat AI chat page with an empty conversation and a prompt input",
      },
      () => openApp(page),
    );

    // Below the md breakpoint the right-hand panel is hidden, so the file tree
    // is not reachable on a phone; the chat home is what that layout shows.
    const wideLayout = (page.viewportSize()?.width ?? 1280) >= 768;

    await doc.step(
      "Create a workspace",
      {
        user: "The user creates a workspace named “Codemode workspace” in the sidebar.",
        system:
          "The workspace page opens as its chat home, with the file tree in the right-hand panel. A workspace gives the agent file storage and write access.",
        shows: wideLayout
          ? "the workspace page for Codemode workspace with a chat home and a right-hand panel whose Files tab holds the file browser"
          : "the workspace page for Codemode workspace on a phone, with no chats yet and a prompt box",
      },
      async () => {
        await openSidebar(page);
        await page.getByRole("button", { name: "New workspace" }).click();
        await page
          .getByRole("dialog")
          .getByLabel("Workspace name")
          .fill(WORKSPACE);
        await page
          .getByRole("button", { name: "Create workspace", exact: true })
          .click();
        await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
        if (!wideLayout) {
          await expect(
            page.getByText("No chats in this workspace yet"),
          ).toBeVisible();
          return;
        }
        await page.getByRole("tab", { name: "Files" }).click();
        await expect(
          page.locator('[data-guide="workspace-files"]'),
        ).toBeVisible();
      },
    );

    await doc.step(
      "Open the workspace chat",
      {
        user: "The workspace page offers a prompt box that starts a chat inside the workspace.",
        system:
          "A chat started from the workspace page is linked to it immediately, so the agent can read and write the workspace files without attaching anything first.",
        shows:
          "the workspace page for Codemode workspace with an empty chat and its prompt box at the bottom",
      },
      async () => {
        // The prompt-box Workspace menu only exists once a chat has a
        // workspace, so the chat is started here: a prompt from the workspace
        // page links it at creation.
        await expect(
          page.getByText("No chats in this workspace yet"),
        ).toBeVisible();
        await expect(page.locator('textarea[name="prompt"]')).toBeVisible();
      },
    );

    await doc.step(
      "Ask the agent to create a PNG",
      {
        user: "The user sends “Create a tiny PNG with codemode”.",
        system:
          "The assistant calls the codemode tool with JavaScript. The sandbox runs that code, calls tools.write, stores a 1×1 PNG in the workspace and then streams a short confirmation.",
        shows:
          "the chat with the user message Create a tiny PNG with codemode and the assistant reply Created the PNG with codemode",
      },
      async () => {
        const prompt = page.locator('textarea[name="prompt"]');
        await prompt.fill("Create a tiny PNG with codemode");
        // Enter sends on desktop and tablet; phones default to Shift+Enter.
        const width = page.viewportSize()?.width ?? 1440;
        await prompt.press(width < 640 ? "Shift+Enter" : "Enter");

        await expect(
          page.getByText("Created the PNG with codemode.", { exact: true }),
        ).toBeVisible({ timeout: 40_000 });
      },
    );

    await doc.step(
      "Verify the generated image",
      {
        user: "The user looks at the codemode result in the reply.",
        system:
          "The generated file is served back into the chat as an image, shown with the alt text “pixel.png”.",
        shows:
          "the chat with an image named pixel.png in the assistant reply",
      },
      async () => {
        await expect(page.locator('img[alt="pixel.png"]').first()).toBeVisible({
          timeout: 20_000,
        });
      },
    );
  });
});
