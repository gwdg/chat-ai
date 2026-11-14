import { useCallback, useEffect, useRef, useState } from "react";

import { readOpencodeFile } from "../apis/opencodeAgents";

const TEXT_EXT =
  /\.(md|markdown|txt|csv|tsv|json|xml|ya?ml|html?|css|jsx?|tsx?|py|sh|toml|ini|log|typ|tex|rs|go|java|c|h|cpp|cs|rb|php|swift|kt|sql|dockerfile|env)$/i;

const isTextFile = (mime, name) =>
  mime.startsWith("text/") ||
  /json|xml|javascript|yaml|x-sh|typescript|html/.test(mime) ||
  TEXT_EXT.test(name);

export function useOpencodeFilePreview(agent) {
  const [preview, setPreview] = useState(null);
  const previewUrlRef = useRef(null);

  const closePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  useEffect(() => {
    closePreview();
  }, [agent?.id, closePreview]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    },
    [],
  );

  const openFile = useCallback(
    async (entry) => {
      if (!agent) return;
      closePreview();
      setPreview({ entry, loading: true });
      try {
        const { blob, type } = await readOpencodeFile(agent, entry.path);
        const mime = type.split(";")[0] || "application/octet-stream";
        const fileEntry = { ...entry, mime, size: blob.size };
        if (isTextFile(mime, entry.name)) {
          setPreview({
            entry: fileEntry,
            loading: false,
            text: await blob.text(),
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreview({ entry: fileEntry, loading: false, url });
      } catch (reason) {
        setPreview({
          entry,
          loading: false,
          error: reason instanceof Error ? reason.message : String(reason),
        });
      }
    },
    [agent, closePreview],
  );

  const openText = useCallback(
    (entry, text, error = "", options = {}) => {
      closePreview();
      setPreview({
        entry,
        loading: false,
        text: error ? undefined : text,
        error: error || undefined,
        ...options,
      });
    },
    [closePreview],
  );

  const download = useCallback(() => {
    if (!preview?.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = preview.entry.name;
    link.click();
  }, [preview]);

  return { preview, openFile, openText, closePreview, download };
}
