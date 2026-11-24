import { authHeaders } from "./authHeaders.js";

/**
 * Bug report / feedback delivery.
 *
 * A deployment opts in by pointing `feedbackPath` in `front.json`
 * (`VITE_FEEDBACK_ENDPOINT`) at a receiver. `back` serves `/feedback` and
 * forwards the multipart body to the endpoint configured in `back.json`
 * (`feedbackEndpoint`), so the browser never holds a third-party address or
 * token. Without the key the footer offers no entry point at all.
 *
 * The body mirrors GAIA's own endpoint: a JSON `payload` field plus up to a few
 * `screenshots` files.
 */
export const feedbackEndpoint = () => import.meta.env?.VITE_FEEDBACK_ENDPOINT || "";

export const isFeedbackReportEnabled = () => Boolean(feedbackEndpoint());

export const FEEDBACK_TYPES = ["bug", "feedback", "accessibility", "other"];

/** Screenshot limits, mirrored by `back`'s receiver and the form's validation. */
export const MAX_FEEDBACK_SCREENSHOTS = 3;
export const MAX_FEEDBACK_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
  const status = response.status;
  if (status === 404 || status === 405 || status === 501) {
    throw new FeedbackError("Feedback is not available here.", {
      status,
      code: "not_available",
    });
  }
  if (status === 400 || status === 413 || status === 422) {
    throw new FeedbackError("The report was rejected.", {
      status,
      code: "invalid",
    });
  }
  throw new FeedbackError("The report could not be sent.", {
    status,
    code: "failed",
  });
};
