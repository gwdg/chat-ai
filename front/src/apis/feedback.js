import { authHeaders } from "./authHeaders.js";
import { isFeedbackEnabled as isFeedbackModuleEnabled } from "../utils/modules.js";
import packageJson from "../../package.json" with { type: "json" };

/**
 * Feedback delivery.
 *
 * Two paths share one receiver:
 *
 * - `submitFeedbackReport` — the footer's bug report, sent as multipart (a JSON
 *   `payload` field plus screenshots).
 * - `submitFeedbackRating` / `submitConversationAnalysis` — the feedback module:
 *   a thumbs-up/down rating for one answer and the conversation that changed,
 *   both sent as plain JSON to the same endpoint.
 *
 * A deployment opts in by pointing `feedbackPath` in `front.json`
 * (`VITE_FEEDBACK_ENDPOINT`) at a receiver. `back` serves `/feedback` and
 * forwards the body to the endpoint configured in `back.json`
 * (`feedbackEndpoint`), so the browser never holds a third-party address or
 * token. Without the key the footer offers no entry point at all.
 */
export const feedbackEndpoint = () => import.meta.env?.VITE_FEEDBACK_ENDPOINT || "";

export const isFeedbackReportEnabled = () => Boolean(feedbackEndpoint());

/** The feedback module is on and this deployment has a receiver. */
export const isChatFeedbackEnabled = () =>
  isFeedbackModuleEnabled() && Boolean(feedbackEndpoint());

export const FEEDBACK_TYPES = ["bug", "feedback", "accessibility", "other"];

/** Screenshot limits, mirrored by `back`'s receiver and the form's validation. */
export const MAX_FEEDBACK_SCREENSHOTS = 3;
export const MAX_FEEDBACK_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The receiver's own limits (`MAX_MESSAGES_CHARS`, `MAX_COMMENT`, `MAX_RESULT`). */
export const MAX_FEEDBACK_MESSAGES_CHARS = 190_000;
const MAX_FEEDBACK_TEXT_CHARS = 5000;
const MAX_FEEDBACK_CONTEXT_CHARS = 500;

export class FeedbackError extends Error {
  constructor(message, { status = 0, code = "" } = {}) {
    super(message);
    this.name = "FeedbackError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Sends one report. Throws `FeedbackError` with a `code` of
 * `not_configured`, `not_available`, `invalid` or `failed`, which is what the
 * dialog turns into a message.
 */
export const submitFeedbackReport = async ({
  type,
  message,
  email = "",
  screenshots = [],
  context = {},
  fetchImpl = globalThis.fetch,
}) => {
  const endpoint = feedbackEndpoint();
  if (!endpoint) {
    throw new FeedbackError("Feedback is not configured.", {
      code: "not_configured",
    });
  }

  const body = new FormData();
  body.append(
    "payload",
    JSON.stringify({
      type,
      message,
      email: email || undefined,
      context,
    }),
  );
  for (const file of screenshots) body.append("screenshots", file);

  // No Content-Type: the browser has to set the multipart boundary itself.
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: authHeaders(),
    body,
  });

  if (response.ok) return true;
  throwFeedbackResponse(response);
};

/** Maps a refused receiver response onto the codes the UI understands. */
function throwFeedbackResponse(response) {
  const status = response.status;
  if (status === 404 || status === 405 || status === 501) {
    throw new FeedbackError("Feedback is not available here.", {
      status,
      code: "not_available",
    });
  }
  if (status === 400 || status === 413 || status === 422) {
    throw new FeedbackError("The feedback was rejected.", {
      status,
      code: "invalid",
    });
  }
  if (status === 401 || status === 403) {
    throw new FeedbackError("This feedback belongs to somebody else.", {
      status,
      code: "forbidden",
    });
  }
  if (status === 409) {
    // A delta no longer matches what the receiver stored (another tab sent a
    // newer transcript, or the chat was edited); the caller resends in full.
    throw new FeedbackError("The stored conversation is out of date.", {
      status,
      code: "conflict",
    });
  }
  throw new FeedbackError("The feedback could not be sent.", {
    status,
    code: "failed",
  });
}

const clip = (value, limit) => {
  const text = typeof value === "string" ? value : String(value ?? "");
  return text.length > limit ? text.slice(0, limit) : text;
};

