/* eslint-disable no-unused-vars */
import { useEffect, useRef } from "react";
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
import { cancelRequest, fetchLLMResponse } from "../../apis/LlmRequestApi";
import Tooltip from "../Others/Tooltip";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { setIsResponding } from "../../Redux/reducers/conversationsSlice";
import SettingsPanel from "./SettingsPanel";

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
  modelSettings,
  currentModel,
  onModelChange,
  showAdvOpt,
  setShareSettingsModal,
  handleShareSettings,
  setShowHelpModal,
  setShowArcanasHelpModal,
  setShowCustomHelpModal,
  setShowTopPHelpModal,
  setShowSystemHelpModal,
  isThoughtSupported,
  updateSettings,
}) {
  //Hooks
  const { t, i18n } = useTranslation();
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const dispatch = useDispatch();

  //Refs
  const hiddenFileInput = useRef(null);
  const hiddenFileInputImage = useRef(null);
  const textareaRef = useRef(null);

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
  async function getRes(updatedConversation) {
    dispatch(setIsResponding(true));
    setLoading(true);

    // Check if selected model supports image input
    const imageSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("image")
    );
    // Check if selected model supports video input
    const videoSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("video")
    );

    // Process conversation based on image/video support
    let processedConversation = updatedConversation;
    if (!imageSupport && !videoSupport) {
      // Remove image content if model doesn't support images/videos
      processedConversation = updatedConversation.map((message) => {
        if (message.role === "user" && Array.isArray(message.content)) {
          return {
            role: "user",
            content: message.content
              .filter((item) => item.type === "text")
              .map((item) => item.text)
              .join("\n"),
          };
        }
        return message;
      });
    }

    if (selectedFiles.length > 0) {
      const imageFiles = selectedFiles.filter((file) => file.type === "image");
      const videoFiles = selectedFiles.filter((file) => file.type === "video");
      const textFiles = selectedFiles.filter(
        (file) => file.type !== "image" && file.type !== "video"
      );

      const imageContent = imageFiles.map((imageFile) => ({
        type: "image_url",
        image_url: {
          url: imageFile.text,
        },
      }));

      const videoContent = videoFiles.map(() => ({
        type: "video_url",
        video_url: {
          url: "",
        },
      }));

      const textContent = textFiles.map((file) => ({
        name: file.name,
        fileType: "text",
        content:
          file.fileType === "pdf"
            ? `${file.name}: ${file.processedContent}`
            : `${file.name}: ${file.content}`,
        type: "text",
        size: file.size,
      }));

      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: prevState.prompt,
            images: imageContent,
            videos: videoContent,
            textFiles: textContent,
            response: "",
          },
        ],
      }));
    } else {
      // Add response entry without images
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: prevState.prompt,
            response: "",
          },
        ],
      }));
    }

    // Clear prompt after processing
    updateLocalState({ prompt: "" });

    try {
      // Fetch response from LLM service
      const response = await fetchLLMResponse(
        processedConversation,
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModalSession,
        setShowBadRequest,
        processedConversation,
        isArcanaSupported
      );
      dispatch(setIsResponding(false));
      setLoading(false);
      setSelectedFiles([]);
    } catch (error) {
      dispatch(setIsResponding(false));
      setLoading(false);
      setSelectedFiles([]);

      // Handle different error types
      if (error.name === "AbortError") {
        notifyError("Request aborted.");
      } else if (error.message) {
        notifyError(error.message);
      } else {
        notifyError("An unknown error occurred");
      }
    }
  }

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
          file.name.endsWith(".json")
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
  }, [transcript, updateLocalState]);

  return (
    <div className="mobile:w-full flex flex-shrink-0 flex-col w-[calc(100%-12px)] dark:text-white text-black mobile:h-fit justify-between sm:gap-3 rounded-2xl shadow-bottom dark:shadow-darkBottom bg-bg_light dark:bg-bg_dark">
      {/* Remove overflow-y-auto from parent container to prevent clipping */}
      <div className="flex flex-col gap-4 w-full">
        {/* Main textarea and buttons container */}
        <div className="relative select-none border dark:border-border_dark rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-visible">
          {/* Settings panel positioned absolutely with higher z-index */}
          {showAdvOpt && (
            <div
              className="absolute w-full z-[999]"
              style={{
                bottom: "50px",
                position: "absolute",
                overflow: "visible",
              }}
            >
              <SettingsPanel
                modelSettings={modelSettings}
                modelList={modelList}
                currentModel={currentModel}
                isImageSupported={isImageSupported}
                isVideoSupported={isVideoSupported}
                isThoughtSupported={isThoughtSupported}
                isArcanaSupported={isArcanaSupported}
                onModelChange={onModelChange}
                showAdvOpt={showAdvOpt}
                toggleAdvOpt={toggleAdvOpt}
                localState={localState}
                setLocalState={setLocalState}
                updateSettings={updateSettings}
                setShareSettingsModal={setShareSettingsModal}
                handleShareSettings={handleShareSettings}
                setShowHelpModal={setShowHelpModal}
                setShowArcanasHelpModal={setShowArcanasHelpModal}
                setShowCustomHelpModal={setShowCustomHelpModal}
                setShowTopPHelpModal={setShowTopPHelpModal}
                setShowSystemHelpModal={setShowSystemHelpModal}
                notifySuccess={notifySuccess}
                notifyError={notifyError}
                setShowModalSession={setShowModalSession}
              />
            </div>
          )}

          {/* Textarea with drag-drop support */}
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

          {/* Button toolbar */}
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

              <input
                type="file"
                ref={hiddenFileInput}
                multiple
                accept=".txt, .csv, .pdf, .md, .py, .js, .java, .cpp, .c, .h, .cs, .rb, .php, .go, .rs, .swift, .kt, .ts, .jsx, .tsx, .html, .json"
                onChange={handleFilesChange}
                className="hidden"
              />
              <Tooltip text={t("description.upload")}>
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

              {/* Other buttons (image upload, mic, send, etc.) */}
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
