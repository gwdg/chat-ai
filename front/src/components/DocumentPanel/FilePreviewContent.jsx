import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Papa from "papaparse";
import { Download } from "@carbon/icons-react";

import AudioPlayer from "./AudioPlayer";
import MarkdownRenderer from "../Conversation/MessageAssistant/MarkdownRenderer";
import SandboxedHtmlPreview from "../Others/SandboxedHtmlPreview";
import ZoomControls, { useZoom } from "./ZoomControls";
import { getFileType } from "../../utils/attachments";

// --------------------
// Utility + helper components
// --------------------

// A `git log --stat` line, e.g. " src/App.jsx | 12 +++---". Only used when the panel
// was given `onOpenPath`, so its paths can be clicked.
const gitStatLine = (line) => {
  if (!line.startsWith(" ")) return null;
  const pipe = line.indexOf(" | ");
  if (pipe < 0) return null;
  const suffix = line.slice(pipe);
  if (!/^\|\s+(?:\d+|Bin)\b/.test(suffix.slice(1))) return null;
  let path = line.slice(0, pipe).trim();
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
  const renamed = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
  if (renamed) path = `${renamed[1]}${renamed[3]}${renamed[4]}`;
  else if (path.includes(" => ")) path = path.split(" => ").pop().trim();
  return { path, suffix: line.slice(pipe) };
};

const LoadingBox = () => (
  <div className="h-24 animate-pulse rounded bg-base-200" />
);

