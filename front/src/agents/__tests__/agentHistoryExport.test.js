import { describe, expect, it } from "vitest";
import {
  buildAgentHistoryJson,
  buildAgentHistoryMarkdown,
  buildAgentHistoryRestoreText,
} from "../agentHistoryExport";

const agent = {
  id: "agent-1",
  name: "HPC agent",
  serverUrl: "http://127.0.0.1:9000",
  sessionId: "session-1",
};

const cached = Date.UTC(2026, 0, 2, 3, 4, 5);

describe("agent history export", () => {
  it("marks a cached export in Markdown and JSON", () => {
    const markdown = buildAgentHistoryMarkdown({
      agent,
      messages: [{ id: "m1", type: "user", text: "hello" }],
      source: "cache",
      cachedAt: cached,
      exportedAt: new Date(0),
    });
    expect(markdown).toContain("- Source: local cache");
    expect(markdown).toContain("2026-01-02T03:04:05.000Z");

    const json = JSON.parse(
      buildAgentHistoryJson({
        agent,
        messages: [],
        source: "cache",
        cachedAt: cached,
        exportedAt: new Date(0),
      }),
    );
    expect(json.source).toBe("cache");
    expect(json.cachedAt).toBe("2026-01-02T03:04:05.000Z");
  });
});

describe("buildAgentHistoryRestoreText", () => {
  it("keeps the most recent messages within the size limit", () => {
    const messages = Array.from({ length: 40 }, (_, index) => ({
      id: `m${index}`,
      type: index % 2 === 0 ? "user" : "assistant",
      content: [{ type: "text", text: `Message ${index} ${"x".repeat(4000)}` }],
    }));

    const text = buildAgentHistoryRestoreText({
      agent,
      messages,
      cachedAt: cached,
      maxChars: 10_000,
    });

    expect(text.length).toBeLessThanOrEqual(10_000);
    expect(text).toContain("Message 39 ");
    expect(text).not.toContain("Message 0 ");
    expect(text).toContain("omitted to stay within the restore limit");
  });

  it("keeps user, assistant and tool text but drops reasoning", () => {
    const text = buildAgentHistoryRestoreText({
      agent,
      messages: [
        { id: "m1", type: "user", text: "Run the test" },
        {
          id: "m2",
          type: "assistant",
          content: [
            { type: "reasoning", text: "internal" },
            { type: "text", text: "Running it now." },
            { type: "tool", name: "bash" },
          ],
        },
      ],
    });

    expect(text).toContain("## User");
    expect(text).toContain("Run the test");
    expect(text).toContain("Running it now.");
    expect(text).toContain("Tool: bash");
    expect(text).not.toContain("internal");
  });
});
