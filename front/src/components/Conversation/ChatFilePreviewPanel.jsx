import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import FilePreviewPanel from "../DocumentPanel/FilePreviewPanel";
import { loadFile } from "../../db";
import { useFilePreview } from "../../context/FilePreviewContext";
import { useConversationFilePreview } from "../../hooks/useConversationFilePreview";
import { useToast } from "../../hooks/useToast";
import { downloadBlob } from "../../utils/download";

// The docked preview of a conversation file. Pages render it as a sibling of their
// content column, exactly like the workspace and agent file panels, and both use the
// same `FilePreviewPanel` so a file looks the same wherever it is opened.
export default function ChatFilePreviewPanel() {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { preview, closeFilePreview } = useFilePreview();
  const filePreview = useConversationFilePreview(
    preview?.fileId,
    preview?.name,
  );

  // Leaving the page closes the panel instead of restoring it on the next visit.
  useEffect(() => () => closeFilePreview(), [closeFilePreview]);

  if (!preview) return null;

  const handleDownload = async () => {
    try {
      const complete = await loadFile(preview.fileId);
      if (!complete) {
        notifyError(t("file_preview.save_failed"));
        return;
      }
      downloadBlob(complete, complete.name || filePreview.entry.name);
    } catch (error) {
      console.error("Download failed:", error);
      notifyError(t("file_preview.save_failed"));
    }
  };

  return (
    <FilePreviewPanel
      preview={filePreview}
      onClose={closeFilePreview}
      onDownload={handleDownload}
      downloadLabel={t("file_preview.download_aria")}
      downloadDisabled={!filePreview.loaded}
      showPdfHint
      resetKey={preview.fileId}
    />
  );
}
