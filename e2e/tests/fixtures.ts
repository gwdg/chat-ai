import {
  test as base,
  expect,
  type Page,
  type Route,
} from "@playwright/test";

import { ScenarioDocumentation } from "./documentation";

/**
 * Shared harness for the deterministic browser suite.
 *
 * `mockApi` installs stable responses for the three upstream endpoints the app
 * calls (/models, /user, /chat/completions). It is registered automatically for
 * every test, before the page navigates, so no test needs a real backend.
 */

export const MOCK_MODELS = [
  {
    // Must match the model id in `secrets/front.json` (`default.model.id`).
    // Without it the app replaces the stored model with a bare {id, name}
    // object, and the selector crashes on the missing capability arrays.
    id: "deepseek-v4.1-flash-1017",
    name: "Alpha Mock Model",
    description: "Deterministic test model used by the browser suite.",
    company: "GWDG",
    contextLength: 128000,
    releaseDate: "2026-01-01",
    external: false,
    input: ["text"],
    output: ["text"],
  },
  {
    id: "beta-mock-model",
    name: "Beta Mock Model",
    description: "Second deterministic model for selector tests.",
    company: "GWDG",
    contextLength: 64000,
    releaseDate: "2026-02-01",
    external: false,
    input: ["text"],
    output: ["text"],
  },
];

export const MOCK_TITLE = "Mocked conversation title";

export interface MockApiOptions {
  /** Builds the assistant reply from the latest user message. */
  reply?: (prompt: string) => string;
  /** Text returned by non-streaming calls, i.e. title generation. */
  title?: string;
  /**
   * Emit one function-tool call before the text reply. The second model call
   * (which carries the tool result) then streams `reply`, so agent turns that
   * must execute a browser tool can be tested without a real model.
   */
  toolCall?: { name: string; arguments: Record<string, unknown> };
}

const sseChunk = (
  delta: Record<string, unknown>,
  finishReason: string | null = null,
) =>
  `data: ${JSON.stringify({
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: 1767225600,
    model: "alpha-mock-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  })}\n\n`;

const lastUserText = (body: unknown): string => {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages)) return "";
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as { role?: string; content?: unknown };
    if (message?.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((part) =>
          part && typeof part === "object" && "text" in part
            ? String((part as { text?: unknown }).text ?? "")
            : "",
        )
        .join(" ")
        .trim();
    }
  }
  return "";
};

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

