import { expect, openApp, sendPrompt, test } from "./fixtures";

test.describe("chat attachments", () => {
  test("attaches a text file and sends it with the prompt", async ({
    page,
    doc,
  }) => {
    await doc.step(
      "Open an empty chat",
      {
        user: "The user opens Chat AI.",
        system:
          "The welcome tour is dismissed and an empty conversation with the prompt box is shown.",
        shows:
          "the Chat AI chat page with an empty conversation and a prompt input",
      },
      () => openApp(page),
    );

    const card = page
      .locator('[data-guide="attachment-card"]')
      .filter({ hasText: "meeting-notes.txt" });

    await doc.step(
      "Attach a text file",
      {
        user: "The user attaches a local file named meeting-notes.txt.",
        system:
          "The file is read in the browser and appears as an attachment card above the prompt box, before anything is sent.",
        shows:
          "the chat prompt area with an attachment card named meeting-notes.txt",
      },
      async () => {
        // The AttachButton input is the only one without an `accept` filter; the
        // image/audio inputs next to it restrict their file types.
        await page
          .locator('.prompt-area input[type="file"]:not([accept])')
          .first()
          .setInputFiles({
            name: "meeting-notes.txt",
            mimeType: "text/plain",
            buffer: Buffer.from("alpha beta gamma\n"),
          });
        await expect(card).toBeVisible();
      },
    );

    await doc.step(
      "Ask about the attachment",
      {
        user: "The user sends “Summarize the attached notes”.",
        system:
          "The prompt and the attachment disappear from the prompt box, the message is stored locally and the assistant streams its answer.",
        shows:
          "the chat with the user message Summarize the attached notes and an assistant reply",
      },
      async () => {
        await sendPrompt(page, "Summarize the attached notes");
        await expect(
          page.getByText("Mocked reply to: Summarize the attached notes", {
            exact: true,
          }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Verify the sent message keeps the file",
      {
        user: "The user reads the answer and scrolls back to the sent message.",
        system:
          "The sent message still carries the meeting-notes.txt attachment and the prompt box is empty.",
        shows:
          "the chat with a meeting-notes.txt attachment in the sent message and an empty prompt input",
      },
      async () => {
        // The attachment is kept in the sent message, not only in the prompt box.
        await expect(
          page.getByText("meeting-notes.txt", { exact: true }).last(),
        ).toBeVisible();
        await expect(page.locator('textarea[name="prompt"]')).toHaveValue("");
      },
    );
  });
});
