import type { APIRequestContext, Page } from "@playwright/test";

import { expect, mockApi, openApp, sendPrompt, test } from "./fixtures";

/**
 * Tags narrow an Arcana without copying files.
 *
 * The service is the deterministic stand-in in `scripts/mock-saia-rag.mjs`,
 * which the RAG app instance (`fixtures/front.e2e-rag.json`) reaches at
 * `<backendPath>/mcp/saia-rag`. It holds one collection, `demo/papers`, with
 * three files: `quarterly-report.pdf` (finance), `handbook.md` (hr) and
 * `budget-summary.md` (finance + hr). That is what lets the two journeys tell
 * one tag from an AND over two:
 *
 *   1. the collection's own page: the tag chips filter the file list, and the
 *      same filter narrows a search in the Search tab;
 *   2. a normal chat: a share link wires the collection, the model asks for
 *      `search_arcana` with a tag, and the call reaches the service with it.
 *
 * The mock records every tool call at `GET /__calls`, so the scenarios assert
 * what the service was actually asked for, not only what the UI painted.
 *
 * Everything else is mocked as in the rest of the suite (`/models`, `/user`,
 * `/chat/completions`), so no model or real service is needed.
 */

// The mock's control endpoint, next to the app's `backendPath`
// (`fixtures/front.e2e-rag.json`), so no second knob is needed.
const RAG_MOCK = (process.env.E2E_RAG_MOCK_URL ?? "http://127.0.0.1:8096").replace(
  /\/+$/,
  "",
);
const COLLECTION = "demo/papers";
const COLLECTION_PAGE = `/arcana/${encodeURIComponent(COLLECTION)}`;
const FINANCE = "quarterly-report.pdf";
const HR = "handbook.md";
const BOTH = "budget-summary.md";

interface RagCall {
  name: string;
  args: Record<string, unknown>;
}

/** Every tool call the mock has answered, oldest first. */
async function calls(request: APIRequestContext): Promise<RagCall[]> {
  const response = await request.get(`${RAG_MOCK}/__calls`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { calls?: RagCall[] };
  return Array.isArray(body.calls) ? body.calls : [];
}

/** The most recent call of one tool, or `null` when it never ran. */
async function lastCall(
  request: APIRequestContext,
  name: string,
): Promise<RagCall | null> {
  const all = await calls(request);
  for (let index = all.length - 1; index >= 0; index -= 1) {
    if (all[index].name === name) return all[index];
  }
  return null;
}

// Serial: the second journey reads the call log the first one has written, and
// both share the mock service and its in-memory collection.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context, request }) => {
  // Reset the service's files, tags and call log, so a rerun starts clean.
  const reset = await request.post(`${RAG_MOCK}/__reset`);
  expect(reset.ok()).toBeTruthy();

  // Advanced mode (which reveals the Arcanas section of the sidebar) comes from
  // the app's own config (`userSettings` in `fixtures/front.e2e-rag.json`).
  // Seeding `user_settings` here instead would replace the whole slice, because
  // redux-persist hands a persisted slice to the reducer as-is: every default
  // the seed does not name (`memories`, `timeout`, …) would be missing.
  await context.addInitScript(() => {
    localStorage.setItem("chatai.arcana.editor-open", "true");
  });
});

const tagChip = (page: Page, tag: string) =>
  page.getByRole("button", { name: new RegExp(`^${tag}\\b`) });

