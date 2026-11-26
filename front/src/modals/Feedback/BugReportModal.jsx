import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import BaseModal from "../BaseModal";
import packageJson from "../../../package.json";
import {
  ACCEPTED_SCREENSHOT_TYPES,
  FEEDBACK_TYPES,
  FeedbackError,
  MAX_FEEDBACK_SCREENSHOTS,
  MAX_FEEDBACK_SCREENSHOT_BYTES,
  feedbackConversationIdFromRoute,
  submitFeedbackReport,
} from "../../apis/feedback";
import { useToast } from "../../hooks/useToast";

const formatBytes = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** The text the "copy instead" fallback puts on the clipboard. */
const reportText = ({ type, message, email, context }) =>
  [
    `Type: ${type}`,
    email ? `Contact: ${email}` : null,
    "",
    message,
    "",
    "— diagnostics —",
    ...Object.entries(context).map(([key, value]) => `${key}: ${value}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

/**
 * Bug report / feedback dialog.
 *
 * Screenshots stay optional and small (3 × 5 MB, PNG/JPEG/WebP). The report is
 * sent as multipart to the deployment's feedback endpoint; when that endpoint is
 * missing or refuses the request, the dialog offers the assembled text for
 * copying rather than losing what the user typed.
 */
export default function BugReportModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { notifySuccess } = useToast();

  const [type, setType] = useState("bug");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [screenshots, setScreenshots] = useState([]);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef(null);

  const context = useMemo(() => {
    if (typeof window === "undefined") return {};
    const route = window.location.pathname + window.location.search;
    const conversationId = feedbackConversationIdFromRoute(route);
    return {
      route,
      // A report filed inside a chat names that chat, so the receiver can file
      // it with the chat's transcript and ratings instead of dropping it from
      // the export as "no chat id".
      ...(conversationId ? { conversation_id: conversationId } : {}),
      user_agent: window.navigator?.userAgent ?? "",
      app_version: packageJson.version,
    };
  }, [isOpen]);

  const reset = () => {
    setType("bug");
    setDescription("");
    setEmail("");
    setScreenshots([]);
    setError("");
    setFieldError("");
    setSending(false);
    setSent(false);
    setUnavailable(false);
    setCopied(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const close = () => {
    if (sending) return;
    reset();
    onClose?.();
  };

  const addFiles = (files) => {
    const incoming = Array.from(files ?? []);
    if (incoming.length === 0) return;
    for (const file of incoming) {
      if (!ACCEPTED_SCREENSHOT_TYPES.includes(file.type)) {
        setFieldError(t("bug_report.error_type"));
        return;
      }
      if (file.size > MAX_FEEDBACK_SCREENSHOT_BYTES) {
        setFieldError(t("bug_report.error_size", { size: formatBytes(MAX_FEEDBACK_SCREENSHOT_BYTES) }));
        return;
      }
    }
    const next = [...screenshots, ...incoming];
    setFieldError(
      next.length > MAX_FEEDBACK_SCREENSHOTS
        ? t("bug_report.error_count", { count: MAX_FEEDBACK_SCREENSHOTS })
        : "",
    );
    setScreenshots(next.slice(0, MAX_FEEDBACK_SCREENSHOTS));
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    const message = description.trim();
    if (!message) {
      setFieldError(t("bug_report.error_description"));
      return;
    }
    setFieldError("");
    setError("");
    setSending(true);
    try {
      await submitFeedbackReport({
        type,
        message,
        email: email.trim(),
        screenshots,
        context,
        conversationId: context.conversation_id,
      });
      setSent(true);
      notifySuccess(t("bug_report.success"));
    } catch (cause) {
      if (cause instanceof FeedbackError) {
        if (cause.code === "not_available" || cause.code === "not_configured") {
          setUnavailable(true);
        } else if (cause.code === "invalid") {
          setError(t("bug_report.error_rejected"));
        } else {
          setError(t("bug_report.error_failed"));
        }
      } else {
        setError(t("bug_report.error_failed"));
      }
    } finally {
      setSending(false);
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(
        reportText({ type, message: description.trim(), email: email.trim(), context }),
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      titleKey="bug_report.title"
      maxWidth="max-w-lg"
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <p className="text-sm text-base-content/80">{t("bug_report.intro")}</p>

        <label className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold uppercase text-base-content/70">
            {t("bug_report.type_label")}
          </span>
          <select
            className="select select-bordered select-sm w-full"
            value={type}
            onChange={(event) => setType(event.target.value)}
            data-guide="bug-report-type"
          >
            {FEEDBACK_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`bug_report.type_${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold uppercase text-base-content/70">
            {t("bug_report.message_label")}
          </span>
          <textarea
            className="textarea textarea-bordered h-28 w-full text-sm"
            placeholder={t("bug_report.message_placeholder")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            data-guide="bug-report-message"
          />
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold uppercase text-base-content/70">
            {t("bug_report.screenshot_label")}
          </span>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPTED_SCREENSHOT_TYPES.join(",")}
            className="file-input file-input-bordered file-input-sm w-full"
            onChange={(event) => addFiles(event.target.files)}
            data-guide="bug-report-screenshot"
          />
          <span className="mt-1 text-xs text-base-content/60">
            {t("bug_report.screenshot_hint", {
              count: MAX_FEEDBACK_SCREENSHOTS,
              size: formatBytes(MAX_FEEDBACK_SCREENSHOT_BYTES),
            })}
          </span>
          {screenshots.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {screenshots.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-2 rounded bg-base-200 px-2 py-1 text-xs"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setScreenshots((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1 text-xs font-semibold uppercase text-base-content/70">
            {t("bug_report.email_label")}
          </span>
          <input
            type="email"
            className="input input-bordered input-sm w-full"
            placeholder={t("bug_report.email_placeholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <details className="rounded bg-base-200 px-3 py-2 text-xs text-base-content/70">
          <summary className="cursor-pointer select-none">
            {t("bug_report.diagnostics_label")}
          </summary>
          <dl className="mt-2 flex flex-col gap-1">
            {Object.entries(context).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="font-semibold">{key}:</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </details>

        {fieldError && <p className="text-sm text-error">{fieldError}</p>}
        {error && <p className="text-sm text-error">{error}</p>}

        {unavailable && (
          <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="mb-2 text-base-content">{t("bug_report.unavailable")}</p>
            <button type="button" className="btn btn-xs" onClick={copyReport}>
              {copied ? t("bug_report.copied") : t("bug_report.copy")}
            </button>
          </div>
        )}

        {sent && <p className="text-sm text-success">{t("bug_report.sent")}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            {sent ? t("common.close") : t("common.cancel")}
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={sending || sent}
            data-guide="bug-report-submit"
          >
            {sending ? t("bug_report.sending") : t("bug_report.submit")}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
