import { useMemo, useEffect, useState, useRef } from "react";
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
  ".txt",
  ".csv",
  ".pdf",
  ".md",
  ".tex",
  ".xml",
  ".yaml",
  ".yml",
  ".ini",
  ".toml",
  ".properties",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".sh",
  ".ps1",
  ".pl",
  ".lua",
  ".r",
  ".m",
  ".mat",
  ".asm",
  ".sql",
  ".ipynb",
  ".rmd",
  ".dockerfile",
  ".proto",
  ".cfg",
  ".bat",
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
    return (
      <div className="p-4 text-red-500 dark:text-red-400">Error: {error}</div>
    );
  }

  if (!parsedData?.length) {
    return (
      <div className="p-4 text-gray-600 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const headers = Object.keys(parsedData[0]);

  return (
    <div className="overflow-auto max-h-[85vh] w-full">
      <table className="min-w-full border-collapse">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
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

const AudioPlayer = ({ file }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError(true);
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration || !isFinite(duration)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time) => {
    if (isNaN(time) || !isFinite(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  if (error) {
    return (
      <div className="w-full max-w-md p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-700/50 mx-auto">
        <div className="text-center text-red-600 dark:text-red-400">
          Failed to load audio file
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700/50 mx-auto">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={`data:audio/${file.format || "wav"};base64,${file.data}`}
        preload="metadata"
      />

      {/* Audio info */}
      <div className="text-center mb-6">
        <div className="bg-blue-500 dark:bg-blue-600 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
          {file.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {file.format?.toUpperCase()} • {formatFileSize(file.size)}
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
        </div>
      )}

      {/* Audio controls */}
      {!isLoading && (
        <div className="space-y-4">
          {/* Play/Pause button */}
          <div className="flex justify-center">
            <button
              onClick={togglePlayPause}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full p-3 transition-colors"
            >
              {isPlaying ? (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div
              className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 cursor-pointer"
              onClick={handleSeek}
            >
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${
                    duration &&
                    isFinite(duration) &&
                    currentTime &&
                    isFinite(currentTime)
                      ? (currentTime / duration) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}
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
    if (file?.isAudio) return "audio";
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

  const handleDownload = () => {
    try {
      const fileType = getFileType(file);
      let fileName = file?.name || "download";
      let downloadUrl;
      let blob;

      if (fileType === "audio") {
        if (!fileName.includes(".")) {
          fileName += `.${file.format || "wav"}`;
        }
        // Convert base64 to blob
        const byteCharacters = atob(file.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: `audio/${file.format || "wav"}` });
        downloadUrl = URL.createObjectURL(blob);
      } else {
        // Handle other file types (text, images, etc.)
        const textContent = getTextContent(file);
        if (fileType === "image") {
          downloadUrl = textContent;
        } else {
          // Text content
          if (!fileName.includes(".")) {
            fileName += ".txt";
          }
          blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
          downloadUrl = URL.createObjectURL(blob);
        }
      }

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (blob) {
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file");
    }
  };

  const renderContent = () => {
    try {
      if (loadError) {
        return (
          <div className="p-4 text-red-500 dark:text-red-400">
            Error: {loadError}
          </div>
        );
      }

      if (!file) {
        return (
          <div className="p-4 text-gray-600 dark:text-gray-400">
            No file to preview
          </div>
        );
      }

      const fileType = getFileType(file);
      const textContent = getTextContent(file);

      if (fileType === "audio") {
        return (
          <div className="flex justify-center items-center min-h-[400px]">
            <AudioPlayer file={file} />
          </div>
        );
      }

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
            <div className="bg-white dark:bg-gray-900 p-6 overflow-auto max-h-[80vh] w-full whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {file.processedContent}
            </div>
          );
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
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
          <pre className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg overflow-auto max-h-[85vh] w-full font-mono text-sm text-gray-800 dark:text-gray-200">
            {textContent || "No content available"}
          </pre>
        );
      }

      if (isCodeFile(fileName)) {
        return (
          <pre className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg overflow-auto max-h-[85vh] w-full">
            <code className="font-mono text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {textContent || "No content available"}
            </code>
          </pre>
        );
      }

      // Default text display for any other file type
      if (textContent && typeof textContent === "string") {
        return (
          <div className="bg-white dark:bg-gray-900 p-6 overflow-auto max-h-[80vh] w-full whitespace-pre-wrap text-gray-800 dark:text-gray-200">
            {textContent}
          </div>
        );
      }

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
    <ContainerModal showModal={onClose}>
      <div className="rounded-2xl bg-white dark:bg-black p-4 w-[90vw] max-w-[1000px] max-h-[95vh] overflow-hidden flex flex-col border dark:border-gray-700">
        <div className="flex justify-between items-center mb-4 px-2">
          <p className="text-lg font-medium text-tertiary dark:text-gray-200 truncate max-w-[70%]">
            {fileName || "Preview"}
          </p>

          <div className="flex items-center gap-4">
            {/* Download button */}
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-2xl text-white font-medium text-sm transition-colors"
              aria-label="Download file"
              title="Download file"
            >
              Download
            </button>

            <img
              src={cross}
              alt="close"
              className="h-[30px] w-[30px] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onClose}
            />
          </div>
        </div>
        <div className="relative flex-1 min-h-0">{renderContent()}</div>
      </div>
    </ContainerModal>
  );
};

export default PreviewModal;
