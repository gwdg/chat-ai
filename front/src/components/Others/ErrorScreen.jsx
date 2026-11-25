import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Download, RotateCw } from "lucide-react";

import { downloadLocalData } from "../../utils/dataExport";

const SUPPORT_EMAIL = "support@gwdg.de";

/**
 * The export reads the same database the screen is about, so when the database
 * is blocked by another tab it would wait forever. Ten seconds is long enough
 * for a real export and short enough to answer "close the other tabs" instead
 * of leaving the button spinning.
 */
const SAVE_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("export timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * The one full-page failure screen: the database gate and the render-error
 * boundary both land here. Three things are always true when it shows, so the
 * screen always says them — the data is still on disk, it can be copied out in
 * one click, and someone can be asked for help if it does not clear up.
 */
export default function ErrorScreen({
  title,
  message,
  details,
  reloadLabel,
  retryLabel,
  onReload,
  onRetry,
}) {
  const { t } = useTranslation();
  const [saveState, setSaveState] = useState("idle");

  const handleSave = async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      await withTimeout(downloadLocalData(), SAVE_TIMEOUT_MS);
      setSaveState("saved");
    } catch (error) {
      console.error("Failed to export local data", error);
      setSaveState("failed");
    }
  };

  const primaryLabel = retryLabel ?? reloadLabel ?? t("errors.reload");
  const primaryAction = onRetry ?? onReload ?? (() => window.location.reload());

  return (
    <div className="grid min-h-dvh place-items-center bg-base-200 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-base-300 bg-base-100 p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-base-content">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-base-content/80">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3">
          <p className="text-sm font-semibold text-base-content">
            {t("errors.data_safe_title")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-base-content/80">
            {t("errors.data_safe")}
          </p>
        </div>

        {details ? (
          <details className="mt-4 text-xs text-base-content/70">
            <summary className="cursor-pointer select-none">
              {t("errors.details")}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-base-200 p-3">
              {details}
            </pre>
          </details>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={primaryAction}
            className="btn btn-accent"
          >
            <RotateCw className="h-4 w-4" />
            {primaryLabel}
          </button>
          {onRetry && onReload ? (
            <button
              type="button"
              onClick={onReload}
              className="btn btn-ghost"
            >
              {reloadLabel ?? t("errors.reload")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="btn btn-outline"
          >
            {saveState === "saving" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {saveState === "saving"
              ? t("errors.save_data_saving")
              : t("errors.save_data")}
          </button>
        </div>

        <p
          className={`mt-2 text-xs ${saveState === "failed" ? "text-error" : "text-base-content/70"}`}
          role={saveState === "failed" ? "alert" : undefined}
        >
          {saveState === "saved"
            ? t("errors.save_data_done")
            : saveState === "failed"
              ? t("errors.save_data_failed")
              : t("errors.save_data_hint")}
        </p>

        <p className="mt-4 border-t border-base-300 pt-3 text-xs leading-relaxed text-base-content/70">
          {t("errors.support_before")}{" "}
          <a className="link link-accent" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          {t("errors.support_after")}
        </p>
      </div>
    </div>
  );
}
