import { useMemo, useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import BaseModal from "../BaseModal"; // Using our new BaseModal (Headless UI)
import AudioPlayer from "./AudioPlayer";
import icon_cross_sm from "../../assets/icons/cross_sm.svg";
import { loadFile, useFile, useFileBase64, useFileContent } from "../../db";
import { X } from "lucide-react";
import { getFileType } from "../../utils/attachments";

// --------------------
// Utility + helper components
// --------------------

const CSVTable = ({ content }) => {
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
      setError("Failed to parse CSV content");
      return [];
    }
  }, [content]);

  if (error)
    return (
      <div className="p-4 text-red-500 dark:text-red-400">Error: {error}</div>
    );
  if (!parsedData?.length)
    return (
      <div className="p-4 text-gray-600 dark:text-gray-400">
        No data available
      </div>
    );

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="overflow-auto max-h-[85vh] w-full">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {parsedData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
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

export default function PreviewModal({ isOpen, onClose, fileId }) {

  const [loadError, setLoadError] = useState(null);
  const {file, data} = useFile(fileId);
  const base64 = useFileBase64(fileId); // TODO only load if important
  const textContent = useFileContent(fileId);
  if (!file) return null;

  const handleSave = () => {
    try {
      // Create file as is
      const fileToSave = new File([data], file?.name || "Save", { type: file.type })     

      // Create and use download link
      const downloadUrl = URL.createObjectURL(fileToSave);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file?.name || "Save";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 300);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file");
    }
  };

  const renderContent = () => {
    try {
      if (loadError)
        return (
          <div className="p-4 text-red-500 dark:text-red-400">
            Error: {loadError}
          </div>
        );
      if (!file)
        return (
          <div className="p-4 text-gray-600 dark:text-gray-400">
            No file to preview
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
              className="max-h-[85vh] max-w-full object-contain"
              onError={() => setLoadError("Failed to load image")}
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
              className="max-h-[85vh] max-w-full"
              onError={() => setLoadError("Failed to load video")}
            >
              Your browser does not support the video tag.
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
            <div className="flex flex-col items-center justify-center h-[50vh] p-6 text-center bg-gray-50 dark:bg-gray-800 rounded-lg">
              <svg
                className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
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
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                PDF preview is not available on mobile devices
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Please use a desktop browser to preview PDF files
              </p>
            </div>
          );
        }

        // If we have a valid PDF URL for preview (original PDF) AND not processed
        if (base64 && !isMobile) {
          return (
            <div className="w-full h-[85vh] flex flex-col">
              {/* Show processing status if not processed */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3 mb-4 mx-4">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Original PDF Preview
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      This PDF hasn&quot;t been processed yet. Click
                      &quot;Process&quot; to extract text content.
                    </p>
                  </div>
                </div>
              </div>

              <iframe
                src={base64}
                className="w-full flex-1"
                style={{ minWidth: "800px" }}
                title={file.name}
                onError={() => setLoadError("Failed to display PDF")}
              />
            </div>
          );
        }

        // If no PDF data available, show helpful message
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] p-6 text-center bg-gray-50 dark:bg-gray-800 rounded-lg mx-4">
            <svg
              className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4"
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
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              PDF content not available
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              The original PDF file data is not available for preview
            </p>
          </div>
        );
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
          <pre className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg overflow-auto max-h-[85vh] w-full font-mono text-sm text-gray-800 dark:text-gray-200">
            {textContent || "No content available"}
          </pre>
        );
      }

      // Code Viewer
      if (fileType === "code") {
        return (
          <pre className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg overflow-auto max-h-[85vh] w-full">
            <code className="font-mono text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {textContent || "No content available"}
            </code>
          </pre>
        );
      }

      // Default display for any other file type
      if (textContent && typeof textContent === "string") {
        return (
          <div className="bg-white dark:bg-gray-900 p-6 overflow-auto max-h-[80vh] w-full whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {textContent}
          </div>
        );
      }

      // Unsupported File Type
      return (
        <div className="p-4 text-gray-600 dark:text-gray-400">
          Unsupported file type
        </div>
      );
    } catch (error) {
      console.error("Error rendering content:", error);
      return (
        <div className="p-4 text-red-500 dark:text-red-400">
          Error displaying content: {error.message}
        </div>
      );
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      minimal={true}
      titleKey={null} // We'll pass custom header
      maxWidth="max-w-[1000px]"
    >
      {/* Custom Header with Filename + Actions */}
      <div className="flex justify-between items-center mb-4 px-2">
        <p className="text-lg font-medium text-tertiary dark:text-gray-200 truncate max-w-[70%]">
          {file.name}
        </p>
        <div className="flex items-center gap-4">
          {/* Download File Button */}
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-2xl text-white font-medium text-sm transition-colors cursor-pointer"
            aria-label="Download file"
          >
            Save to device
          </button>
          {/* Close Button */}
          <button onClick={onClose} aria-label="Close">
            <X
              className="h-[20px] w-[20px] cursor-pointer text-[#009EE0]"
              alt="cross"
              onClick={onClose}
            />{" "}
          </button>
        </div>
      </div>

      {/* Rendered File Content */}
      <div className="relative flex-1 min-h-0 overflow-auto">
        {renderContent()}
      </div>
    </BaseModal>
  );
}
