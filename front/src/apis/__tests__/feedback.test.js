import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteAllFeedback,
  enrichedFeedbackMessagesFromConversation,
  feedbackConversationIdFromRoute,
  feedbackMessagesFromConversation,
  feedbackTranscriptSignature,
  isChatFeedbackEnabled,
  listFeedback,
  submitConversationAnalysis,
  submitFeedbackComment,
  submitFeedbackRating,
  submitFeedbackReport,
} from "../feedback";
import { getBrandProfile, setCurrentBrand } from "../../config/brands";
import { clearBrandFeatureCache } from "../../config/brandFeatures";

const jsonResponse = (body, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const callArgs = (fetchImpl) => fetchImpl.mock.calls.at(-1);

beforeEach(() => {
  vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "http://feedback.test/feedback");
  vi.stubEnv("VITE_MODULE_FEEDBACK", "true");
  vi.stubEnv("VITE_API_KEY", "");
  vi.stubEnv("VITE_FAKE_AUTH_HEADERS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  setCurrentBrand(null);
  clearBrandFeatureCache();
});

describe("feedback delivery", () => {
  it("is enabled only when the module and a receiver are configured", () => {
    expect(isChatFeedbackEnabled()).toBe(true);
    vi.stubEnv("VITE_MODULE_FEEDBACK", "false");
    expect(isChatFeedbackEnabled()).toBe(false);
    vi.stubEnv("VITE_MODULE_FEEDBACK", "true");
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "");
    expect(isChatFeedbackEnabled()).toBe(false);
  });

  it("posts a thumbs rating as JSON without starting a model turn", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "alice/saia-feedback/1" }));

    await submitFeedbackRating({
      rating: 1,
      result: "The answer",
      comment: "Helpful",
      messages: [{ role: "user", content: "Hi" }],
      model: { id: "deepseek" },
      conversationId: "conv-1",
      title: "A chat",
      fetchImpl,
    });

    const [url, init] = callArgs(fetchImpl);
    expect(url).toBe("http://feedback.test/feedback");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      kind: "rating",
      rating: "up",
      result: "The answer",
      comment: "Helpful",
      model: "deepseek",
    });
    expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    // The chat id travels on its own field too, which is the receiver's column,
    // so an export can group this rating with its conversation.
    expect(body.conversation_id).toBe("conv-1");
    expect(body.context).toMatchObject({
      source: "chat-ai",
      conversation_id: "conv-1",
      conversation_title: "A chat",
    });
  });

  it("sends the conversation for analysis as a report", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "x" }));

    await submitConversationAnalysis({
      conversation: {
        id: "conv-2",
        title: "Rust basics",
        messages: [
          { role: "system", content: "You are helpful" },
          { role: "user", content: "What is ownership?" },
          { role: "assistant", content: "It is a set of rules." },
        ],
      },
      model: "deepseek",
      route: "/chat/conv-2",
      fetchImpl,
    });

    const body = JSON.parse(callArgs(fetchImpl)[1].body);
    expect(body.kind).toBe("report");
    expect(body.type).toBe("feedback");
    expect(body.message).toContain("Rust basics");
    expect(body.mode).toBe("delta");
    expect(body.offset).toBe(0);
    expect(body.conversation_id).toBe("conv-2");
    expect(body.messages).toEqual([
      { role: "user", content: "What is ownership?" },
      { role: "assistant", content: "It is a set of rules." },
    ]);
    expect(body.context.route).toBe("/chat/conv-2");
  });

  it("sends only the given turns with their offset in delta mode", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "x" }));

    await submitConversationAnalysis({
      conversation: { id: "conv-9", title: "Rust basics" },
      messages: [{ role: "user", content: "And lifetimes?" }],
      mode: "delta",
      offset: 4,
      fetchImpl,
    });

    const body = JSON.parse(callArgs(fetchImpl)[1].body);
    expect(body.mode).toBe("delta");
    expect(body.offset).toBe(4);
    expect(body.conversation_id).toBe("conv-9");
    expect(body.context.conversation_id).toBe("conv-9");
    expect(body.messages).toEqual([{ role: "user", content: "And lifetimes?" }]);
  });

  it("reports a delta the receiver cannot merge as a conflict", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ detail: "resend with offset 0" }, { status: 409 }),
    );

    await expect(
      submitConversationAnalysis({
        conversation: { id: "conv-9", title: "Rust basics" },
        messages: [{ role: "user", content: "And lifetimes?" }],
        mode: "delta",
        offset: 4,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("sends nothing when the conversation has no turns", async () => {
    const fetchImpl = vi.fn();
    const result = await submitConversationAnalysis({
      conversation: { messages: [{ role: "system", content: "Only a prompt" }] },
      fetchImpl,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("files a comment without a rating as a report", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "x" }));
    await submitFeedbackComment({
      comment: "The answer missed the second step.",
      conversationId: "conv-3",
      fetchImpl,
    });
    const body = JSON.parse(callArgs(fetchImpl)[1].body);
    expect(body).toMatchObject({
      kind: "report",
      type: "feedback",
      message: "The answer missed the second step.",
    });
  });

  it("refuses a comment shorter than the receiver's minimum", async () => {
    const fetchImpl = vi.fn();
    await expect(
      submitFeedbackComment({ comment: "Too short", fetchImpl }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lists the caller's feedback", async () => {
    const rows = [{ id: "alice/saia-feedback/2", kind: "rating" }];
    const fetchImpl = vi.fn(async () => jsonResponse({ count: 1, feedback: rows }));

    const items = await listFeedback({ limit: 50, kind: "rating", fetchImpl });

    const [url, init] = callArgs(fetchImpl);
    expect(url).toBe(
      "http://feedback.test/feedback?limit=50&kind=rating",
    );
    expect(init.method).toBeUndefined();
    expect(items).toEqual(rows);
  });

  it("deletes every feedback row and reports how many went", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ deleted: 3 }));

    const deleted = await deleteAllFeedback({ fetchImpl });

    const [, init] = callArgs(fetchImpl);
    expect(init.method).toBe("DELETE");
    expect(deleted).toBe(3);
  });

  it("maps a refused receiver onto a FeedbackError code", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ detail: "no" }, { status: 403 }));
    await expect(deleteAllFeedback({ fetchImpl })).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
  });

  it("files a bug report from a chat under that chat's id", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "x" }, { status: 201 }));

    await submitFeedbackReport({
      type: "bug",
      message: "The answer looked wrong.",
      context: { route: "/chat/conv-7?message=m2", app_version: "2.0.1" },
      fetchImpl,
    });

    const payload = JSON.parse(callArgs(fetchImpl)[1].body.get("payload"));
    expect(payload.conversation_id).toBe("conv-7");
    expect(payload.context).toMatchObject({
      route: "/chat/conv-7?message=m2",
      conversation_id: "conv-7",
    });
  });

  it("sends no chat id for a report filed outside a chat", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "x" }, { status: 201 }));

    await submitFeedbackReport({
      type: "bug",
      message: "The settings page is blank.",
      context: { route: "/settings/profile" },
      fetchImpl,
    });

    const payload = JSON.parse(callArgs(fetchImpl)[1].body.get("payload"));
    expect(payload.conversation_id).toBeUndefined();
    expect(payload.context.conversation_id).toBeUndefined();
  });
});

