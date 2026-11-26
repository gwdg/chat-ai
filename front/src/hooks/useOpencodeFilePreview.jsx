import { useCallback, useEffect, useRef, useState } from "react";

import { listOpencodeFiles, readOpencodeFile, writeOpencodeFile } from "../apis/opencodeAgents";
import { resolveMimeType } from "../utils/mime";

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
        // A generic type would make the browser save the file instead of showing it.
        const mime =
          resolveMimeType(entry.name, type.split(";")[0]) ||
          "application/octet-stream";
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
        // An image can be described: the description is written beside it in the
        // agent's own project filesystem, so the agent finds it with the picture.
        // Any image can tell whether that file is already there and open it; only
        // a reachable server can create it.
        const dir = entry.path.split("/").slice(0, -1).join("/");
        const descriptionPath = (fileName) =>
          dir ? `${dir}/${fileName}` : fileName;
        const openDescription = (fileName) =>
          openFile({
            ...entry,
            path: descriptionPath(fileName),
            name: fileName,
            mime: "text/markdown",
            kind: "file",
          });
        const descriptionExists = async (fileName) => {
          try {
            const files = await listOpencodeFiles(agent, dir);
            return files.some((file) => file.name === fileName);
          } catch {
            // An unreachable server is not a "yes": the button then asks the model
            // again, which reports the real problem instead of silently opening
            // nothing.
            return false;
          }
        };
        const saveDescription =
          mime.startsWith("image/")
            ? async (text, fileName) => {
                const target = descriptionPath(fileName);
                await writeOpencodeFile(
                  agent,
                  target,
                  new Blob([text], { type: "text/markdown" }),
                  "text/markdown",
                );
                // Show the description at once instead of leaving the image behind.
                void openDescription(fileName);
                return target;
              }
            : undefined;
        setPreview({
          entry: fileEntry,
          loading: false,
          url,
          descriptionExists,
          openDescription,
          saveDescription,
        });
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

  // The same file card that opened the preview closes it again.
  const toggleFile = useCallback(
    (entry) => {
      if (entry?.path && preview?.entry?.path === entry.path) {
        closePreview();
        return undefined;
      }
      return openFile(entry);
    },
    [preview?.entry?.path, openFile, closePreview],
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

  return { preview, openFile, toggleFile, openText, closePreview, download };
}