test.describe("arcana tags", () => {
  test("filters a collection's files and search by tag", async ({
    page,
    doc,
    request,
  }) => {
    const manager = page.locator('[data-guide="arcana-manager"]').first();

    await doc.step(
      "Open the collection page",
      {
        user: "The user opens the Arcanas section of the sidebar and picks the collection “papers”.",
        system:
          "The collection's own page opens: a chat for it in the middle and its files, search and sharing in the right-hand panel.",
        shows:
          "the Arcana page for papers with a chat column and a right-hand panel listing three files",
      },
      async () => {
        await openApp(page, COLLECTION_PAGE);

        await expect(
          page
            .locator('[data-guide="arcanas"] [data-guide="arcana-row"]')
            .filter({ hasText: "papers" }),
        ).toBeVisible({ timeout: 20_000 });
        await expect(
          page.locator('[data-guide="arcana-chat-banner"]'),
        ).toContainText("papers");
        await expect(manager).toHaveAttribute("data-collection", COLLECTION);
        await expect(
          manager.getByText(BOTH, { exact: true }),
        ).toBeVisible({ timeout: 20_000 });
      },
    );

    await doc.step(
      "Filter the file list by one tag",
      {
        user: "The user clicks the tag chip “finance” above the file list.",
        system:
          "Only the two files carrying that tag stay visible; the line under the chips says how many of the files match.",
        shows:
          "the file list showing quarterly-report.pdf and budget-summary.md while handbook.md is gone, with “2 of 3 file(s) match the selected tags”",
      },
      async () => {
        await tagChip(page, "finance").click();

        await expect(
          manager.getByText("2 of 3 file(s) match the selected tags."),
        ).toBeVisible();
        await expect(manager.getByText(HR, { exact: true })).toHaveCount(0);
        await expect(manager.getByText(FINANCE, { exact: true })).toBeVisible();
      },
    );

    await doc.step(
      "Add a second tag",
      {
        user: "The user also clicks the chip “hr”.",
        system:
          "The filter is an AND: only files carrying both tags remain, which is budget-summary.md.",
        shows:
          "the file list reduced to budget-summary.md with “1 of 3 file(s) match the selected tags”",
      },
      async () => {
        await tagChip(page, "hr").click();

        await expect(
          manager.getByText("1 of 3 file(s) match the selected tags."),
        ).toBeVisible();
        await expect(manager.getByText(BOTH, { exact: true })).toBeVisible();
        await expect(manager.getByText(FINANCE, { exact: true })).toHaveCount(0);
      },
    );

    await doc.step(
      "Clear the file filter",
      {
        user: "The user clicks Clear next to the chips.",
        system:
          "All three files are listed again and the match line disappears.",
        shows: "the file list with all three files and no active tag chips",
      },
      async () => {
        await page.locator('[data-guide="arcana-clear-filter"]').click();

        await expect(manager.getByText(HR, { exact: true })).toBeVisible();
        await expect(
          page.locator('[data-guide="arcana-clear-filter"]'),
        ).toHaveCount(0);
      },
    );

    await doc.step(
      "Search inside the tagged files",
      {
        user: "The user keeps the chip “finance”, switches to the Search tab and searches for “budget”.",
        system:
          "The query is sent with the tag filter, so the service searches only the finance files and handbook.md is absent from the hits.",
        shows:
          "the Search tab with the finance chip active and result rows for budget-summary.md and quarterly-report.pdf",
      },
      async () => {
        await tagChip(page, "finance").click();
        await page.locator('[data-guide="arcana-tab-search"]').click();
        await page.getByPlaceholder("Search this Arcana").fill("budget");
        await page.locator('[data-guide="arcana-search-run"]').click();

        await expect(manager.getByText(BOTH, { exact: true })).toBeVisible({
          timeout: 20_000,
        });
        await expect(
          manager.getByText(FINANCE, { exact: true }),
        ).toBeVisible();
        await expect(manager.getByText(HR, { exact: true })).toHaveCount(0);

        await expect
          .poll(async () => (await lastCall(request, "search_preview"))?.args ?? null)
          .toEqual({
            collection: COLLECTION,
            query: "budget",
            count: 5,
            tags: ["finance"],
          });
      },
    );

    await doc.step(
      "Clear the filter and search again",
      {
        user: "The user clears the tag filter while the results are on screen.",
        system:
          "The search runs again without tags, so the handbook is searched too and its text appears among the hits.",
        shows:
          "the Search tab without an active tag and a result row for handbook.md",
      },
      async () => {
        await manager.getByRole("button", { name: "Clear", exact: true }).click();

        await expect(manager.getByText(HR, { exact: true })).toBeVisible({
          timeout: 20_000,
        });

        await expect
          .poll(async () => (await lastCall(request, "search_preview"))?.args ?? null)
          .toEqual({ collection: COLLECTION, query: "budget", count: 5 });
      },
    );
  });

  test("narrows a chat's Arcana search with a tag", async ({ page, doc, request }) => {
    await mockApi(page, {
      // The model asks for exactly one search, with the tag the user named.
      toolCall: {
        name: "search_arcana",
        arguments: { query: "budget", tags: ["finance"] },
      },
      reply: () =>
        "Only the finance files were searched: the operating budget is 2.4M EUR.",
    });

    await doc.step(
      "Open a chat wired to the collection",
      {
        user: "The user follows the collection's chat link, which opens a chat bound to demo/papers.",
        system:
          "The share link adds the collection to the chat's Arcana Tools and switches the tools on, so the chat's prompt box is ready without any manual setup.",
        shows: "an empty chat with the prompt box and the Arcana Tools share already wired",
      },
      async () => {
        await openApp(
          page,
          `/chat?arcana-tools=${encodeURIComponent(COLLECTION)}&enable_tools=true`,
        );
        await expect(page.locator('textarea[name="prompt"]')).toBeVisible();
      },
    );

    await doc.step(
      "Ask a question that names a tag",
      {
        user: "The user asks which budget the finance files report.",
        system:
          "The assistant calls search_arcana with the tag finance. The app passes the tag to the service’s search_chunks call, so only files carrying it are searched, and then answers with the passage.",
        shows:
          "the chat with the reply “Only the finance files were searched: the operating budget is 2.4M EUR.”",
      },
      async () => {
        await sendPrompt(page, "Which budget do the finance files report?");

        await expect(
          page.getByText(
            "Only the finance files were searched: the operating budget is 2.4M EUR.",
            { exact: true },
          ),
        ).toBeVisible({ timeout: 40_000 });

        await expect
          .poll(async () => (await lastCall(request, "search_chunks"))?.args ?? null)
          .toEqual({
            collection: COLLECTION,
            query: "budget",
            count: 5,
            tags: ["finance"],
          });
      },
    );
  });

  test("lists the documents of one tag from a chat", async ({
    page,
    doc,
    request,
  }) => {
    await mockApi(page, {
      // The second of the two chat tools that take tags.
      toolCall: {
        name: "list_arcana_documents",
        arguments: { tags: ["finance"] },
      },
      reply: () =>
        "Two finance files are indexed: quarterly-report.pdf and budget-summary.md.",
    });

    await doc.step(
      "Open the collection's chat and ask what it holds",
      {
        user: "The user asks which files are tagged finance.",
        system:
          "The assistant calls list_arcana_documents with the tag. The app sends list_files with that tag and asks for each file’s tags in the same call, so the answer names only the two finance files.",
        shows:
          "the chat with the reply “Two finance files are indexed: quarterly-report.pdf and budget-summary.md.”",
      },
      async () => {
        await openApp(
          page,
          `/chat?arcana-tools=${encodeURIComponent(COLLECTION)}&enable_tools=true`,
        );
        await sendPrompt(page, "Which files are tagged finance?");

        await expect(
          page.getByText(
            "Two finance files are indexed: quarterly-report.pdf and budget-summary.md.",
            { exact: true },
          ),
        ).toBeVisible({ timeout: 40_000 });

        // The listing is the service's own filter, not a filter applied after
        // the fact: `handbook.md` carries only `hr` and is never asked for.
        await expect
          .poll(async () => (await lastCall(request, "list_files"))?.args ?? null)
          .toEqual({
            collection: COLLECTION,
            tags: ["finance"],
            include_tags: true,
          });
      },
    );
  });
});
