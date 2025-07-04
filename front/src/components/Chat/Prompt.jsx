/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

//Assets
import clear from "../../assets/cross_icon.svg";
import settings_icon from "../../assets/Settings_Icon.svg";
import image_icon from "../../assets/icon_image.svg";
import send from "../../assets/icon_send.svg";
import upload from "../../assets/add.svg";
import mic from "../../assets/icon_mic.svg";
import stop from "../../assets/stop_listening.svg";
import pause from "../../assets/pause.svg";
import {
  cancelRequest,
  fetchLLMResponse,
  updateMemory,
} from "../../apis/LlmRequestApi";
import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { setIsResponding } from "../../Redux/reducers/conversationsSlice";
import video_icon from "../../assets/video_icon.svg";
import cross from "../../assets/cross.svg";
import uploaded from "../../assets/file_uploaded.svg";
import { processPdfDocument } from "../../apis/PdfProcessApi";
import {
  addMemory,
  editMemory,
  deleteMemory,
  selectAllMemories,
  deleteAllMemories,
} from "../../Redux/reducers/userMemorySlice";
import handleLLMResponse from "../../utils/handleLLMResponse";

//Variable
const languageMap = {
  en: "en-US",
  de: "de-DE",
};
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

function Prompt({
  modelList,
  loading,
  loadingResend,
  isImageSupported,
  isVideoSupported,
  isArcanaSupported,
  selectedFiles,
  localState,
  setLocalState,
  setShowMicModal,
  setLoading,
  setSelectedFiles,
  setShowModalSession,
  setShowBadRequest,
  toggleAdvOpt,
  updateLocalState,
  notifySuccess,
  notifyError,
  adjustHeight,
  setPdfNotProcessedModal,
  setPreviewFile,
  showAdvOpt,
}) {
  //Hooks
  const { t, i18n } = useTranslation();
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);
  const timeoutTime = useSelector((state) => state.timeout.timeoutTime);

  //Refs
  const hiddenFileInput = useRef(null);
  const hiddenFileInputImage = useRef(null);
  const textareaRef = useRef(null);

  //Local useStates
  const [processingFiles, setProcessingFiles] = useState(new Set());

  // Converts a file to base64 string format using FileReader
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Main function to fetch and process LLM response
  const getRes = async (updatedConversation) => {
    await handleLLMResponse({
      operationType: "new",
      updatedConversation,
      dispatch,
      localState,
      updateLocalState,
      setLocalState,
      setLoading,
      selectedFiles,
      setSelectedFiles,
      modelList,
      memories,
      isArcanaSupported,
      updateMemory,
      fetchLLMResponse,
      notifyError,
      notifySuccess,
      setShowModalSession,
      setShowBadRequest,
      timeoutTime,
    });
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

  // Remove a file from the selectedFiles array at specified index
  const removeFile = (index) => {
    // Create deep copy to avoid mutating state directly
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Handle file drop events for images and videos
  const handleDrop = async (event) => {
    if (!isImageSupported && !isVideoSupported) return;
    event.preventDefault();
    try {
      // Filter for supported image types
      const droppedFiles = Array.from(event.dataTransfer.files).filter(
        (file) =>
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/gif" ||
          file.type === "image/webp" ||
          file.type === "video/mp4"
      );

      // Validate dropped files
      if (droppedFiles.length === 0) {
        notifyError("Only image or video files are allowed");
        return;
      } else {
        notifySuccess("Image(s) dropped");
      }

      // Convert dropped images to base64 and update state
      const fileList = [];
      for (const file of droppedFiles) {
        const base64 = await readFileAsBase64(file);
        fileList.push({
          name: file.name,
          type: file.type.startsWith("image/") ? "image" : "video",
          size: file.size,
          text: base64,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...fileList]);
    } catch (error) {
      notifyError("An error occurred while dropping the files: ", error);
    }
  };
  // Handle changes in the prompt textarea
  const handleChange = (event) => {
    updateLocalState({ prompt: event.target.value });
    adjustHeight();
  };

  const getAcceptedFileTypes = (isImageSupported, isVideoSupported) => {
    const types = [];
    if (isImageSupported) {
      types.push(".jpg", ".jpeg", ".png", ".gif", ".webp");
    }
    if (isVideoSupported) {
      types.push(".mp4", ".avi");
    }
    return types.join(",");
  };

  // Handle cancellation of ongoing requests
  const handleCancelRequest = () => {
    cancelRequest(notifyError);
    dispatch(setIsResponding(false));
    setLoading(false);
  };

  // Handle form submission with prompt and files
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Skip empty prompts
    if (localState.prompt?.trim() === "") return;

    // Check for unprocessed PDF files
    const hasUnprocessedPDF = selectedFiles.some(
      (file) => file.fileType === "pdf" && !file.processed
    );

    if (hasUnprocessedPDF) {
      setPdfNotProcessedModal(true);
      return;
    }

    // Stop speech recognition if active
    SpeechRecognition.stopListening();
    resetTranscript();

    try {
      let newConversation;

      // Process submission with files
      if (selectedFiles.length > 0) {
        const textFiles = selectedFiles.filter(
          (file) => file.type !== "image" && file.type !== "video"
        );
        const imageFiles = selectedFiles.filter(
          (file) => file.type === "image"
        );
        const videoFiles = selectedFiles.filter(
          (file) => file.type === "video"
        );

        // Process text files, including processed PDFs
        const allTextFilesText = textFiles
          .map((file) => {
            // If it's a processed PDF, use its processed content
            if (file.fileType === "pdf") {
              return `${file.name}: ${file.processedContent}`;
            }
            // For other text files, use regular content
            return `${file.name}: ${file.content}`;
          })
          .filter(Boolean)
          .join("\n");

        const fullPrompt = `${localState.prompt}\n${allTextFilesText}`;

        // Process image files
        const imageContent = imageFiles.map((imageFile) => ({
          type: "image_url",
          image_url: {
            url: imageFile.text,
          },
        }));

        // Process video files
        const videoContent = videoFiles.map((videoFile) => ({
          type: "video_url",
          video_url: {
            url: videoFile.text,
          },
        }));

        // Create combined prompt content
        const newPromptContent = [
          {
            type: "text",
            text: fullPrompt,
          },
          ...imageContent,
          ...videoContent,
        ];

        newConversation = [
          ...localState.conversation,
          { role: "user", content: newPromptContent },
        ];
      } else {
        // Simple text-only submission
        newConversation = [
          ...localState.conversation,
          { role: "user", content: localState.prompt },
        ];
      }

      // Update conversation state
      setLocalState((prevState) => ({
        ...prevState,
        conversation: newConversation,
      }));

      const stillHasUnprocessedPDF = selectedFiles.some(
        (file) => file.fileType === "pdf" && !file.processed
      );

      if (stillHasUnprocessedPDF) {
        setPdfNotProcessedModal(true);
        return;
      }

      await getRes(newConversation);
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  };
  // Handle pasting images from clipboard
  const handlePaste = async (event) => {
    try {
      const clipboardItems = event.clipboardData.items;
      const imageItems = [];

      // Extract image items from clipboard
      for (const item of clipboardItems) {
        if (item.type.startsWith("image/")) {
          imageItems.push(item.getAsFile());
        }
      }

      if (imageItems.length > 0) {
        const imageFileList = [];

        // Process each pasted image
        for (const file of imageItems) {
          const base64 = await readFileAsBase64(file);
          const timestamp = new Date()
            .toISOString()
            .replace(/[-:.]/g, "")
            .slice(0, 15);
          const imageName = `clipboard_${timestamp}`;

          imageFileList.push({
            name: imageName,
            type: "image",
            size: file.size,
            text: base64,
          });
        }

        setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
        notifySuccess("Image pasted from clipboard");
      }
    } catch (error) {
      notifyError("An error occurred while pasting: ", error);
    }
  };

  // Trigger image file input click
  const handleClickImage = () => {
    hiddenFileInputImage.current.value = null;
    hiddenFileInputImage.current.click();
  };

  // Read file content as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Format CSV text for display
  const formatCSVText = (csvText) => {
    const rows = csvText.split("\n");
    const formattedRows = rows.map((row) => row.split(",").join(" | "));
    return formattedRows.join("\n");
  };

  // Handle text and CSV file uploads
  const handleFilesChange = async (e) => {
    try {
      // Filter for text, CSV, PDF and Markdown files
      const textFiles = Array.from(e.target.files).filter(
        (file) => file.type === "text/plain"
      );
      const csvFiles = Array.from(e.target.files).filter(
        (file) => file.type === "text/csv"
      );
      const pdfFiles = Array.from(e.target.files).filter(
        (file) => file.type === "application/pdf"
      );
      const mdFiles = Array.from(e.target.files).filter(
        (file) => file.type === "text/markdown" || file.name.endsWith(".md")
      );
      const codeFiles = Array.from(e.target.files).filter(
        (file) =>
          file.name.endsWith(".py") ||
          file.name.endsWith(".js") ||
          file.name.endsWith(".java") ||
          file.name.endsWith(".cpp") ||
          file.name.endsWith(".c") ||
          file.name.endsWith(".h") ||
          file.name.endsWith(".cs") ||
          file.name.endsWith(".rb") ||
          file.name.endsWith(".php") ||
          file.name.endsWith(".go") ||
          file.name.endsWith(".rs") ||
          file.name.endsWith(".swift") ||
          file.name.endsWith(".kt") ||
          file.name.endsWith(".ts") ||
          file.name.endsWith(".jsx") ||
          file.name.endsWith(".tsx") ||
          file.name.endsWith(".html") ||
          file.name.endsWith(".json") ||
          file.name.endsWith(".tex") ||
          file.name.endsWith(".yaml") ||
          file.name.endsWith(".toml") ||
          file.name.endsWith(".dart") ||
          file.name.endsWith(".tex") ||
          file.name.endsWith(".xml") ||
          file.name.endsWith(".yaml") ||
          file.name.endsWith(".yml") ||
          file.name.endsWith(".csv") ||
          file.name.endsWith(".ini") ||
          file.name.endsWith(".toml") ||
          file.name.endsWith(".properties") ||
          file.name.endsWith(".css") ||
          file.name.endsWith(".scss") ||
          file.name.endsWith(".sass") ||
          file.name.endsWith(".less") ||
          file.name.endsWith(".md") ||
          file.name.endsWith(".markdown") ||
          file.name.endsWith(".sh") ||
          file.name.endsWith(".ps1") ||
          file.name.endsWith(".pl") ||
          file.name.endsWith(".lua") ||
          file.name.endsWith(".r") ||
          file.name.endsWith(".m") ||
          file.name.endsWith(".mat") ||
          file.name.endsWith(".asm") ||
          file.name.endsWith(".sql") ||
          file.name.endsWith(".ipynb") ||
          file.name.endsWith(".rmd") ||
          file.name.endsWith(".dockerfile") ||
          file.name.endsWith(".proto") ||
          file.name.endsWith(".cfg") ||
          file.name.endsWith(".bat")
      );
      // Validate file types
      if (
        textFiles.length +
          csvFiles.length +
          pdfFiles.length +
          mdFiles.length +
          codeFiles.length !==
        e.target.files.length
      ) {
        notifyError(
          "All files must be text, CSV, PDF, Markdown, or code files"
        );
        return;
      }

      const filesWithText = [];

      // Process code files
      for (const file of codeFiles) {
        const content = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          content,
          fileType: "code",
        });
      }

      // Process text files
      for (const file of textFiles) {
        const content = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          content,
          fileType: "text",
        });
      }

      // Process CSV files
      for (const file of csvFiles) {
        const text = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          content: formatCSVText(text),
          fileType: "csv",
        });
      }

      // Process Markdown files
      for (const file of mdFiles) {
        const content = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          content,
          fileType: "markdown",
        });
      }

      // Process PDF files
      for (const file of pdfFiles) {
        filesWithText.push({
          name: file.name,
          size: file.size,
          file: file,
          fileType: "pdf",
          processed: false,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...filesWithText]);
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  // Handle image file uploads
  const handleFilesChangeImage = async (e) => {
    try {
      // Filter for supported image and video types
      const files = Array.from(e.target.files).filter(
        (file) =>
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/gif" ||
          file.type === "image/webp" ||
          file.type === "video/mp4" ||
          file.type === "video/avi" ||
          file.type === "video/msvideo"
      );

      // Validate file types
      if (files.length !== e.target.files.length) {
        notifyError("All files must be images, MP4 videos, or AVI videos");
        return;
      }

      // Process files
      const validFiles = [];
      for (const file of files) {
        // Check file size
        if (file.size > 50 * 1024 * 1024) {
          // 50MB
          notifyError(`File too large: ${file.name}`);
        } else {
          validFiles.push(file);
        }
      }

      // If there are no valid files left after size check, notify and return
      if (validFiles.length === 0) {
        // notifyError("No valid files to attach");
        return;
      }

      // If there are valid files, notify success
      notifySuccess("File attached");

      // Process valid files
      const fileList = [];
      for (const file of validFiles) {
        const text = await readFileAsBase64(file);
        fileList.push({
          name: file.name,
          type: file.type.startsWith("image/") ? "image" : "video",
          size: file.size,
          text,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...fileList]);
      e.target.value = "";
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  // Trigger file input click
  const handleClick = () => {
    hiddenFileInput.current.value = null;
    hiddenFileInput.current.click();
  };

  useEffect(() => {
    updateLocalState({ prompt: transcript });
  }, [transcript]);

  return (
    <div className="mobile:w-full flex flex-shrink-0 flex-col w-[calc(100%-12px)] bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-between sm:overflow-y-auto  rounded-2xl shadow-bottom dark:shadow-darkBottom">
      {selectedFiles.length > 0 ? (
        <div className="w-full">
          {selectedFiles.length > 0 && (
            <div className="select-none p-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-medium text-tertiary">
                  <Trans i18nKey="description.file1" />
                </p>
                <p
                  className="text-red-400 hover:text-red-300 cursor-pointer text-xs font-medium"
                  onClick={() => setSelectedFiles([])}
                >
                  <Trans i18nKey="description.file2" />
                </p>
              </div>

              <div className="flex flex-nowrap gap-2 overflow-x-auto w-full pb-2 hide-scrollbar">
                {Array.from(selectedFiles).map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="cursor-pointer flex-shrink-0 w-[220px] bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-850 rounded-lg transition-colors duration-150 overflow-hidden"
                    onClick={() => setPreviewFile(file)}
                  >
                    <div className="p-2 w-full">
                      <div className="flex items-center gap-2 w-full">
                        <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded overflow-hidden bg-gray-200 dark:bg-gray-800">
                          {file.type === "image" ? (
                            <img
                              className="h-full w-full object-cover"
                              src={file.text}
                              alt={file.name}
                            />
                          ) : file.type === "video" ? (
                            <img
                              className="h-5 w-5"
                              src={video_icon}
                              alt="video"
                            />
                          ) : (
                            <img
                              className="h-5 w-5"
                              src={uploaded}
                              alt="uploaded"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-grow pr-8 relative">
                          <p
                            className="overflow-hidden whitespace-nowrap text-ellipsis font-medium text-xs"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {formatFileSize(file.size)}
                          </p>

                          <button
                            className="absolute right-0 top-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full flex-shrink-0 focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            aria-label="Remove file"
                          >
                            <img
                              src={cross}
                              alt="remove"
                              className="h-[14px] w-[14px]"
                            />
                          </button>
                        </div>
                      </div>

                      {file.fileType === "pdf" && (
                        <div className="flex items-center mt-2 w-full">
                          {file.processed ? (
                            <span className="text-green-500 text-xs font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900 bg-opacity-30 rounded-full w-full text-center">
                              Processed
                            </span>
                          ) : processingFiles.has(index) ? (
                            <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 text-xs w-full">
                              <svg
                                className="animate-spin h-3 w-3"
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
                              className="px-2 py-0.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 text-xs transition-colors w-full"
                            >
                              Process
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 w-full">
        <div
          className={`relative select-none ${
            selectedFiles.length > 0 ? "border dark:border-border_dark" : ""
          } rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark`}
        >
          {" "}
          {isImageSupported || isVideoSupported ? (
            <div
              className="drag-drop-container"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <textarea
                autoFocus
                ref={textareaRef}
                className="p-5 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
                value={localState.prompt}
                name="prompt"
                placeholder={t("description.placeholder")}
                style={{
                  minHeight: `${MIN_HEIGHT}px`,
                  maxHeight: `${MAX_HEIGHT}px`,
                }}
                onChange={handleChange}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    localState.prompt?.trim() !== ""
                  ) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                onPaste={
                  isImageSupported || isVideoSupported ? handlePaste : null
                }
              />
            </div>
          ) : (
            <textarea
              autoFocus
              ref={textareaRef}
              className="p-5 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
              value={localState.prompt}
              name="prompt"
              placeholder={t("description.placeholder")}
              style={{
                minHeight: `${MIN_HEIGHT}px`,
                maxHeight: `${MAX_HEIGHT}px`,
              }}
              onChange={(event) => {
                handleChange(event);
                adjustHeight();
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  localState.prompt?.trim() !== ""
                ) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
            />
          )}
          <div className="px-3 py-2 w-full h-fit flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl relative">
            {localState.prompt?.trim() !== "" ? (
              <Tooltip text={t("description.clear")}>
                <button
                  className="h-[30px] w-[30px] cursor-pointer"
                  onClick={() => {
                    updateLocalState({ prompt: "" });
                    resetTranscript();
                  }}
                  disabled={loading || loadingResend}
                >
                  <img
                    className="cursor-pointer h-[25px] w-[25px]"
                    src={clear}
                    alt="clear"
                  />
                </button>
              </Tooltip>
            ) : null}

            <div className="flex gap-4 w-full justify-end items-center">
              {!showAdvOpt ? (
                <Tooltip text={t("description.settings_toggle")}>
                  <button
                    className="flex h-[30px] w-[30px] cursor-pointer"
                    onClick={toggleAdvOpt}
                  >
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={settings_icon}
                      alt="settings"
                    />
                  </button>
                </Tooltip>
              ) : null}
              <input
                type="file"
                ref={hiddenFileInput}
                multiple
                accept=".txt, .csv, .pdf, .md, .py, .js, .java, .cpp, .c, .h, .cs, .rb, .php, .go, .rs, .swift, .kt, .ts, .jsx, .tsx, .html, .json, .tex, .xml, .yaml, .yml, .ini, .toml, .properties, .css, .scss, .sass, .less, .sh, .ps1, .pl, .lua, .r, .m, .mat, .asm, .sql, .ipynb, .rmd, .dockerfile, .proto, .cfg, .bat"
                onChange={handleFilesChange}
                className="hidden"
              />
              <Tooltip text={t("description.attachFile")}>
                <button
                  className="h-[30px] w-[30px] cursor-pointer"
                  onClick={handleClick}
                  disabled={loading || loadingResend}
                >
                  <img
                    className="cursor-pointer h-[30px] w-[30px]"
                    src={upload}
                    alt="upload"
                  />
                </button>
              </Tooltip>
              {(isImageSupported || isVideoSupported) && (
                <>
                  <input
                    type="file"
                    ref={hiddenFileInputImage}
                    multiple
                    accept={getAcceptedFileTypes(
                      isImageSupported,
                      isVideoSupported
                    )}
                    onChange={handleFilesChangeImage}
                    className="hidden"
                  />
                  <Tooltip text={t("description.attachImage")}>
                    <button
                      className="h-[30px] w-[30px] cursor-pointer"
                      onClick={() => hiddenFileInputImage.current?.click()}
                      disabled={loading || loadingResend}
                    >
                      <img
                        className="cursor-pointer h-[30px] w-[30px]"
                        src={image_icon}
                        alt="attach file"
                      />
                    </button>
                  </Tooltip>
                </>
              )}
              {loading || loadingResend ? (
                <Tooltip text={t("description.pause")}>
                  <button className="h-[30px] w-[30px] cursor-pointer">
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={pause}
                      alt="pause"
                      onClick={handleCancelRequest}
                    />
                  </button>
                </Tooltip>
              ) : listening ? (
                <Tooltip text={t("description.stop")}>
                  <button
                    className="h-[30px] w-[30px] cursor-pointer"
                    type="button"
                    onClick={() => {
                      SpeechRecognition.stopListening();
                    }}
                  >
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={stop}
                      alt="stop"
                    />
                  </button>
                </Tooltip>
              ) : localState.prompt !== "" ? (
                <Tooltip text={t("description.send")}>
                  <button className="h-[30px] w-[30px] cursor-pointer">
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={send}
                      alt="send"
                      onClick={(event) => {
                        handleSubmit(event);
                      }}
                      disabled={loading || loadingResend}
                    />
                  </button>
                </Tooltip>
              ) : (
                <Tooltip text={t("description.listen")}>
                  <button
                    className="h-[30px] w-[30px] cursor-pointer"
                    type="button"
                    onClick={() => {
                      navigator.permissions
                        .query({ name: "microphone" })
                        .then(function (result) {
                          if (
                            result.state === "prompt" ||
                            result.state === "denied"
                          ) {
                            setShowMicModal(true);
                          } else {
                            let speechRecognitionLanguage =
                              languageMap[i18n.language];
                            SpeechRecognition.startListening({
                              language: speechRecognitionLanguage,
                              continuous: true,
                            });
                          }
                        });
                    }}
                  >
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={mic}
                      alt="microphone"
                    />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prompt;
