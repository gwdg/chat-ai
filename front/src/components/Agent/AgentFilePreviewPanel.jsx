import { useEffect } from "react";

import WorkspaceFilePanel from "../Workspace/WorkspaceFilePanel";
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
    <WorkspaceFilePanel
      preview={preview}
      onClose={() => {
        closePreview();
        onClose?.();
      }}
      onDownload={download}
    />
  );
}
