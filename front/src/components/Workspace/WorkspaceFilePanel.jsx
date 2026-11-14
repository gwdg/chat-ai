import { Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import PanelShell from "../DocumentPanel/PanelShell";
import SandboxedHtmlPreview from "../Others/SandboxedHtmlPreview";
import { formatBytes } from "../../utils/formatBytes";

export default function WorkspaceFilePanel({ preview, onClose, onDownload }) {
  const { t } = useTranslation();
  const entry = preview.entry;
  const isImage =
    entry.mime?.startsWith("image/") === true ||
    /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(entry.name);
  const isPdf =
    entry.mime === "application/pdf" || /\.pdf$/i.test(entry.name);
  const isHtml =
    entry.mime?.startsWith("text/html") === true ||
    /\.(html?|xhtml)$/i.test(entry.name);

  const subtitle = [
    entry.mime,
    typeof entry.size === "number" ? formatBytes(entry.size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PanelShell
      title={entry.name}
      subtitle={subtitle}
      onClose={onClose}
      actions={
        preview.url ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => onDownload(entry)}
            aria-label={t("workspace.download")}
            title={t("workspace.download")}
          >
            <Download size={18} />
          </button>
        ) : undefined
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {preview.loading ? (
          <div className="h-24 animate-pulse rounded bg-base-200" />
        ) : preview.error ? (
          <p className="text-error text-sm">{preview.error}</p>
        ) : preview.text !== undefined ? (
          isHtml ? (
            <SandboxedHtmlPreview
              content={preview.text}
              title={entry.name}
              className="h-full min-h-[70vh] w-full rounded border border-base-300 bg-base-100"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-base-200 p-4 font-mono text-xs leading-relaxed text-base-content">
              {preview.text}
            </pre>
          )
        ) : preview.url ? (
          isImage ? (
            <img
              src={preview.url}
              alt={entry.name}
              className="max-w-full rounded"
            />
          ) : isPdf ? (
            <iframe
              src={preview.url}
              title={entry.name}
              className="h-full min-h-[70vh] w-full rounded"
            />
          ) : entry.mime?.startsWith("audio/") ? (
            <audio src={preview.url} controls className="w-full" />
          ) : entry.mime?.startsWith("video/") ? (
            <video src={preview.url} controls className="w-full rounded" />
          ) : (
            <p className="text-sm text-base-content/60">
              {t("workspace.preview_unavailable")}
            </p>
          )
        ) : null}
      </div>
    </PanelShell>
  );
}
