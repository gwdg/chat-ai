import { useEffect } from "react";

import FilePreviewPanel from "../DocumentPanel/FilePreviewPanel";
import { useOpencodeFilePreview } from "../../hooks/useOpencodeFilePreview";

export default function AgentFilePreviewPanel({ agent, path, onClose }) {
  const { preview, openFile, closePreview, download } =
    useOpencodeFilePreview(agent);

  useEffect(() => {
    if (!agent || !path) return;
    void openFile({
      sourceId: agent.id,
      path,
      name: path.split("/").filter(Boolean).pop() || path,
      kind: "file",
      local: false,
    });
  }, [agent, path, openFile]);

  if (!preview) return null;

  return (
    <FilePreviewPanel
      preview={preview}
      onClose={() => {
        closePreview();
        onClose?.();
      }}
      onDownload={download}
    />
  );
}
