import { useMemo, useEffect, useState } from "react";
import Papa from "papaparse";
import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg"; // Close icon

const CODE_EXTENSIONS = [
  ".py",
  ".js",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".cs",
  ".rb",
  ".php",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".ts",
  ".jsx",
  ".tsx",
  ".html",
  ".json",
];

const isCodeFile = (filename) => {
  try {
    return CODE_EXTENSIONS.some((ext) => filename?.toLowerCase().endsWith(ext));
  } catch (error) {
    console.error("Error checking file extension:", error);
    return false;
  }
};

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

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!parsedData?.length) {
    return <div className="p-4">No data available</div>;
  }

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="overflow-auto max-h-[85vh] w-full">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200 bg-gray-50"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {parsedData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200"
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

const PreviewModal = ({ file, onClose }) => {
  const [loadError, setLoadError] = useState(null);

  // Helper function to safely extract text content
  const getTextContent = (file) => {
    if (typeof file === "string") return file;
    if (file?.content) return file.content;
    if (file?.text) return file.text;
    return "";
  };

  // Helper function to get file type
  const getFileType = (file) => {
    if (file?.type) return file.type;
    if (file?.content?.type) return file.content.type;
    if (file?.fileType) return file.fileType;
    return "unknown";
  };

  const fileName = useMemo(() => {
    if (file?.name) return file.name;
    if (typeof file === "string") return "Preview";

    // If we have content with text, try to extract filename from text content
    const textContent = getTextContent(file);
    if (textContent && typeof textContent === "string") {
      const firstLine = textContent.split("\n")[0];
      if (firstLine && firstLine.includes(":")) {
        return firstLine.split(":")[0].trim();
      }
    }

    return "Preview";
  }, [file]);

  const pdfUrl = useMemo(() => {
    try {
      const fileType = getFileType(file);
      return fileType === "pdf" ? URL.createObjectURL(file.file) : null;
    } catch (error) {
      setLoadError("Failed to load PDF file");
      return null;
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const renderContent = () => {
    try {
      if (loadError) {
        return <div className="p-4 text-red-500">Error: {loadError}</div>;
      }

      if (!file) {
        return <div className="p-4">No file to preview</div>;
      }

      const fileType = getFileType(file);
      const textContent = getTextContent(file);

      if (fileType === "image") {
        return (
          <div className="flex justify-center">
            <img
              src={textContent}
              alt={fileName}
              className="max-h-[85vh] max-w-full object-contain"
              onError={() => setLoadError("Failed to load image")}
            />
          </div>
        );
      }

      if (fileType === "video") {
        return (
          <div className="flex justify-center">
            <video
              src={textContent}
              controls
              className="max-h-[85vh] max-w-full"
              onError={() => setLoadError("Failed to load video")}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      }

      if (fileType === "pdf") {
        if (file.processed && file.processedContent) {
          return (
            <div className="bg-white p-6 overflow-auto max-h-[80vh] w-full whitespace-pre-wrap">
              {file.processedContent}
            </div>
          );
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          return (
            <div className="flex flex-col items-center justify-center h-[50vh] p-6 text-center bg-gray-50 rounded-lg">
              <svg
                className="w-12 h-12 text-gray-400 mb-4"
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
              <p className="text-gray-600 mb-2">
                PDF preview is not available on mobile devices
              </p>
              <p className="text-sm text-gray-500">
                Please use a desktop browser to preview PDF files
              </p>
            </div>
          );
        }

        return (
          <iframe
            src={pdfUrl}
            className="w-full h-[85vh]"
            style={{ minWidth: "800px" }}
            title={fileName}
          />
        );
      }

      if (fileType === "csv") {
        return <CSVTable content={file.content || textContent} />;
      }

      if (
        fileType === "text" ||
        fileType === "markdown" ||
        fileType === "txt"
      ) {
        return (
          <pre className="bg-gray-100 p-6 rounded-lg overflow-auto max-h-[85vh] w-full font-mono text-sm">
            {textContent || "No content available"}
          </pre>
        );
      }

      if (isCodeFile(fileName)) {
        return (
          <pre className="bg-gray-50 p-6 rounded-lg overflow-auto max-h-[85vh] w-full">
            <code className="font-mono text-sm whitespace-pre-wrap">
              {textContent || "No content available"}
            </code>
          </pre>
        );
      }

      // Default text display for any other file type
      if (textContent && typeof textContent === "string") {
        return (
          <div className="bg-white p-6 overflow-auto max-h-[80vh] w-full whitespace-pre-wrap">
            {textContent}
          </div>
        );
      }

      return <div className="p-4">Unsupported file type</div>;
    } catch (error) {
      console.error("Error rendering content:", error);
      return (
        <div className="p-4 text-red-500">
          Error displaying content: {error.message}
        </div>
      );
    }
  };

  return (
    <ContainerModal showModal={onClose}>
      <div className="rounded-2xl bg-white dark:bg-black p-4 w-[90vw] max-w-[1000px] max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4 px-2">
          <p className="text-lg font-medium text-tertiary truncate max-w-[80%]">
            {fileName || "Preview"}
          </p>

          <img
            src={cross}
            alt="close"
            className="h-[30px] w-[30px] cursor-pointer"
            onClick={onClose}
          />
        </div>
        <div className="relative flex-1 min-h-0">{renderContent()}</div>
      </div>
    </ContainerModal>
  );
};

export default PreviewModal;