/** Plain text of a message content value (string or OpenAI content parts). */
export const feedbackTextOf = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item.text === "string") return item.text;
      if (item && typeof item.type === "string") return `[${item.type}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

/**
 * The user/assistant turns of a conversation, newest kept first when the whole
 * transcript would exceed the receiver's cap. System prompts are not sent.
 */
export const feedbackMessagesFromConversation = (
  messages = [],
  limit = MAX_FEEDBACK_MESSAGES_CHARS,
) => {
  const normalized = (Array.isArray(messages) ? messages : [])
    .filter(
      (message) =>
        message && (message.role === "user" || message.role === "assistant"),
    )
    .map((message) => ({
      role: message.role,
      content: feedbackTextOf(message.content).trim(),
    }))
    .filter((message) => message.content);

  const kept = [];
  let size = 2; // "[]"
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const entry = normalized[index];
    const entrySize = JSON.stringify(entry).length + (kept.length ? 1 : 0);
    if (kept.length && size + entrySize > limit) break;
    kept.unshift(entry);
    size += entrySize;
  }
  return kept;
};

const modelLabel = (model) => {
  if (!model) return "";
  if (typeof model === "string") return model;
  return model.id || model.name || "";
};

const feedbackContext = ({
  conversationId,
  title,
  route,
  appVersion,
  extra = {},
} = {}) => {
  const context = {
    source: "chat-ai",
    ...extra,
  };
  if (conversationId) context.conversation_id = String(conversationId);
  if (title) context.conversation_title = clip(title, MAX_FEEDBACK_CONTEXT_CHARS);
  if (route) context.route = clip(route, MAX_FEEDBACK_CONTEXT_CHARS);
  const version = appVersion || packageJson?.version;
  if (version) context.app_version = clip(version, MAX_FEEDBACK_CONTEXT_CHARS);
  return context;
};

async function postFeedbackJson(payload, fetchImpl = globalThis.fetch) {
  const endpoint = feedbackEndpoint();
  if (!endpoint) {
    throw new FeedbackError("Feedback is not configured.", {
      code: "not_configured",
    });
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throwFeedbackResponse(response);
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Rates one answer. `rating` is `1` (up) or `-1` (down); the receiver stores
 * the words `up`/`down` in its GAIA-compatible `rating` column.
 */
export const submitFeedbackRating = async ({
  rating,
  result = "",
  comment = "",
  messages = [],
  model,
  conversationId,
  title,
  route,
  appVersion,
  fetchImpl = globalThis.fetch,
}) => {
  const value = rating === 1 ? "up" : rating === -1 ? "down" : "";
  if (!value) {
    throw new FeedbackError("A rating is required.", { code: "invalid" });
  }
  return postFeedbackJson(
    {
      kind: "rating",
      rating: value,
      result: clip(result, MAX_FEEDBACK_TEXT_CHARS) || undefined,
      comment: clip(comment, MAX_FEEDBACK_TEXT_CHARS) || undefined,
      messages: messages.length ? messages : undefined,
      model: clip(modelLabel(model), 200) || undefined,
      context: feedbackContext({ conversationId, title, route, appVersion }),
    },
    fetchImpl,
  );
};

/**
 * Sends the conversation for analysis after it changed. Returns `null` when
 * there is nothing to send (an empty or system-only chat).
 *
 * `mode` is `"full"` (the whole transcript, a new submission every time) or
 * `"delta"`: `messages` then holds only the turns after the first `offset`
 * messages of the same conversation and the receiver appends them to the row
 * it already stores. `messages` may be passed in so the caller hashes exactly
 * what it sends; otherwise the whole transcript is used.
 */
export const submitConversationAnalysis = async ({
  conversation,
  model,
  route,
  appVersion,
  mode = "full",
  offset = 0,
  messages: outgoing,
  fetchImpl = globalThis.fetch,
}) => {
  const messages = outgoing ?? feedbackMessagesFromConversation(conversation?.messages);
  if (!messages.length) return null;
  const title = clip(String(conversation?.title ?? "").trim(), 200) || "Untitled chat";
  const delta = mode === "delta";
  return postFeedbackJson(
    {
      kind: "report",
      type: "feedback",
      message: `Conversation for analysis: ${title}`,
      messages,
      model: clip(modelLabel(model), 200) || undefined,
      // The receiver needs the chat id to find the row a delta continues; it
      // is also inside `context`, which is where older clients sent it.
      conversation_id: conversation?.id ? String(conversation.id) : undefined,
      mode: delta ? "delta" : "full",
      offset: delta ? Math.max(0, Math.trunc(Number(offset) || 0)) : undefined,
      context: feedbackContext({
        conversationId: conversation?.id,
        title,
        route,
        appVersion,
      }),
    },
    fetchImpl,
  );
};

/**
 * A detailed comment without a thumb. The receiver keeps ratings and reports
 * apart and a rating requires a rating value, so a comment of its own is filed
 * as a report. The receiver's minimum message length applies to it.
 */
export const MIN_FEEDBACK_MESSAGE_CHARS = 10;

export const submitFeedbackComment = async ({
  comment,
  messages = [],
  model,
  conversationId,
  title,
  route,
  appVersion,
  fetchImpl = globalThis.fetch,
}) => {
  const text = clip(String(comment ?? "").trim(), MAX_FEEDBACK_TEXT_CHARS);
  if (text.length < MIN_FEEDBACK_MESSAGE_CHARS) {
    throw new FeedbackError(
      `The feedback must be at least ${MIN_FEEDBACK_MESSAGE_CHARS} characters.`,
      { code: "invalid" },
    );
  }
  return postFeedbackJson(
    {
      kind: "report",
      type: "feedback",
      message: text,
      messages: messages.length ? messages : undefined,
      model: clip(modelLabel(model), 200) || undefined,
      context: feedbackContext({ conversationId, title, route, appVersion }),
    },
    fetchImpl,
  );
};

/**
 * The feedback this account submitted, newest first. This is what the
 * `saia-feedback` `list_feedback` tool returns: the receiver answers with the
 * caller's own rows, so an account never sees anybody else's feedback.
 */
export const listFeedback = async ({
  limit = 200,
  kind = "",
  fetchImpl = globalThis.fetch,
} = {}) => {
  const endpoint = feedbackEndpoint();
  if (!endpoint) {
    throw new FeedbackError("Feedback is not configured.", {
      code: "not_configured",
    });
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (kind) params.set("kind", kind);
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetchImpl(`${endpoint}${separator}${params}`, {
    headers: authHeaders(),
  });
  if (!response.ok) throwFeedbackResponse(response);
  const data = await response.json();
  return Array.isArray(data?.feedback) ? data.feedback : [];
};

/** Deletes every feedback row this account submitted; returns how many went. */
export const deleteAllFeedback = async ({
  fetchImpl = globalThis.fetch,
} = {}) => {
  const endpoint = feedbackEndpoint();
  if (!endpoint) {
    throw new FeedbackError("Feedback is not configured.", {
      code: "not_configured",
    });
  }
  const response = await fetchImpl(endpoint, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throwFeedbackResponse(response);
  const data = await response.json().catch(() => null);
  return Number(data?.deleted) || 0;
};
