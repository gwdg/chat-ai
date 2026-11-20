import { expect, modelSelectorButton, openApp, sendPrompt, test } from "./fixtures";

/**
 * Opt-in scenario: a real model behind a back service the user started.
 *
 * Everything else in `tests/` intercepts `/models`, `/user` and
 * `/chat/completions` so answers are byte-stable. This scenario turns those
 * mocks off (`mockUpstream: false` in the `real-model` project) and lets the app
 * talk to `E2E_BACKEND_URL`, which holds the API key. The front end is still the
 * real app, and the answer really streams.
 *
 * The question has a verifiable answer, so the test checks correctness instead
 * of matching generated wording. Run it with `npm run test:real`.
 */

const ENABLED = process.env.E2E_REAL_MODEL === "1";
const QUESTION = "What is 17 + 25? Reply with just the number.";

test.describe("real model", () => {
  test.skip(
    !ENABLED,
    "set E2E_REAL_MODEL=1 and start the back service (npm run test:real)",
  );

  test("answers with a real model behind your back service", async ({
    page,
    doc,
  }) => {
    test.slow();

    await doc.step(
      "Ask the model",
      {
        user: `The user opens Chat AI and sends “${QUESTION}”.`,
        system:
          "The app loads the model list from the back service instead of a mocked one, so the header shows the configured real model.",
        shows:
          "the chat with the user question and a model selector with a real model above the prompt box",
      },
      async () => {
        await openApp(page);
        await expect(await modelSelectorButton(page)).not.toContainText(
          "Alpha Mock Model",
        );
        await sendPrompt(page, QUESTION);
        await expect(page.getByText(QUESTION)).toBeVisible();
      },
    );

    await doc.step(
      "Read the answer",
      {
        user: "The user reads the streamed answer.",
        system:
          "The assistant streams the model's own answer from the back service; the test waits for it and checks the arithmetic.",
        shows: "an assistant answer that contains the number 42",
      },
      async () => {
        const answer = page.locator(".markdown-body").last();
        await expect(answer).toContainText("42", { timeout: 120_000 });
        // No mock text may leak in: this run must have reached the real backend.
        await expect(page.getByText("Mocked reply", { exact: false })).toHaveCount(0);
      },
    );
  });
});
