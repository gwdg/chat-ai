/* eslint-disable no-unused-vars */
//Libraries
import { Trans } from "react-i18next";
import { useEffect, useRef, useState } from "react";

//Assets
import video_icon from "../../assets/video_icon.svg";
import cross from "../../assets/cross.svg";
import uploaded from "../../assets/file_uploaded.svg";

//Redux
import { processPdfDocument } from "../../apis/PdfProcessApi";
import PreviewModal from "../../modals/PreviewModal";
import FileAlertModal from "../../modals/FileAlertModal";

const Files = ({
  selectedFiles,
  setSelectedFiles,
  notifySuccess,
  notifyError,
}) => {
  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [processingFiles, setProcessingFiles] = useState(new Set());
  const [previewFile, setPreviewFile] = useState(null);
  const [fileAlertModal, setFileAlertModal] = useState(null);

  //Refs
  const dropdownRef = useRef(null);
  const isIntentionalRefresh = useRef(false);

  //Functions
  // Remove a file from the selectedFiles array at specified index
  const removeFile = (index) => {
    // Create deep copy to avoid mutating state directly
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Convert file size from bytes to human-readable format (e.g., KB, MB, GB)
  function formatFileSize(bytes) {
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    // Keep dividing by 1024 until we reach the appropriate unit
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Return formatted string with 2 decimal places and unit
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // processing function
  const handlePdfProcess = async (file, index) => {
    try {
      setProcessingFiles((prev) => new Set(prev).add(index));

      // Pass the original File object
      const result = await processPdfDocument(file.file);

      if (result.success && result.content) {
        setSelectedFiles((prevFiles) => {
          const newFiles = [...prevFiles];
          newFiles[index] = {
            ...newFiles[index],
            processed: true,
            processedContent: result.content,
          };
          return newFiles;
        });

        notifySuccess("PDF processed successfully");
      } else {
        throw new Error(
          result.error || "No content received from PDF processing"
        );
      }
    } catch (error) {
      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles];
        newFiles[index] = {
          ...newFiles[index],
          processed: false,
        };
        return newFiles;
      });
      console.error("PDF processing error:", error);
      notifyError(`Failed to process PDF: ${error.message}`);
    } finally {
      setProcessingFiles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  // Calculate dropdown direction based on available space
  useEffect(() => {
    if (dropdownRef.current) {
      // Get dropdown position relative to viewport
      const rect = dropdownRef.current.getBoundingClientRect();
      // Calculate available space above and below
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Set direction based on which has more space
      setDirection(spaceBelow > spaceAbove ? "down" : "up");
    }
  }, [isOpen]); // Only recalculate when dropdown opens/closes

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5" || (e.ctrlKey && e.key === "r")) {
        if (selectedFiles.length > 0) {
          e.preventDefault();
          setFileAlertModal(true);
        }
      }
    };

    const handleBeforeUnload = (e) => {
      if (selectedFiles.length > 0 && !isIntentionalRefresh.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [selectedFiles]);

  return (
    <div className="w-[25%] mobile:w-full p-2 text-tertiary flex flex-col justify-end">
      <div>
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-4 bg-white dark:bg-bg_secondary_dark select-none rounded-2xl p-3 sm:p-4 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-base sm:text-lg font-medium">
                <Trans i18nKey="description.file1" />
              </p>
              <p
                className="text-red-400 hover:text-red-300 cursor-pointer text-xs sm:text-sm font-medium"
                onClick={() => setSelectedFiles([])}
              >
                <Trans i18nKey="description.file2" />
              </p>
            </div>

            <ul className="flex flex-col gap-3 sm:gap-4 overflow-auto max-h-[400px] pb-2 sm:pb-4">
              {Array.from(selectedFiles).map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="cursor-pointer flex gap-2 sm:gap-3 items-center bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-850 p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-colors duration-150"
                  onClick={() => setPreviewFile(file)}
                >
                  {file.type === "image" ? (
                    <img
                      className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] rounded-md object-cover flex-shrink-0"
                      src={file.text}
                      alt={file.name}
                    />
                  ) : file.type === "video" ? (
                    <img
                      className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] flex-shrink-0"
                      src={video_icon}
                      alt="video"
                    />
                  ) : (
                    <img
                      className="h-[36px] w-[36px] sm:h-[42px] sm:w-[42px] flex-shrink-0"
                      src={uploaded}
                      alt="uploaded"
                    />
                  )}

                  <div className="flex justify-between items-start sm:items-center w-full min-w-0">
                    <div className="flex flex-col gap-1 min-w-0 pr-2 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
                        <p className="overflow-hidden whitespace-nowrap text-ellipsis w-full max-w-[150px] sm:max-w-[200px] font-medium text-sm sm:text-base">
                          {file.name}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      {file.fileType === "pdf" && (
                        <div className="flex items-center mt-1">
                          {file.processed ? (
                            <span className="text-green-500 text-xs sm:text-sm font-medium px-2 py-0.5 sm:py-1 bg-green-100 dark:bg-green-900 bg-opacity-30 rounded">
                              Processed
                            </span>
                          ) : processingFiles.has(index) ? (
                            <div className="flex items-center gap-1 sm:gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                              <svg
                                className="animate-spin h-3 w-3 sm:h-4 sm:w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <span>Processing...</span>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePdfProcess(file, index);
                              }}
                              className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 text-xs sm:text-sm transition-colors"
                            >
                              Process
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cross icon with improved tap area for mobile */}
                    <button
                      className="p-1.5 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex-shrink-0 focus:outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      aria-label="Remove file"
                    >
                      <img
                        src={cross}
                        alt="remove"
                        className="h-[18px] w-[18px] sm:h-[22px] sm:w-[22px]"
                      />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      <>
        {fileAlertModal ? (
          <FileAlertModal
            showModal={setFileAlertModal}
            intentionalRefresh={isIntentionalRefresh}
          />
        ) : null}
      </>
    </div>
  );
};

export default Files;
