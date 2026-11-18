import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Chat file previews open in a docked panel (the same PanelShell the workspace and
// agent file lists use), so the request travels through a provider instead of a modal.
// Pages render <ChatFilePreviewPanel /> next to their content, where the panel docks.
const FilePreviewContext = createContext(null);

const FALLBACK = {
  preview: null,
  toggleFilePreview: () => {},
  closeFilePreview: () => {},
};

export function FilePreviewProvider({ children }) {
  const [preview, setPreview] = useState(null);

  const toggleFilePreview = useCallback((request) => {
    const fileId = request?.fileId;
    if (!fileId) return;
    setPreview((current) =>
      current?.fileId === fileId ? null : { fileId, name: request?.name },
    );
  }, []);

  const closeFilePreview = useCallback(() => setPreview(null), []);

  const value = useMemo(
    () => ({ preview, toggleFilePreview, closeFilePreview }),
    [preview, toggleFilePreview, closeFilePreview],
  );

  return (
    <FilePreviewContext.Provider value={value}>
      {children}
    </FilePreviewContext.Provider>
  );
}

export function useFilePreview() {
  return useContext(FilePreviewContext) ?? FALLBACK;
}
