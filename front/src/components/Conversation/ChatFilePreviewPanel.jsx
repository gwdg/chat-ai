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
//
// A stored chat attachment arrives as a file id; an Arcana source card hands over an
// already-read `entry` with `url` or `text`, because its bytes live in saia-rag and
// never reach IndexedDB.
export default function ChatFilePreviewPanel() {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { preview, closeFilePreview, hosts } = useFilePreview();
  const external = Boolean(preview?.entry);
  const filePreview = useConversationFilePreview(
    external ? undefined : preview?.fileId,
    preview?.name,
  );

  // Leaving the page closes the panel instead of restoring it on the next visit.
  useEffect(() => () => closeFilePreview(), [closeFilePreview]);

  // A workspace sidebar with a Preview tab shows the file itself; the docked panel
  // stands down so the same click does not open two previews. It stays mounted, so
  // leaving the page still closes the preview.
  if (!preview || hosts > 0) return null;

  const shown = external
    ? {
        entry: preview.entry ?? {},
        url: preview.url,
        text: preview.text,
        data: preview.data,
        page: preview.page,
        loading: preview.loading === true,
        error: preview.error,
        loaded: true,
      }
    : { ...filePreview, page: preview.page };

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
      preview={shown}
      onClose={closeFilePreview}
      onDownload={external ? undefined : handleDownload}
      downloadLabel={t("file_preview.download_aria")}
      downloadDisabled={external ? false : !filePreview.loaded}
      showPdfHint={!external}
      resetKey={preview.key ?? preview.fileId}
    />
  );
}
