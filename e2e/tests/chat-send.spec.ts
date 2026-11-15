import { expect, openApp, sendPrompt, test } from "./fixtures";

test.describe("chat", () => {
  test("sends a prompt and renders the streamed answer", async ({
    page,
    doc,
  }) => {
    await doc.step(
      "Open the app",
      {
        user: "The user opens Chat AI.",
        system:
          "The welcome tour is dismissed and an empty conversation with the prompt box is shown.",
        shows:
          "the Chat AI chat page with a conversation area and a prompt input at the bottom",
      },
      () => openApp(page),
    );

    await doc.step(
      "Send a prompt",
      {
        user: "The user types “Hello from the deterministic suite” and clicks Send.",
        system:
          "The message appears in the conversation and the assistant streams its answer back token by token.",
        shows:
          "the chat with the user message Hello from the deterministic suite and the assistant reply labelled Mocked reply to: Hello from the deterministic suite",
      },
      async () => {
        await sendPrompt(page, "Hello from the deterministic suite");
        await expect(
          page.getByText("Mocked reply to: Hello from the deterministic suite", {
            exact: true,
          }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Check the finished exchange",
      {
        user: "The user reads the answer.",
        system:
          "The sent prompt and the full answer stay visible, and the prompt box is empty and ready for the next message.",
        shows:
          "the chat with the user message and the assistant reply visible and an empty prompt input",
      },
      async () => {
        await expect(
          page.getByText("Hello from the deterministic suite", { exact: true }),
        ).toBeVisible();
        await expect(page.locator('textarea[name="prompt"]')).toHaveValue("");
      },
    );
  });
});
