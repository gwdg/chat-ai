import { Download } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import DescribeImageButton from "./DescribeImageButton";
import FilePreviewContent from "./FilePreviewContent";
import PanelShell from "./PanelShell";
import { getFileType } from "../../utils/attachments";
import { formatBytes } from "../../utils/formatBytes";

/**
 * The one docked file preview: the workspace browser, the agent file list and chat
 * attachments all render this component, so a file looks the same everywhere.
 *
 * `preview` is `{ entry: { name, mime, size }, url?, text?, data?, loading?, error?,
 * onOpenPath? }` — the shape the workspace and agent providers already produce.
 */
export default function FilePreviewPanel({
  preview,
  onClose,
  onDownload,
  downloadLabel,
  downloadDisabled = false,
  showPdfHint = false,
  resetKey,
}) {
  const { t } = useTranslation();
  const entry = preview.entry ?? {};
  const subtitle = [
    entry.mime,
    typeof entry.size === "number" ? formatBytes(entry.size) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  // A loader-based preview (chat) can fetch the file itself, so the action is offered
  // even while its bytes are still pending.
  const canDownload =
    Boolean(onDownload) ||
    Boolean(preview.url) ||
    preview.text !== undefined;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(entry);
      return;
    }
    if (preview.text === undefined) return;
    const blob = new Blob([preview.text], {
      type: entry.mime || "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = entry.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const label = downloadLabel ?? t("workspace.download");
  // Only an image can be described, and the button sits left of Download in the
  // same header actions, so both previews (workspace tab and docked panel) show it.
  const isImage = getFileType({ type: entry.mime, name: entry.name }) === "image";

  return (
    <PanelShell
      title={entry.name}
      subtitle={subtitle}
      onClose={onClose}
      actions={
        isImage || canDownload ? (
          <div className="flex items-center gap-1">
            {isImage && <DescribeImageButton preview={preview} />}
            {canDownload && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={handleDownload}
                disabled={downloadDisabled}
                aria-label={label}
                title={label}
              >
                <Download size={18} />
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <FilePreviewContent
          key={resetKey}
          entry={entry}
          url={preview.url}
          text={preview.text}
          data={preview.data}
          loading={preview.loading}
          error={preview.error}
          onOpenPath={preview.onOpenPath}
          resolveImage={preview.resolveImage}
          showPdfHint={showPdfHint}
          resetKey={resetKey ?? preview.url ?? entry.name}
        />
      </div>
    </PanelShell>
  );
}
