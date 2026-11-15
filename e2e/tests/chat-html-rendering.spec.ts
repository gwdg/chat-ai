import { expect, mockApi, openApp, sendPrompt, test } from "./fixtures";

/**
 * HTML fenced blocks render in a sandboxed iframe. This scenario walks from the
 * code view to the rendered document and checks that the sanitizer removed the
 * script the model tried to include.
 */
test.describe("HTML rendering", () => {
  test("renders a sanitized HTML block instead of showing the tags", async ({
    page,
    doc,
  }) => {
    await mockApi(page, {
      reply: () =>
        "Here is a small HTML document:\n\n" +
        "```html\n" +
        "<h1>Rendered HTML</h1>\n" +
        "<p><strong>Sanitized</strong> and <em>safe</em>.</p>\n" +
        "<script>window.parent.__e2eHtmlExecuted = true;</script>\n" +
        "```\n",
    });

    await doc.step(
      "Ask the model for HTML",
      {
        user: "The user opens the app and sends “Show me some HTML”.",
        system:
          "The assistant streams a fenced html block. HTML blocks start as code by default, so the source is shown with its tags.",
        shows:
          "the chat with a fenced HTML code block showing the source tags",
      },
      async () => {
        await openApp(page);
        await sendPrompt(page, "Show me some HTML");
        await expect(
          page
            .locator(".custom-syntax-highlighter")
            .filter({ hasText: "Rendered HTML" })
            .first(),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Render the HTML block",
      {
        user: "The user clicks “Render HTML (Strict)” on the code block.",
        system:
          "The block switches to a sandboxed iframe with an opaque origin. The heading renders as live markup inside that frame.",
        shows:
          "the chat with the rendered HTML document showing the heading Rendered HTML",
      },
      async () => {
        const toggle = page
          .getByRole("button", { name: /Render HTML/ })
          .last();
        await expect(toggle).toBeVisible();
        await toggle.click();

        const frame = page.frameLocator("iframe.html-block");
        await expect(
          frame.getByRole("heading", { name: "Rendered HTML" }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(frame.getByText("Sanitized")).toBeVisible();
        await expect(frame.getByText("safe")).toBeVisible();
      },
    );

    await doc.step(
      "Confirm the script was removed",
      {
        user: "The user checks that the model's script did not run.",
        system:
          "The strict sanitizer stripped the <script> element, and the iframe cannot reach the parent page, so no flag is set.",
        shows:
          "the chat with the rendered HTML document still showing the heading Rendered HTML",
      },
      async () => {
        const frame = page.frameLocator("iframe.html-block");
        await expect(frame.locator("script")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => (window as { __e2eHtmlExecuted?: boolean }).__e2eHtmlExecuted,
          ),
        ).toBeUndefined();
      },
    );
  });
});
