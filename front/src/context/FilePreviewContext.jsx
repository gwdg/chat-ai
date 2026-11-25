import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

// Chat file previews open in a docked panel (the same PanelShell the workspace and
// agent file lists use), so the request travels through a provider instead of a modal.
// Pages render <ChatFilePreviewPanel /> next to their content, where the panel docks.
const FilePreviewContext = createContext(null);

const FALLBACK = {
  preview: null,
  hosts: 0,
  toggleFilePreview: () => {},
  openFilePreview: () => {},
  closeFilePreview: () => {},
  registerPreviewHost: () => () => {},
};

export function FilePreviewProvider({ children }) {
  const [preview, setPreview] = useState(null);
  const [hosts, setHosts] = useState(0);
  const counter = useRef(0);
  const current = useRef(null);

  const commit = useCallback((next) => {
    current.current?.release?.();
    current.current = next;
    setPreview(next);
  }, []);

  // A workspace file arrives already read (entry + url or text): the sidebar's
  // Preview tab shows it. Every open gets its own key so the tab re-renders even
  // when the same file is clicked twice.
  const openFilePreview = useCallback(
    (request) => {
      if (!request || (!request.fileId && !request.entry)) return;
      counter.current += 1;
      commit({ ...request, key: counter.current });
    },
    [commit],
  );

  const toggleFilePreview = useCallback((request) => {
    const fileId = request?.fileId;
    if (!fileId) return;
    if (current.current?.fileId === fileId) {
      commit(null);
      return;
    }
    counter.current += 1;
    commit({ fileId, name: request?.name, key: counter.current });
  }, [commit]);

  const closeFilePreview = useCallback(() => commit(null), [commit]);

  // A visible Preview tab hosts the preview; while one is registered the docked
  // panel stands down, so a chat file opens in the sidebar instead of beside it.
  const registerPreviewHost = useCallback(() => {
    setHosts((count) => count + 1);
    return () => setHosts((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo(
    () => ({
      preview,
      hosts,
      toggleFilePreview,
      openFilePreview,
      closeFilePreview,
      registerPreviewHost,
    }),
    [
      preview,
      hosts,
      toggleFilePreview,
      openFilePreview,
      closeFilePreview,
      registerPreviewHost,
    ],
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
