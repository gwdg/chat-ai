import { useState, useEffect, useRef } from "react";
import ContainerModal from "./ContainerModal";
import cross from "../../assets/cross.svg";

const PreviewImageModal = ({ file, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  // Determine content type - Updated logic for new file format
  const isTextContent =
    typeof file === "object" &&
    file.content &&
    file.fileType !== "image" &&
    file.type !== "audio" &&
    !file.isAudio;

  const isAudioContent =
    typeof file === "object" && (file.isAudio || file.type === "audio");

  const isImageContent = !isTextContent && !isAudioContent;

  // Updated content extraction logic
  const content = (() => {
    if (typeof file === "string") return file;
    if (isTextContent) return file.content;
    if (isAudioContent) {
      // Handle both old and new audio formats
      return file.data || file.text;
    }
    return file.text || file.content;
  })();

  const title =
    typeof file === "string"
      ? "Preview"
      : file.name ||
        (isTextContent
          ? "Text Preview"
          : isAudioContent
          ? "Audio Preview"
          : "Image Preview");

  // Reset when content changes
  useEffect(() => {
    setScale(1);
    setIsLoading(!isTextContent && !isAudioContent);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [file, isTextContent, isAudioContent]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isAudioContent) return;

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

    const handleError = (e) => {
      console.error("Audio loading error:", e);
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
  }, [isAudioContent]);

  const handleZoom = (type) => {
    setScale((prev) => {
      if (type === "in" && prev < 3) return prev + 0.5;
      if (type === "out" && prev > 0.5) return prev - 0.5;
      return prev;
    });
  };

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

  // Function to handle file download
  const handleDownload = () => {
    try {
      let fileName = title;
      let downloadUrl;
      let blob;

      if (isTextContent) {
        if (file.name && file.name.toLowerCase().endsWith(".pdf")) {
          fileName = fileName.replace(/\.pdf$/i, ".md");
        } else if (!fileName.includes(".")) {
          fileName += ".txt";
        }
        blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        downloadUrl = URL.createObjectURL(blob);
      } else if (isAudioContent) {
        if (!fileName.includes(".")) {
          fileName += `.${file.format || "wav"}`;
        }
        // Convert base64 to blob
        const byteCharacters = atob(content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: `audio/${file.format || "wav"}` });
        downloadUrl = URL.createObjectURL(blob);
      } else {
        // Image content
        if (!fileName.includes(".")) {
          if (content.startsWith("data:image/")) {
            const match = content.match(/data:image\/([a-zA-Z0-9]+);/);
            fileName += `.${match?.[1] || "png"}`;
          } else {
            fileName += ".png";
          }
        }
        downloadUrl = content.startsWith("data:") ? content : content;
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

  // Create audio source URL with better error handling
  const audioSrc = (() => {
    if (!isAudioContent || !content) return null;

    try {
      const format = file.format || "wav";
      return `data:audio/${format};base64,${content}`;
    } catch (error) {
      console.error("Error creating audio source:", error);
      return null;
    }
  })();

  return (
    <ContainerModal showModal={onClose}>
      <div className="dark:border-border_dark rounded-2xl bg-white dark:bg-black p-4 w-[90vw] sm:w-[70vw] max-w-[1000px] max-h-[95vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2">
          <p className="text-lg font-medium text-tertiary truncate max-w-[60%] dark:text-gray-200">
            {title}
          </p>
          <div className="flex items-center gap-4">
            {isImageContent && (
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
              className="h-[24px] w-[24px] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="relative flex justify-center items-center overflow-auto max-h-[80vh]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
            </div>
          )}

          {error && (
            <div className="text-red-500 dark:text-red-400 text-center p-4">
              Failed to load content. Please try again.
            </div>
          )}

          {isTextContent && (
            <div className="w-full overflow-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {content}
            </div>
          )}

          {isAudioContent && audioSrc && (
            <div className="w-full max-w-md p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700/50">
              {/* Audio element */}
              <audio ref={audioRef} src={audioSrc} preload="metadata" />

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
                  {(file.format || "AUDIO")?.toUpperCase()} •{" "}
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Audio controls */}
              <div className="space-y-4">
                {/* Play/Pause button */}
                <div className="flex justify-center">
                  <button
                    onClick={togglePlayPause}
                    disabled={isLoading || error}
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
            </div>
          )}

          {isAudioContent && !audioSrc && (
            <div className="text-red-500 dark:text-red-400 text-center p-4">
              Failed to load audio file.
            </div>
          )}

          {isImageContent && (
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

export default PreviewImageModal;
