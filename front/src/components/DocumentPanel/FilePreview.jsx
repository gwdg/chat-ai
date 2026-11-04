import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Papa from "papaparse";
import AudioPlayer from "../../modals/Chat/AudioPlayer";
import { useFile, useFileBase64, useFileContent } from "../../db";
import { getFileType } from "../../utils/attachments";

// --------------------
// Utility + helper components
// --------------------

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
    } catch (error) {
      setError(t("file_preview.csv_parse_failed"));
      return [];
    }
  }, [content]);

  if (error)
    return (
      <div className="p-4 text-error">{t("file_preview.error", { message: error })}</div>
    );
  if (!parsedData?.length)
    return (
      <div className="p-4 text-base-content/70">
        {t("file_preview.no_data")}
      </div>
    );

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="overflow-auto w-full">
      <table className="min-w-full border-collapse">
        <thead className="bg-base-200 sticky top-0 z-10">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-base-content/70 uppercase tracking-wider border border-base-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-base-100 divide-y divide-base-300">
          {parsedData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 border border-base-300"
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

// Renders a .docx in the browser; docx-preview is loaded on first use.
// `data` may change (live preview): each version renders off-screen and then
// replaces the shown one, so updates do not flash the loading state.
export const DocxViewer = ({ data }) => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const outerRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [renders, setRenders] = useState(0);

  useEffect(() => {
    if (!data || !ref.current) return;
    let cancelled = false;
    const container = ref.current;
    const next = document.createElement("div");
    import("docx-preview")
      .then(({ renderAsync }) => renderAsync(data, next, undefined, { inWrapper: true }))
      .then(() => {
        if (cancelled) return;
        container.replaceChildren(...next.childNodes);
        setStatus("done");
        setRenders((count) => count + 1);
      })
      .catch((err) => {
        console.error("DOCX preview failed:", err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Keep the pages at their paper size and scale the whole document down to
  // the available width (never up). `zoom` also shrinks the layout height.
  useEffect(() => {
    const outer = outerRef.current;
    const inner = ref.current;
    if (!renders || !outer || !inner) return;
    inner.style.zoom = "1";
    const natural = inner.scrollWidth;
    const fit = () => {
      // 1px slack: a fractional zoom can otherwise round up into a 1px overflow
      if (natural) inner.style.zoom = String(Math.min(1, (outer.clientWidth - 1) / natural));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [renders]);

  return (
    <div ref={outerRef} className="w-full overflow-x-hidden">
      {status === "loading" && (
        <div className="p-4 text-base-content/70">
          {t("common.loading")}
        </div>
      )}
      {status === "error" && (
        <div className="p-4 text-error">
          {t("file_preview.docx_failed")}
        </div>
      )}
      <div ref={ref} className={status === "error" ? "hidden" : ""} />
    </div>
  );
};

/** Renders a stored file (by fileId) for the document side panel. */
export default function FilePreview({ fileId }) {
  const { t } = useTranslation();

  const [loadError, setLoadError] = useState(null);
  const {file, data} = useFile(fileId);
  const base64 = useFileBase64(fileId); // TODO only load if important
  const textContent = useFileContent(fileId);
  if (!file)
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );

  const renderContent = () => {
    try {
      if (loadError)
        return (
          <div className="p-4 text-error">
            {t("file_preview.error", { message: loadError })}
          </div>
        );
      if (!file)
        return (
          <div className="p-4 text-base-content/70">
            {t("file_preview.no_file")}
          </div>
        );

      const fileType = getFileType(file);
      // Audio Player
      if (fileType === "audio") {
        return (
          <div className="flex justify-center items-center min-h-[400px]">
            <AudioPlayer file={file} dataURL={base64} />
          </div>
        );
      }
      // Image Viewer
      if (fileType === "image") {
        return (
          <div className="flex justify-center">
            <img
              src={base64}
              alt={file.name}
              className="max-w-full object-contain"
              onError={() => setLoadError(t("file_preview.image_failed"))}
            />
          </div>
        );
      }
      // Video Player
      if (fileType === "video") {
        return (
          <div className="flex justify-center">
            <video
              src={base64}
              controls
              className="max-w-full"
              onError={() => setLoadError(t("file_preview.video_failed"))}
            >
              {t("file_preview.video_unsupported")}
            </video>
          </div>
        );
      }

      // PDF Viewer
      if (fileType === "pdf") {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Show mobile warning for PDF previews (only if not processed)
        if (isMobile && base64) {
          return (
            <div className="flex flex-col items-center justify-center h-[50vh] p-6 text-center bg-base-200 rounded-lg">
              <svg
                className="w-12 h-12 text-base-content/50 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-base-content/70 mb-2">
                {t("file_preview.pdf_mobile_title")}
              </p>
              <p className="text-sm text-base-content/70">
                {t("file_preview.pdf_mobile_hint")}
              </p>
            </div>
          );
        }

        // If we have a valid PDF URL for preview (original PDF) AND not processed
        if (base64 && !isMobile) {
          return (
            <div className="w-full h-full flex flex-col">
              {/* Show processing status if not processed */}
              <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4 mx-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-info"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-info">
                      {t("file_preview.pdf_original_title")}
                    </p>
                    <p className="text-xs text-info">
                      {t("file_preview.pdf_original_hint")}
                    </p>
                  </div>
                </div>
              </div>

              <iframe
                src={base64}
                className="w-full flex-1"
                                title={file.name}
                onError={() => setLoadError(t("file_preview.pdf_failed"))}
              />
            </div>
          );
        }

        // If no PDF data available, show helpful message
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] p-6 text-center bg-base-200 rounded-lg mx-4">
            <svg
              className="w-12 h-12 text-base-content/50 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-base-content/70 mb-2">
              {t("file_preview.pdf_missing_title")}
            </p>
            <p className="text-sm text-base-content/70">
              {t("file_preview.pdf_missing_hint")}
            </p>
          </div>
        );
      }

      // Word document viewer
      if (fileType === "docx") {
        return <DocxViewer data={data} />;
      }

      // CSV Table Viewer
      if (fileType === "csv") {
        return <CSVTable content={file.content || data} />;
      }

      if (
        fileType === "text" ||
        fileType === "markdown" ||
        fileType === "txt"
      ) {
        return (
          <pre className="bg-base-200 p-6 rounded-lg overflow-auto w-full whitespace-pre-wrap break-words font-mono text-sm text-base-content">
            {textContent || t("file_preview.no_content")}
          </pre>
        );
      }

      // Code Viewer
      if (fileType === "code") {
        return (
          <pre className="bg-base-200 p-6 rounded-lg overflow-auto w-full">
            <code className="font-mono text-sm whitespace-pre-wrap text-base-content">
              {textContent || t("file_preview.no_content")}
            </code>
          </pre>
        );
      }

      // Default display for any other file type
      if (textContent && typeof textContent === "string") {
        return (
          <div className="bg-base-100 p-6 overflow-auto w-full whitespace-pre-wrap text-base-content">
            {textContent}
          </div>
        );
      }

      // Unsupported File Type
      return (
        <div className="p-4 text-base-content/70">
          {t("file_preview.unsupported")}
        </div>
      );
    } catch (error) {
      console.error("Error rendering content:", error);
      return (
        <div className="p-4 text-error">
          {t("file_preview.error_display", { message: error.message })}
        </div>
      );
    }
  };

  return renderContent();
}