const CSVTable = ({ content }) => {
  const { t } = useTranslation();
  const [error, setError] = useState(null);

  const parsedData = useMemo(() => {
    try {
      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        error: (error) => setError(error.message),
      });
      return result.data;
    } catch {
      setError(t("file_preview.csv_parse_failed"));
      return [];
    }
  }, [content, t]);

  if (error)
    return (
      <div className="p-4 text-error">{t("file_preview.error", { message: error })}</div>
    );
  if (!parsedData?.length)
    return (
      <div className="p-4 text-base-content/70">{t("file_preview.no_data")}</div>
    );

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="max-h-[85vh] w-full overflow-auto">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-base-200">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="border border-base-300 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-base-content/70"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-base-300 bg-base-100">
          {parsedData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="whitespace-nowrap border border-base-300 px-6 py-4 text-sm text-base-content/70"
                >
                  {row[header] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Renders a .docx in the browser; docx-preview is loaded on first use. Workspace and
// agent previews only hand over a URL, so the bytes are fetched from it.
const DocxViewer = ({ data, url }) => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if ((!data && !url) || !ref.current) return;
    let cancelled = false;
    const container = ref.current;
    setStatus("loading");
    const render = async () => {
      const source =
        data ?? (await (await fetch(url)).arrayBuffer());
      const { renderAsync } = await import("docx-preview");
      if (cancelled) return;
      container.innerHTML = "";
      await renderAsync(source, container, undefined, { inWrapper: true });
    };
    render()
      .then(() => !cancelled && setStatus("done"))
      .catch((err) => {
        console.error("DOCX preview failed:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [data, url]);

  return (
    <div className="max-h-[85vh] w-full overflow-auto">
      {status === "loading" && (
        <div className="p-4 text-base-content/70">{t("common.loading")}</div>
      )}
      {status === "error" && (
        <div className="p-4 text-error">{t("file_preview.docx_failed")}</div>
      )}
      <div ref={ref} className={status === "error" ? "hidden" : ""} />
    </div>
  );
};

/**
 * The single renderer behind every docked file preview — workspace browser, agent file
 * list and chat attachments. Callers hand it either the media URL (`url`) or the decoded
 * text (`text`), plus the entry's metadata, and get the same presentation.
 */
export default function FilePreviewContent({
  entry,
  url,
  text,
  data,
  /** The page to open at (a cited document); only the PDF viewer can jump. */
  page,
  loading = false,
  error,
  onOpenPath,
  resolveImage,
  showPdfHint = false,
  resetKey,
  /** The caller's download action: offered where a file cannot be shown inline. */
  onDownload,
  downloadLabel,
  /** `error` means "over the preview limit", so it gets the download notice. */
  tooLarge = false,
  limitLabel,
}) {
  const { t } = useTranslation();
  const [loadError, setLoadError] = useState(null);
  const { zoom, zoomIn, zoomOut, reset: resetZoom } = useZoom();

  const name = entry?.name ?? "";
  const mime = entry?.mime;

  // A media element that failed for the previous file must not keep that error,
  // and neither should a new file inherit the previous preview's zoom.
  useEffect(() => {
    setLoadError(null);
    resetZoom();
  }, [resetKey, url, page, resetZoom]);

  const fileType = getFileType({ type: mime, name });
  const isHtml =
    mime?.startsWith("text/html") === true || /\.(html?|xhtml)$/i.test(name);
  const hasText = typeof text === "string";
  const hasUrl = Boolean(url);
  // The browser's PDF viewer honours a `#page=N` fragment. Appending it keeps a
  // fragment the caller already set (a viewer option) instead of replacing it.
  const pdfUrl =
    fileType === "pdf" && page && url
      ? `${url}${url.includes("#") ? "&" : "#"}page=${page}`
      : url;

  if (loading) return <LoadingBox />;
  // Nothing is read, opened or downloaded for a file that is too large: the notice
  // explains why, and the download is the user's own click.
  if (error && tooLarge) {
    return (
      <div className="mx-auto flex h-[50vh] max-w-md flex-col items-center justify-center gap-3 rounded-lg bg-base-200 p-6 text-center">
        <p className="text-sm font-medium text-base-content/80">{error}</p>
        {limitLabel && (
          <p className="text-xs text-base-content/60">
            {t("workspace.preview_too_large_hint", { limit: limitLabel })}
          </p>
        )}
        {onDownload && (
          <button
            type="button"
            data-guide="preview-download"
            className="btn btn-sm"
            onClick={() => onDownload(entry)}
          >
            <Download size={16} aria-hidden />
            {downloadLabel ?? t("workspace.download")}
          </button>
        )}
      </div>
    );
  }
  if (error) return <p className="text-sm text-error">{error}</p>;
  if (loadError)
    return <p className="text-sm text-error">{t("file_preview.error", { message: loadError })}</p>;
  if (!name) return <p className="text-sm text-base-content/70">{t("file_preview.no_file")}</p>;

  const mediaFailed = (message) => () => setLoadError(message);

  if (fileType === "image") {
    // Until the bytes belong to this file an <img> would decode the previous file's
    // data URL and report a broken image.
    if (!hasUrl) return <LoadingBox />;
    return (
      <div className="flex justify-center">
        <img
          src={url}
          alt={name}
          className="max-h-[85vh] max-w-full rounded object-contain"
          onError={mediaFailed(t("file_preview.image_failed"))}
        />
      </div>
    );
  }

  if (fileType === "video") {
    if (!hasUrl) return <LoadingBox />;
    return (
      <div className="flex justify-center">
        <video
          src={url}
          controls
          className="max-h-[85vh] max-w-full rounded"
          onError={mediaFailed(t("file_preview.video_failed"))}
        >
          {t("file_preview.video_unsupported")}
        </video>
      </div>
    );
  }

  if (fileType === "audio") {
    if (!hasUrl) return <LoadingBox />;
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <AudioPlayer
          file={{ name, size: entry?.size, type: mime }}
          dataURL={url}
          mime={mime}
        />
      </div>
    );
  }

  if (fileType === "pdf") {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && hasUrl) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg bg-base-200 p-6 text-center">
          <p className="mb-2 text-base-content/70">
            {t("file_preview.pdf_mobile_title")}
          </p>
          <p className="text-sm text-base-content/70">
            {t("file_preview.pdf_mobile_hint")}
          </p>
          {/* The frame is the only thing this browser cannot show; the file itself is
              fine, so the user gets the download instead of a dead end. */}
          {onDownload && (
            <button
              type="button"
              data-guide="preview-download"
              className="btn btn-sm mt-4"
              onClick={() => onDownload(entry)}
            >
              <Download size={16} aria-hidden />
              {downloadLabel ?? t("workspace.download")}
            </button>
          )}
        </div>
      );
    }

    if (hasUrl) {
      return (
        <div className="flex h-[85vh] w-full flex-col">
          {showPdfHint && (
            <div className="mx-4 mb-4 rounded-lg border border-info/30 bg-info/10 p-3">
              <p className="text-sm font-medium text-info">
                {t("file_preview.pdf_original_title")}
              </p>
              <p className="text-xs text-info">
                {t("file_preview.pdf_original_hint")}
              </p>
            </div>
          )}
          <div className="mb-2 flex shrink-0 items-center justify-end gap-2 px-1">
            {page ? (
              <p className="mr-auto text-xs text-base-content/60">
                {t("file_preview.pdf_page", { page })}
              </p>
            ) : null}
            <ZoomControls
              zoom={zoom}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetZoom}
            />
          </div>
          {/* The browser's own viewer always fits the page to the iframe, so the
              only zoom the parent controls is the frame's size: both dimensions
              grow with the factor, which gives the scroll container its
              scrollbars and makes the viewer lay the page out again instead of
              upscaling a bitmap. */}
          <div className="min-h-0 flex-1 overflow-auto">
            <div
              data-testid="pdf-zoom-content"
              style={{
                width: `${zoom * 100}%`,
                height: `${zoom * 100}%`,
              }}
            >
              <iframe
                src={pdfUrl}
                className="h-full w-full rounded"
                title={name}
                onError={mediaFailed(t("file_preview.pdf_failed"))}
              />
            </div>
          </div>
        </div>
      );
    }

    // Only a chat attachment knows whether its PDF was never processed.
    if (showPdfHint) {
      return (
        <div className="mx-auto flex h-[50vh] flex-col items-center justify-center rounded-lg bg-base-200 p-6 text-center">
          <p className="mb-2 text-base-content/70">
            {t("file_preview.pdf_missing_title")}
          </p>
          <p className="text-sm text-base-content/70">
            {t("file_preview.pdf_missing_hint")}
          </p>
        </div>
      );
    }
  }

  if (fileType === "docx") {
    if (!data && !hasUrl) return <LoadingBox />;
    return <DocxViewer data={data} url={hasUrl ? url : undefined} />;
  }

  if (hasText) {
    if (isHtml) {
      return (
        <SandboxedHtmlPreview
          content={text}
          title={name}
          className="w-full rounded border border-base-300 bg-base-100"
        />
      );
    }

    if (fileType === "csv") return <CSVTable content={text} />;

    if (onOpenPath) {
      return (
        <div className="whitespace-pre-wrap break-words rounded-lg bg-base-200 p-4 font-mono text-xs leading-relaxed text-base-content">
          {text.split("\n").map((line, index) => {
            const file = gitStatLine(line);
            return file ? (
              <div key={index} className="flex min-w-0 items-baseline gap-1">
                <button
                  type="button"
                  onClick={() => onOpenPath(file.path)}
                  title={file.path}
                  className="min-w-0 truncate text-left text-accent underline decoration-dotted underline-offset-2 hover:text-primary"
                >
                  {file.path}
                </button>
                <span className="shrink-0 text-base-content/60">
                  {file.suffix}
                </span>
              </div>
            ) : (
              <div key={index} className="whitespace-pre-wrap">
                {line || "\u00a0"}
              </div>
            );
          })}
        </div>
      );
    }

    // Markdown goes through the chat's own renderer, so a .md file looks exactly like the
    // same text in a message: headings, tables, KaTeX, and the same fence renderers
    // (mermaid, typst, latex, code highlighting).
    if (fileType === "markdown" && text.trim()) {
      return (
        <MarkdownRenderer isLoading={false} resolveImage={resolveImage}>
          {text}
        </MarkdownRenderer>
      );
    }

    return (
      <pre className="w-full overflow-auto rounded-lg bg-base-200 p-6 font-mono text-sm text-base-content">
        {text || t("file_preview.no_content")}
      </pre>
    );
  }

  return (
    <p className="p-4 text-sm text-base-content/70">
      {t("file_preview.unsupported")}
    </p>
  );
}
