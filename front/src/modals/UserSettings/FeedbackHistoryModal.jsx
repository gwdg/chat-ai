import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2 } from "lucide-react";

import BaseModal from "../BaseModal";
import {
  deleteAllFeedback,
  FeedbackError,
  listFeedback,
} from "../../apis/feedback";
import { useToast } from "../../hooks/useToast";

const formatDate = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(language);
};

const clip = (value, max = 600) => {
  const text = typeof value === "string" ? value : "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/**
 * The feedback this account submitted, read through the receiver's list route
 * (the same rows the `saia-feedback` `list_feedback` tool returns). Deleting is
 * a two-step action: the receiver removes every row the caller submitted, so the
 * button first turns into an explicit confirmation.
 */
export default function FeedbackHistoryModal({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listFeedback({ limit: 200 }));
    } catch (err) {
      setError(
        err instanceof FeedbackError
          ? err.message
          : err?.message || t("user_settings.profile.feedback.load_failed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    setConfirming(false);
    void load();
  }, [isOpen, load]);

  const removeAll = async () => {
    setDeleting(true);
    try {
      const deleted = await deleteAllFeedback();
      setItems([]);
      setConfirming(false);
      notifySuccess(
        t("user_settings.profile.feedback.deleted", { count: deleted }),
      );
    } catch (err) {
      notifyError(
        t("user_settings.profile.feedback.delete_failed", {
          error: err?.message || "",
        }),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="user_settings.profile.feedback.modal_title"
      maxWidth="max-w-2xl"
    >
      <div className="flex min-h-0 flex-col gap-3">
        <p className="text-sm text-base-content/70">
          {t("user_settings.profile.feedback.modal_intro")}
        </p>

        {loading && (
          <p className="text-sm text-base-content/70">
            {t("user_settings.profile.feedback.loading")}
          </p>
        )}

        {!loading && error && (
          <div className="flex flex-col gap-2 rounded-lg border border-error/40 bg-error/5 p-3">
            <p className="flex items-start gap-2 text-sm text-error">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
            <button
              type="button"
              className="btn btn-sm btn-ghost w-fit"
              onClick={() => void load()}
            >
              {t("user_settings.profile.feedback.retry")}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm text-base-content/70">
            {t("user_settings.profile.feedback.empty")}
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
              {t("user_settings.profile.feedback.count", {
                count: items.length,
              })}
            </p>
            <ul
              className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pr-1"
              data-guide="feedback-history-list"
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-base-300 bg-base-100 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-sm badge-outline">
                      {t(`user_settings.profile.feedback.kind_${item.kind}`, {
                        defaultValue: item.kind,
                      })}
                    </span>
                    {item.type && (
                      <span className="badge badge-sm badge-ghost">
                        {t(
                          `user_settings.profile.feedback.type_${item.type}`,
                          { defaultValue: item.type },
                        )}
                      </span>
                    )}
                    {item.rating && (
                      <span
                        className={`badge badge-sm ${
                          item.rating === "down"
                            ? "badge-error"
                            : "badge-success"
                        }`}
                      >
                        {t(`user_settings.profile.feedback.rating_${item.rating}`, {
                          defaultValue: item.rating,
                        })}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-base-content/60">
                      {formatDate(item.created, i18n.language)}
                    </span>
                  </div>
                  {item.kind === "rating" ? (
                    <>
                      {item.result && (
                        <p className="mt-2 whitespace-pre-wrap break-words text-base-content/80">
                          {clip(item.result)}
                        </p>
                      )}
                      {item.comment && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-base-content/70">
                          {clip(item.comment)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap break-words text-base-content/80">
                      {clip(item.message)}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/60">
                    {item.model && <span>{item.model}</span>}
                    {item.context?.route && <span>{item.context.route}</span>}
                    {item.context?.conversation_title && (
                      <span>{item.context.conversation_title}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-base-300 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {confirming ? (
            <>
              <p className="flex items-start gap-2 text-sm text-error">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t("user_settings.profile.feedback.delete_confirm", {
                    count: items.length,
                  })}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error"
                  onClick={() => void removeAll()}
                  disabled={deleting}
                >
                  {deleting
                    ? t("user_settings.profile.feedback.deleting")
                    : t("user_settings.profile.feedback.delete_confirm_action")}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={onClose}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-error btn-outline"
                data-guide="feedback-delete-all"
                onClick={() => setConfirming(true)}
                disabled={loading || Boolean(error) || items.length === 0}
              >
                <Trash2 className="h-4 w-4" />
                {t("user_settings.profile.feedback.delete_all")}
              </button>
            </>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
