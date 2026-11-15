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

    await doc.step(
      "Create a workspace",
      {
        user: "The user creates a workspace named “Codemode workspace” in the sidebar.",
        system:
          "The workspace page opens with its storage list and root folder. A workspace gives the agent file storage and write access.",
        shows:
          "the workspace page for Codemode workspace with a storage list and a file browser",
      },
      async () => {
        await openSidebar(page);
        await page.getByRole("button", { name: "New workspace" }).click();
        await page.getByPlaceholder("e.g. Research").fill(WORKSPACE);
        await page
          .getByRole("button", { name: "Create workspace", exact: true })
          .click();
        await expect(page).toHaveURL(/\/workspace\/[^/]+$/);
        await expect(page.getByText("Available storage")).toBeVisible();
      },
    );

    await doc.step(
      "Attach the workspace to the chat",
      {
        user: "Back in the chat, the user opens the Workspace popover and selects the workspace.",
        system:
          "The workspace option is pressed, so the chat has write access to that workspace. A “What's new” panel appears beside the conversation.",
        shows:
          "the chat page with an empty conversation and a workspace folder icon in the prompt toolbar",
      },
      async () => {
        await openApp(page);

        // Attach it through the prompt-box popover. The sidebar also has a row with
        // this name, so scope the click to the popover's aria-pressed options.
        await page.locator('[data-guide="chat-workspaces"]').click();
        const option = page
          .locator("button[aria-pressed]")
          .filter({ hasText: WORKSPACE });
        await expect(option).toBeVisible();
        await option.click();
        await page.keyboard.press("Escape");
        await expect(page.locator('[data-guide="chat-workspaces"]')).toBeVisible();
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