export async function mockApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  const reply =
    options.reply ??
    ((prompt: string) =>
      prompt ? `Mocked reply to: ${prompt}` : "Mocked reply.");
  const title = options.title ?? MOCK_TITLE;

  await page.route(/\/models(\?.*)?$/, (route) =>
    fulfillJson(route, { data: MOCK_MODELS }),
  );

  await page.route(/\/user(\?.*)?$/, (route) =>
    fulfillJson(route, {
      username: "e2e-user",
      firstname: "E2E",
      lastname: "User",
      organization: "GWDG",
    }),
  );

  await page.route(/\/chat\/completions(\?.*)?$/, async (route) => {
    let body: Record<string, unknown> = {};
    try {
      body = (route.request().postDataJSON() as Record<string, unknown>) ?? {};
    } catch {
      body = {};
    }

    if (body.stream) {
      const messages = Array.isArray(body.messages)
        ? (body.messages as Array<{ role?: string }>)
        : [];
      const hasToolResult = messages.some(
        (message) => message.role === "tool" || message.role === "tool_result",
      );

      if (options.toolCall && !hasToolResult) {
        const { name, arguments: args } = options.toolCall;
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
          body: [
            sseChunk({
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "call_e2e_tool",
                  type: "function",
                  function: { name, arguments: "" },
                },
              ],
            }),
            sseChunk({
              tool_calls: [
                { index: 0, function: { arguments: JSON.stringify(args) } },
              ],
            }),
            sseChunk({}, "tool_calls"),
            "data: [DONE]\n\n",
          ].join(""),
        });
        return;
      }

      const text = reply(lastUserText(body));
      await route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
        body: [
          sseChunk({ role: "assistant", content: "" }),
          sseChunk({ content: text }),
          sseChunk({}, "stop"),
          "data: [DONE]\n\n",
        ].join(""),
      });
      return;
    }

    await fulfillJson(route, {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: 1767225600,
      model: "alpha-mock-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: title },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  });
}

/** The first-visit welcome dialog covers the app until it is dismissed. */
export async function dismissWelcome(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Skip tour" });
  try {
    await skip.waitFor({ state: "visible", timeout: 8_000 });
    await skip.click();
    await expect(skip).toBeHidden();
  } catch {
    // First visit only; later navigations in the same test do not show it.
  }
}

/** Navigate to an app path and dismiss the welcome dialog if it appears. */
export async function openApp(page: Page, path = "/"): Promise<void> {
  await page.goto(path);
  await dismissWelcome(page);
}

/** The sidebar is docked on desktop, a rail on tablets and a drawer on phones. */
export async function openSidebar(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 1280;

  if (width < 1280) {
    // `isVisible()` cannot detect the closed drawer: it stays in the DOM and is
    // only translated off-screen, which Playwright still reports as visible.
    if (await sidebarDrawerOpen(page)) return;

    if (width < 768) {
      const hamburger = page.locator("nav button.touch-manipulation").first();
      await hamburger.click();
    } else {
      const expand = page.getByRole("button", { name: "Expand" }).first();
      await expand.click();
    }

    await expect
      .poll(() => sidebarDrawerOpen(page), { timeout: 5_000 })
      .toBe(true);
    return;
  }

  await expect(
    page.getByRole("button", { name: "New Chat" }).first(),
  ).toBeVisible();
}

/**
 * The model picker moved into the header below `md`, where the prompt-box chip
 * is `hidden md:flex`. Return whichever one this device class actually shows.
 */
export async function modelSelectorButton(page: Page) {
  const header = page.locator(".model-selector-header button").first();
  if (await header.isVisible().catch(() => false)) return header;
  return page.locator(".prompt-area .model-selector button").first();
}

export async function sendPrompt(page: Page, text: string): Promise<void> {
  const prompt = page.locator('textarea[name="prompt"]');
  await expect(prompt).toBeVisible();
  await prompt.fill(text);
  await page.locator('[data-guide="send"]').click();
}

/** Open the tutorial catalog on /meta and start the named guide. */
export async function startTutorial(page: Page, title: string) {
  await page.getByRole("button", { name: "Browse tutorials" }).click();
  await page.getByRole("button", { name: title, exact: true }).click();
  const panel = page.locator("div[data-guide-keep-open]");
  await expect(panel).toContainText(title);
  return panel;
}

/** True when the overlay sidebar drawer is covering the content. */
export async function sidebarDrawerOpen(page: Page): Promise<boolean> {
  const width = page.viewportSize()?.width ?? 1280;
  if (width >= 1280) return false;
  const className = await page
    .locator("#sidebardrawer")
    .getAttribute("class")
    .catch(() => null);
  return Boolean(className?.includes("translate-x-0"));
}

/**
 * Close the overlay drawer so targets in the main content can be clicked.
 * On desktop the sidebar is docked, not an overlay, so this is a no-op.
 */
export async function closeSidebarOverlay(page: Page): Promise<void> {
  if (!(await sidebarDrawerOpen(page))) return;

  // The drawer has its own close button. Clicking the backdrop's centre is not
  // reliable because the drawer is wide enough on tablets to cover it.
  const close = page.getByRole("button", { name: "Close Sidebar" }).first();
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
    const drawer = await page.locator("#sidebardrawer").boundingBox();
    const x = Math.min(
      viewport.width - 8,
      (drawer?.x ?? 0) + (drawer?.width ?? 0) + 16,
    );
    await page.mouse.click(x, viewport.height / 2);
  }

  await expect
    .poll(() => sidebarDrawerOpen(page), { timeout: 5_000 })
    .toBe(false);
}

/**
 * The tutorial progress panel lives in the sidebar. Re-open the overlay after
 * it was closed to interact with the content, on phones through the menu and
 * on tablets through the compact tutorial button in the rail.
 */
export async function showTutorialPanel(page: Page) {
  const panel = page.locator("div[data-guide-keep-open]");
  const width = page.viewportSize()?.width ?? 1280;

  if (await sidebarDrawerOpen(page)) return panel;

  if (width < 768) {
    const hamburger = page.locator("nav button.touch-manipulation").first();
    if (await hamburger.isVisible().catch(() => false)) await hamburger.click();
  } else if (width < 1280) {
    const compact = page
      .locator('button[title^="Tutorial progress"]')
      .first();
    if (await compact.isVisible().catch(() => false)) await compact.click();
  }

  if (width < 1280) {
    await expect
      .poll(() => sidebarDrawerOpen(page), { timeout: 5_000 })
      .toBe(true);
  }
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Every test gets fresh browser state (localStorage + IndexedDB), mocked APIs
 * and a documentation recorder.
 *
 * Overriding `page` guarantees the routes exist before the first navigation.
 * The `doc` fixture writes per-step screenshots and narratives under
 * `results/documentation/<scenario>/<project>/`. Tests that never call
 * `doc.step()` still get one automatic final screenshot from the fixture
 * teardown, so every scenario produces usable documentation.
 */
export const test = base.extend<{ doc: ScenarioDocumentation }>({
  page: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
  // `auto` sets the fixture up for every test, even those that never mention
  // `doc`, so every scenario ends up with at least one screenshot.
  doc: [
    async ({ page }, use, testInfo) => {
      const documentation = new ScenarioDocumentation(page, testInfo);
      await use(documentation);
      await documentation.finish(testInfo.error);
    },
    { auto: true },
  ],
});

export { expect };
