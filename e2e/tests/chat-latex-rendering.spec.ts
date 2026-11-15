import { expect, mockApi, openApp, sendPrompt, test } from "./fixtures";

test.describe("LaTeX rendering", () => {
  test("renders inline math and a fenced LaTeX block", async ({ page, doc }) => {
    await mockApi(page, {
      reply: () =>
        "Einstein wrote $E = mc^2$ in 1905.\n\n" +
        "```latex\n$\\frac{a}{b} + \\sqrt{x}$\n```\n",
    });

    await doc.step(
      "Show a reply with math",
      {
        user: "The user opens the app and sends “Show me LaTeX”.",
        system:
          "The assistant streams a sentence with inline math and a fenced latex block. Inline math is typeset while the block stays in its code view.",
        shows:
          "the chat with a reply containing the Einstein sentence and a fenced LaTeX code block",
      },
      async () => {
        await openApp(page);
        await sendPrompt(page, "Show me LaTeX");
        await expect(
          page.getByText("Einstein wrote", { exact: false }).first(),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Inline math is typeset by KaTeX",
      {
        user: "The user reads the normal reply text.",
        system:
          "KaTeX loads on demand and replaces $E = mc^2$ with a typeset formula, while the fenced block still shows its source.",
        shows:
          "the chat with the sentence Einstein wrote E = mc² in 1905 where E = mc² is typeset as a formula, followed by a LaTeX source code block that shows the fraction a over b plus the square root of x",
      },
      async () => {
        // Inline math is typeset by KaTeX, which loads on demand.
        await expect(page.locator(".katex").first()).toBeVisible({
          timeout: 20_000,
        });
      },
    );

    await doc.step(
      "Render the fenced LaTeX block",
      {
        user: "The user clicks “Render as LaTeX” on the code block.",
        system:
          "Because the renderer runs as WebAssembly in the browser, the app first asks for consent to download it. The block stays as code until the user decides.",
        shows:
          "a confirmation offering to download and render the LaTeX block",
      },
      async () => {
        // A fenced block starts as code. The toggle is part of the block itself.
        const toggle = page
          .getByRole("button", { name: "Render as LaTeX" })
          .last();
        await expect(toggle).toBeVisible();
        await toggle.click();

        const confirm = page.getByRole("button", {
          name: "Download and render",
        });
        await expect(confirm).toBeVisible();
      },
    );

    await doc.step(
      "Confirm the download and read the result",
      {
        user: "The user confirms the download.",
        system:
          "The LaTeX renderer produces an HTML document inside a shadow root, so its stylesheet cannot leak into the app. The formula is shown as rendered math.",
        shows:
          "the chat with a fraction and a square root rendered as typeset math",
      },
      async () => {
        const confirm = page.getByRole("button", {
          name: "Download and render",
        });
        await confirm.click();

        // The rendered article lives in a shadow root so its CSS cannot leak out.
        const document = page.locator("div.latex-document").last();
        await expect(document).toBeVisible({ timeout: 20_000 });
        await expect
          .poll(async () =>
            document.evaluate(
              (element) =>
                (element.shadowRoot?.textContent ?? "").trim().length,
            ),
          )
          .toBeGreaterThan(0);
      },
    );
  });
});