describe("feedbackConversationIdFromRoute", () => {
  it("reads the chat id from a chat route", () => {
    expect(feedbackConversationIdFromRoute("/chat/abc-123")).toBe("abc-123");
    expect(feedbackConversationIdFromRoute("/chat/abc-123?message=m1")).toBe("abc-123");
    expect(feedbackConversationIdFromRoute("/chat/a%20b")).toBe("a b");
  });

  it("names no chat for every other route", () => {
    for (const route of ["/", "/settings/profile", "/meta", "/chat", "/topic/t1", ""]) {
      expect(feedbackConversationIdFromRoute(route)).toBe("");
    }
  });
});

describe("feedbackMessagesFromConversation", () => {
  it("keeps user and assistant turns and drops system prompts", () => {
    expect(
      feedbackMessagesFromConversation([
        { role: "system", content: "sys" },
        { role: "user", content: [{ type: "text", text: "Hello" }] },
        { role: "assistant", content: "Hi" },
        { role: "tool", content: "ignored" },
      ]),
    ).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ]);
  });

  it("keeps the newest turns when the transcript exceeds the cap", () => {
    const messages = Array.from({ length: 50 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: `message ${index} ${"x".repeat(100)}`,
    }));
    const kept = feedbackMessagesFromConversation(messages, 1_000);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.at(-1).content).toContain("message 49");
    expect(JSON.stringify(kept).length).toBeLessThanOrEqual(1_000);
  });

  it("never carries the model's reasoning", () => {
    const kept = feedbackMessagesFromConversation([
      { role: "user", content: "Question" },
      {
        role: "assistant",
        content: "The answer. &lt;think&gt;hidden&lt;/think&gt; Done.",
      },
      { role: "assistant", content: "Still working \u003cthinkunfinished" },
    ]);

    expect(kept).toHaveLength(3);
    expect(kept[1].content).toContain("The answer.");
    expect(kept[1].content).toContain("Done.");
    expect(kept[1].content).not.toContain("hidden");
    expect(kept[1].content).not.toContain("think");
    expect(kept[2].content).toBe("Still working");
  });
});

describe("enrichedFeedbackMessagesFromConversation", () => {
  it("leaves a transcript unchanged without a brand feature", async () => {
    const messages = [
      { role: "system", content: "sys" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];
    await expect(enrichedFeedbackMessagesFromConversation(messages)).resolves.toEqual(
      feedbackMessagesFromConversation(messages),
    );
  });
});

describe("feedbackTranscriptSignature", () => {
  const messages = [{ role: "assistant", content: "Answer" }];
  const answered = [
    {
      role: "assistant",
      content: "Answer",
      meta: { quizAnswers: { "question-98": { selection: [1], checked: true } } },
    },
  ];

  it("changes when a brand keeps state that its transcript text shows", () => {
    setCurrentBrand(getBrandProfile("gaia"));
    clearBrandFeatureCache();

    expect(feedbackTranscriptSignature(messages)).not.toBe(
      feedbackTranscriptSignature(answered),
    );
  });

  it("ignores that state without the feature", () => {
    setCurrentBrand(null);
    clearBrandFeatureCache();

    expect(feedbackTranscriptSignature(messages)).toBe(
      feedbackTranscriptSignature(answered),
    );
  });
});
