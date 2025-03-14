import { useState, useEffect } from "react";
import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";

const PreviewModal = ({ file, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);

  // Determine if content is text or image
  const isTextContent =
    typeof file === "object" && file.content && file.fileType !== "image";
  const content =
    typeof file === "string" ? file : isTextContent ? file.content : file.text;

  const title =
    typeof file === "string"
      ? "Preview"
      : file.name || (isTextContent ? "Text Preview" : "Image Preview");

  // Reset zoom when content changes
  useEffect(() => {
    setScale(1);
    setIsLoading(!isTextContent); // Don't show loading for text content
    setError(null);
  }, [file, isTextContent]);

  const handleZoom = (type) => {
    setScale((prev) => {
      if (type === "in" && prev < 3) return prev + 0.5;
      if (type === "out" && prev > 0.5) return prev - 0.5;
      return prev;
    });
  };

  // Function to handle file download
  const handleDownload = () => {
    try {
      // Generate file name with appropriate extension
      let fileName = title;

      // Check if this is a PDF file that needs to be converted to markdown
      if (
        isTextContent &&
        typeof file === "object" &&
        file.name &&
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        // For PDF files, replace the .pdf extension with .md
        fileName = fileName.replace(/\.pdf$/i, ".md");
      } else if (!fileName.includes(".")) {
        // Add extension if not present
        if (isTextContent) {
          fileName += ".txt";
        } else {
          // For images, try to detect format or default to .png
          if (
            typeof content === "string" &&
            content.startsWith("data:image/")
          ) {
            const match = content.match(/data:image\/([a-zA-Z0-9]+);/);
            if (match && match[1]) {
              fileName += `.${match[1]}`;
            } else {
              fileName += ".png";
            }
          } else {
            fileName += ".png";
          }
        }
      }

      // Create downloadable content
      let downloadUrl;
      let blob;

      if (isTextContent) {
        // For text content
        blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      } else {
        // For image content (already a URL or data URL)
        if (content.startsWith("data:")) {
          // It's a data URL, use as is
          downloadUrl = content;
        } else {
          // It's a URL, need to fetch it first
          // For simplicity, we'll create a temporary link to the same URL
          downloadUrl = content;
        }
      }

      if (!downloadUrl) {
        // If we created a blob (for text), create an object URL
        downloadUrl = URL.createObjectURL(blob);
      }

      // Create a temporary anchor element and trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      // Clean up
      document.body.removeChild(a);
      if (blob) {
        // Only revoke if we created an object URL from a blob
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file");
    }
  };

  return (
    <ContainerModal showModal={onClose}>
      <div className="dark:border-border_dark rounded-2xl bg-white dark:bg-black p-4 w-[90vw] sm:w-[70vw] max-w-[1000px] max-h-[95vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2">
          <p className="text-lg font-medium text-tertiary truncate max-w-[80%] dark:text-gray-200">
            {title}
          </p>
          <div className="flex items-center gap-4">
            {!isTextContent && (
              <>
                <button
                  onClick={() => handleZoom("out")}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-tertiary dark:text-gray-300"
                  disabled={scale <= 0.5}
                  aria-label="Zoom out"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M20 12H4"
                    />
                  </svg>
                </button>
                <span className="text-sm text-tertiary dark:text-gray-400">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => handleZoom("in")}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-tertiary dark:text-gray-300"
                  disabled={scale >= 3}
                  aria-label="Zoom in"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </>
            )}

            {/* Download button */}
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-tertiary hover:bg-blue-600 rounded-2xl text-white font-medium text-sm transition-colors"
              aria-label="Save"
              title="Save file"
            >
              Save
            </button>
            <img
              src={cross}
              alt="close"
              className="h-[30px] w-[30px] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="relative flex justify-center items-center overflow-auto max-h-[80vh]">
          {isLoading && !isTextContent && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
            </div>
          )}

          {error && !isTextContent && (
            <div className="text-red-500 dark:text-red-400 text-center p-4">
              Failed to load content. Please try again.
            </div>
          )}

          {isTextContent ? (
            <div className="w-full overflow-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {content}
            </div>
          ) : (
            <div className="relative" style={{ transform: `scale(${scale})` }}>
              <img
                src={content}
                alt="Preview"
                className="max-h-[85vh] max-w-full object-contain transition-transform duration-200"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </ContainerModal>
  );
};

export default PreviewModal;
