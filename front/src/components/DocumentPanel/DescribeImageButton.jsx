import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageSearch } from "@carbon/icons-react";

import { EXPLAIN_IMAGE_MODEL, explainImage } from "../../apis/agentEndpoints";
import { useVisionModelAvailable } from "../../hooks/useVisionModelAvailable";
import { useToast } from "../../hooks/useToast";
import { downloadBlob } from "../../utils/download";

// A structured version of the agent's `explain_image` prompt, so the saved
// Markdown is useful on its own (title, summary, then the details).
const PROMPT =
  "Describe this image thoroughly but concisely. Start with one sentence on what " +
  "it shows, then cover the layout, colours, style and notable details. Quote any " +
  "text in the image verbatim. Answer in Markdown.";

/** `report.png` → `report-description.md`, next to the image. */
export function descriptionFileName(name = "image") {
  const base = String(name).replace(/\.[^./\\]+$/, "") || String(name);
  return `${base}-description.md`;
}

const previewBytes = async (preview) => {
  if (preview?.bytes instanceof Uint8Array) return preview.bytes;
  const response = await fetch(preview.url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * "Describe this image" in a preview header: asks the deployment's vision model
 * about the picture and saves the answer as `<name>-description.md`.
 *
 * A host that can write next to the file hands over `preview.saveDescription`;
 * every other host (a chat attachment, say) downloads the Markdown instead. The
 * button is greyed out, never hidden, while no vision model is available.
 */
export default function DescribeImageButton({ preview }) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const available = useVisionModelAvailable();
  const [busy, setBusy] = useState(false);

  const ready = available === true;
  const disabled = !ready || busy || !preview?.url;
  const label = ready
    ? t("file_preview.describe_image")
    : t("file_preview.describe_unavailable");

  const describe = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const name = preview.entry?.name ?? "image";
      const fileName = descriptionFileName(name);
      // A description that is already there is the answer: open it again instead
      // of paying for another model call (and overwriting a possibly edited file).
      if (
        preview.descriptionExists &&
        preview.openDescription &&
        (await preview.descriptionExists(fileName))
      ) {
        await preview.openDescription(fileName);
        notifySuccess(t("file_preview.describe_opened", { name: fileName }));
        return;
      }
      const bytes = await previewBytes(preview);
      const answer = await explainImage(
        bytes,
        preview.entry?.mime || "image/png",
        PROMPT,
      );
      const markdown = [
        `# ${name}`,
        "",
        `_${t("file_preview.describe_byline", {
          model: EXPLAIN_IMAGE_MODEL(),
        })}_`,
        "",
        answer.trim(),
        "",
      ].join("\n");
      if (preview.saveDescription) {
        await preview.saveDescription(markdown, fileName);
        notifySuccess(t("file_preview.describe_saved", { name: fileName }));
      } else {
        downloadBlob(
          new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
          fileName,
        );
        notifySuccess(t("file_preview.describe_downloaded", { name: fileName }));
      }
    } catch (reason) {
      notifyError(
        t("file_preview.describe_failed", {
          message: reason instanceof Error ? reason.message : String(reason),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-square"
      data-guide="preview-describe-image"
      data-testid="describe-image"
      data-model={EXPLAIN_IMAGE_MODEL()}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={describe}
    >
      {busy ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <ImageSearch size={18} />
      )}
    </button>
  );
}
