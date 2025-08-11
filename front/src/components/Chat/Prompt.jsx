/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";

//Assets
import icon_cross_sm from "../../assets/icons/cross_sm.svg";
import icon_cross from "../../assets/icons/cross.svg";
import icon_settings from "../../assets/icons/settings.svg";
import icon_support_vision from "../../assets/icons/support_vision.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import icon_send from "../../assets/icons/send.svg";
import icon_attach from "../../assets/icons/attach.svg";
import icon_mic from "../../assets/icons/mic.svg";
import icon_stop from "../../assets/icons/stop.svg";
import icon_file_uploaded from "../../assets/icons/file_uploaded.svg";

import {
  cancelRequest,
} from "../../apis/chatCompletions";
import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { setIsResponding } from "../../Redux/reducers/conversationsSlice";

import { processFile } from "../../apis/processFile";
import { selectAllMemories } from "../../Redux/reducers/userMemorySlice";
import sendMessage from "../../utils/sendMessage";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

function Prompt({
  modelsData,
  currentModel,
  loading,
  loadingResend,
  selectedFiles,
  localState,
  setLocalState,
  setLoading,
  setSelectedFiles,
  toggleAdvOpt,
  adjustHeight,
  showAdvOpt,
}) {
  //Hooks
  const { openModal } = useModal();
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);
  const timeoutTime = useSelector((state) => state.timeout.timeoutTime);
  const { notifySuccess, notifyError } = useToast();

  //Refs
  const hiddenFileInput = useRef(null);
  const hiddenFileInputImage = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioFileInputRef = useRef(null);

  //Local useStates
  const [processingFiles, setProcessingFiles] = useState(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);
  const [isLongPress, setIsLongPress] = useState(false);

  // Update partial local state while preserving other values
  const updateLocalState = (updates) => {
    setLocalState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  // Converts a file to base64 string format using FileReader
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const isAudioSupported = (currentModel?.input?.includes("audio") || false)
  const isVideoSupported = (currentModel?.input?.includes("video") || false)
  const isImageSupported = (currentModel?.input?.includes("image") || false)

  // Main function to fetch and process LLM response
  const getRes = async (updatedConversation) => {
    const audioFiles = selectedFiles.filter((file) => file.type === "audio");
    const imageFiles = selectedFiles.filter((file) => file.type === "image");
    const videoFiles = selectedFiles.filter((file) => file.type === "video");
    const textFiles = selectedFiles.filter(
      (file) =>
        file.type !== "image" && file.type !== "video" && file.type !== "audio"
    );

    console.log(updatedConversation)

    await sendMessage({
      operationType: "new",
      openModal,
      updatedConversation,
      dispatch,
      localState,
      setLocalState,
      setLoading,
      selectedFiles,
      setSelectedFiles,
      modelsData,
      memories,
      timeoutTime,
      audioFiles,
      imageFiles,
      videoFiles,
      textFiles,
      notifyError,
      notifySuccess
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
      const result = await processFile(file.file);

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
    if (!isImageSupported && !isVideoSupported && !isAudioSupported) return;
    event.preventDefault();
    try {
      // Filter for supported file types (now includes audio)
      const droppedFiles = Array.from(event.dataTransfer.files).filter(
        (file) =>
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/gif" ||
          file.type === "image/webp" ||
          file.type === "video/mp4" ||
          file.type === "audio/mpeg" ||
          file.type === "audio/mp3" ||
          file.type === "audio/wav" ||
          file.type === "audio/wave" ||
          file.type === "audio/x-wav"
      );

      // Validate dropped files
      if (droppedFiles.length === 0) {
        notifyError("Only supported media files are allowed");
        return;
      } else {
        notifySuccess("Media dropped");
      }

      // Convert dropped files to base64 and update state
      const fileList = [];
      for (const file of droppedFiles) {
        let base64Data;
        let format;

        if (file.type.startsWith("audio/")) {
          // For audio files, convert to raw base64 (same as handleFilesChangeAudio)
          const arrayBuffer = await file.arrayBuffer();
          base64Data = btoa(
            String.fromCharCode(...new Uint8Array(arrayBuffer))
          );
          format = file.type.includes("wav") ? "wav" : "mp3";
        } else {
          // For images/videos, use data URL
          base64Data = await readFileAsBase64(file);
        }

        const fileObj = {
          name: file.name,
          type: file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("audio/")
            ? "audio"
            : "video",
          size: file.size,
          text: base64Data,
        };

        // Add format for audio files
        if (format) {
          fileObj.format = format;
        }

        fileList.push(fileObj);
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

  const getAcceptedFileTypes = (
    isImageSupported,
    isVideoSupported,
    isAudioSupported
  ) => {
    const types = [];

    if (isImageSupported) {
      types.push(".jpg", ".jpeg", ".png", ".gif", ".webp");
    }
    if (isVideoSupported) {
      types.push(".mp4", ".avi");
    }
    if (isAudioSupported) {
      types.push(".mp3", ".wav");
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

    if (localState.prompt?.trim() === "" && selectedFiles.length === 0) return;

    // Check for unprocessed PDF files
    const hasUnprocessedPDF = selectedFiles.some(
      (file) => file.fileType === "pdf" && !file.processed
    );

    if (hasUnprocessedPDF) {
      openModal("unprocessedFiles");
      return;
    }

    try {
      let newMessages;

      // Process submission with files
      if (selectedFiles.length > 0) {
        const textFiles = selectedFiles.filter(
          (file) =>
            file.type !== "image" &&
            file.type !== "video" &&
            file.type !== "audio"
        );
        const audioFiles = selectedFiles.filter(
          (file) => file.type === "audio"
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
            if (file.fileType === "pdf") {
              return `${file.name}: ${file.processedContent}`;
            }
            return `${file.name}: ${file.content}`;
          })
          .filter(Boolean)
          .join("\n");

        const fullPrompt = allTextFilesText
          ? `${localState.prompt}\n${allTextFilesText}`
          : localState.prompt;

        // Process audio files - CORRECT FORMAT for OpenAI
        const audioContent = audioFiles.map((audioFile) => {
          return {
            type: "input_audio",
            input_audio: {
              data: audioFile.text, // This should be raw base64 string
              format: audioFile.format, // "wav" or "mp3"
            },
          };
        });

        // Process image files
        const imageContent = imageFiles.map((imageFile) => ({
          type: "image_url",
          image_url: {
            url: imageFile.text, // This should be data URL for images
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
          ...audioContent,
          ...imageContent,
          ...videoContent,
        ];

        newMessages = [
          ...localState.messages,
          { role: "user", content: newPromptContent },
        ];
      } else {
        // Simple text-only submission
        newMessages = [
          ...localState.messages,
          { role: "user", content: localState.prompt },
        ];
      }

      // Update conversation state
      setLocalState((prevState) => ({
        ...prevState,
        messages: newMessages,
      }));

      await getRes(newMessages);
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

      // 🔥 UPDATED: Process PDF files - PRESERVE ORIGINAL FILE
      for (const file of pdfFiles) {
        filesWithText.push({
          name: file.name,
          size: file.size,
          file: file, // Keep the original File object for processing
          originalFile: file, // ADDED: Also store as originalFile for preview
          fileType: "pdf",
          processed: false,
          content: null, // Will be filled when processed
          processedContent: null, // Will be filled when processed
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...filesWithText]);
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  // Handle media file attachments
  const handleFilesChangeMedia = async (e) => {
    try {
      // All supported file types
      const supportedTypes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        // Videos
        "video/mp4",
        "video/avi",
        "video/msvideo",
        // Audio
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
      ];

      // Filter for supported file types
      const files = Array.from(e.target.files).filter((file) => {
        return supportedTypes.includes(file.type);
      });

      // Validate file types
      if (files.length !== e.target.files.length) {
        console.error("❌ Some files are not supported");
        notifyError(
          "Only images, videos, and audio files (MP3/WAV) are supported"
        );
        return;
      }

      // Process files and check size limits
      const validFiles = [];
      for (const file of files) {
        // Different size limits based on file type
        const isAudio = file.type.startsWith("audio/");
        const sizeLimit = isAudio ? 25 * 1024 * 1024 : 50 * 1024 * 1024; // 25MB for audio, 50MB for media
        const limitText = isAudio ? "25MB" : "50MB";

        if (file.size > sizeLimit) {
          console.error(
            `❌ File too large: ${file.name} (${file.size} bytes > ${sizeLimit} bytes)`
          );
          notifyError(
            `File too large: ${file.name}. Maximum size is ${limitText}.`
          );
        } else {
          validFiles.push(file);
        }
      }

      // If no valid files, return early
      if (validFiles.length === 0) {
        return;
      }

      // Notify success
      notifySuccess("File(s) attached");

      // Process valid files
      const fileList = [];
      for (const file of validFiles) {
        let processedFile;

        if (file.type.startsWith("audio/")) {
          try {
            // Audio processing - Convert to raw base64
            const arrayBuffer = await file.arrayBuffer();
            // Convert to base64 in chunks to avoid memory issues
            const uint8Array = new Uint8Array(arrayBuffer);

            // Convert to base64 using FileReader (more reliable)
            const base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                // Remove the data URL prefix to get raw base64
                const result = reader.result.split(",")[1];
                resolve(result);
              };
              reader.onerror = reject;
              reader.readAsDataURL(
                new Blob([arrayBuffer], { type: file.type })
              );
            });

            // Determine format for OpenAI
            const format = file.type.includes("wav") ? "wav" : "mp3";

            processedFile = {
              name: file.name,
              type: "audio",
              size: file.size,
              text: base64Data, // Raw base64 without data URL prefix
              format: format, // Store format for OpenAI
            };
          } catch (audioError) {
            console.error("❌ Error processing audio file:", audioError);
            notifyError(
              `Error processing audio file: ${file.name} - ${audioError.message}`
            );
            continue; // Skip this file and continue with others
          }
        } else {
          try {
            // Media processing (images/videos) - Use existing readFileAsBase64 function
            const text = await readFileAsBase64(file);

            processedFile = {
              name: file.name,
              type: file.type.startsWith("image/") ? "image" : "video",
              size: file.size,
              text,
            };
          } catch (mediaError) {
            notifyError(
              `Error processing media file: ${file.name} - ${mediaError.message}`
            );
            continue;
          }
        }

        fileList.push(processedFile);
      }

      // Update state with new files
      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles, ...fileList];
        return newFiles;
      });

      e.target.value = "";
    } catch (error) {
      notifyError(`An error occurred: ${error.message}`);
    }
  };

  // Track mouse down time to distinguish between click and hold
  const mouseDownTimeRef = useRef(null);
  const isHoldRecordingRef = useRef(false);

  const handleAudioClick = () => {
    if (loading || loadingResend) return;

    // Only handle click if it wasn't a hold action
    if (!isHoldRecordingRef.current) {
      if (isRecording) {
        // Stop recording
        handleAudioRecording();
      } else {
        // Start recording
        handleAudioRecording();
      }
    }

    // Reset hold recording flag
    isHoldRecordingRef.current = false;
  };

  const handleAudioMouseDown = () => {
    if (loading || loadingResend) return;

    // Record the time when mouse was pressed down
    mouseDownTimeRef.current = Date.now();

    // Start recording on mouse down (hold) after a short delay
    setTimeout(() => {
      // Only start if still holding and not already recording
      if (mouseDownTimeRef.current && !isRecording) {
        isHoldRecordingRef.current = true;
        handleAudioRecording();
      }
    }, 200); // 200ms delay to distinguish from click
  };

  const handleAudioMouseUp = () => {
    if (loading || loadingResend) return;

    const holdDuration = mouseDownTimeRef.current
      ? Date.now() - mouseDownTimeRef.current
      : 0;
    mouseDownTimeRef.current = null;

    // If it was a hold action (longer than 200ms) and currently recording, stop it
    if (holdDuration > 200 && isRecording && isHoldRecordingRef.current) {
      handleAudioRecording();
    }
  };

  const handleAudioRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        // Check if we're on localhost or https for microphone access
        const isSecureContext =
          window.isSecureContext ||
          location.protocol === "https:" ||
          location.hostname === "localhost";

        if (!isSecureContext) {
          notifyError(
            "Microphone access requires HTTPS or localhost. Please use https:// or access via localhost"
          );
          return;
        }

        // Request microphone permission with high quality settings
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000, // High quality for better conversion
            channelCount: 1, // Mono for smaller files
          },
        });

        streamRef.current = stream;
        audioChunksRef.current = [];

        // Force WAV format for better compatibility
        let mimeType = "audio/wav";
        let fileExtension = "wav";

        // Check what the browser supports and prefer WAV-compatible formats
        if (MediaRecorder.isTypeSupported("audio/wav")) {
          mimeType = "audio/wav";
          fileExtension = "wav";
        } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
          mimeType = "audio/webm;codecs=pcm";
          fileExtension = "webm"; // We'll convert this to WAV
        } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
          fileExtension = "webm"; // We'll convert this to WAV
        } else {
          // Fallback - we'll convert whatever we get
          mimeType = "audio/webm";
          fileExtension = "webm";
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128000, // Good quality for conversion
        });

        mediaRecorderRef.current = mediaRecorder;

        // Handle data available event
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Handle stop event
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mimeType,
          });

          // Convert to WAV format for better compatibility
          await processRecordedAudio(audioBlob, mimeType);

          // Clean up
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        setIsRecording(true);
      } catch (error) {
        console.error("❌ Error starting recording:", error);

        if (error.name === "NotAllowedError") {
          notifyError(
            "Microphone permission denied. Please allow microphone access and try again."
          );
        } else if (error.name === "NotFoundError") {
          notifyError(
            "No microphone found. Please connect a microphone and try again."
          );
        } else if (error.name === "NotSupportedError") {
          notifyError(
            "Microphone access not supported. Please use HTTPS or localhost."
          );
        } else {
          notifyError(
            "Failed to start recording. Please check your microphone and permissions."
          );
        }

        setIsRecording(false);
      }
    }
  };

  // Convert recorded audio to WAV format for better compatibility
  const processRecordedAudio = async (audioBlob, originalMimeType) => {
    try {
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `recording_${timestamp}.wav`;

      // Check file size (25MB limit - adjust as needed for your use case)
      if (audioBlob.size > 25 * 1024 * 1024) {
        console.error(`❌ File too large: ${audioBlob.size} bytes`);
        notifyError(
          `Audio file too large: ${fileName}. Maximum supported size is 25MB.`
        );
        return;
      }

      let wavBlob;

      // If it's already WAV, use it directly
      if (originalMimeType.includes("wav")) {
        wavBlob = audioBlob;
      } else {
        // Convert WebM/other formats to WAV
        wavBlob = await convertToWav(audioBlob);
      }

      // Convert WAV blob to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Remove the data URL prefix to get raw base64
          const result = reader.result.split(",")[1];

          resolve(result);
        };
        reader.onerror = (error) => {
          console.error("❌ FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(wavBlob);
      });

      // Create file object in the format expected by your system
      const fileObject = {
        name: fileName,
        type: "audio",
        size: wavBlob.size,
        text: base64Data, // Raw base64 without data URL prefix
        format: "wav", // Always WAV for better compatibility
      };

      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles, fileObject];

        return newFiles;
      });

      notifySuccess("Audio recorded and converted to WAV successfully");
    } catch (error) {
      notifyError(`Error processing recorded audio: ${error.message}`);
    }
  };

  // Convert audio blob to WAV format using Web Audio API
  const convertToWav = async (audioBlob) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000, // Common sample rate for better compatibility
      });

      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert to WAV
      const wavArrayBuffer = audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });

      // Close audio context to free resources
      audioContext.close();

      return wavBlob;
    } catch (error) {
      console.error("Error converting to WAV:", error);
      throw error; // Re-throw the error so it can be caught by the caller
    }
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (audioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const result = new ArrayBuffer(44 + audioBuffer.length * numChannels * 2);
    const view = new DataView(result);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    let offset = 0;
    writeString(offset, "RIFF");
    offset += 4;
    view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true);
    offset += 4;
    writeString(offset, "WAVE");
    offset += 4;
    writeString(offset, "fmt ");
    offset += 4;
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, format, true);
    offset += 2;
    view.setUint16(offset, numChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, (sampleRate * numChannels * bitDepth) / 8, true);
    offset += 4;
    view.setUint16(offset, (numChannels * bitDepth) / 8, true);
    offset += 2;
    view.setUint16(offset, bitDepth, true);
    offset += 2;
    writeString(offset, "data");
    offset += 4;
    view.setUint32(offset, audioBuffer.length * numChannels * 2, true);
    offset += 4;

    // Convert float audio data to 16-bit PCM
    const channels = [];
    for (let channel = 0; channel < numChannels; channel++) {
      channels.push(audioBuffer.getChannelData(channel));
    }

    let sampleIndex = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return result;
  };

  // Trigger file input click
  const handleClick = () => {
    hiddenFileInput.current.value = null;
    hiddenFileInput.current.click();
  };

  return (
    <div className="w-full flex flex-shrink-0 flex-col bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-between sm:overflow-y-auto  rounded-2xl shadow-bottom dark:shadow-darkBottom">
      {selectedFiles.length > 0 ? (
        <div className="w-full">
          {selectedFiles.length > 0 && (
            <div className="select-none p-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-tertiary">
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
                {Array.from(selectedFiles).map((file, index) => {
                  // Determine file type and styling
                  const getFileDisplayInfo = (file) => {
                    if (file.type === "audio") {
                      return {
                        bgColor:
                          "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
                        borderColor: "border-blue-200 dark:border-blue-700/50",
                        hoverColor:
                          "hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/30 dark:hover:to-blue-700/30",
                        iconBg: "bg-blue-500 dark:bg-blue-600",
                        icon: (
                          <img
                            className="h-4 w-4 brightness-0 invert"
                            src={icon_mic}
                            alt={file.name}
                          />
                        ),
                        badge: file.format?.toUpperCase() || "AUDIO",
                      };
                    } else if (file.type === "image") {
                      return {
                        bgColor:
                          "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20",
                        borderColor:
                          "border-green-200 dark:border-green-700/50",
                        hoverColor:
                          "hover:from-green-100 hover:to-green-200 dark:hover:from-green-800/30 dark:hover:to-green-700/30",
                        iconBg: "bg-green-500 dark:bg-green-600",
                        icon: (
                          <img
                            className="h-full w-full object-cover rounded"
                            src={file.text}
                            alt={file.name}
                          />
                        ),
                        badge: "IMAGE",
                      };
                    } else if (file.type === "video") {
                      return {
                        bgColor:
                          "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
                        borderColor:
                          "border-purple-200 dark:border-purple-700/50",
                        hoverColor:
                          "hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-800/30 dark:hover:to-purple-700/30",
                        iconBg: "bg-purple-500 dark:bg-purple-600",
                        icon: (
                          <img
                            className="h-4 w-4 brightness-0 invert"
                            src={icon_support_video}
                            alt="video"
                          />
                        ),
                        badge: "VIDEO",
                      };
                    } else {
                      // Text/Document files
                      const getDocumentBadge = (file) => {
                        if (file.fileType === "pdf") return "PDF";
                        if (file.fileType === "csv") return "CSV";
                        if (file.fileType === "markdown") return "MD";
                        if (file.fileType === "code") return "CODE";
                        return "DOC";
                      };

                      return {
                        bgColor:
                          "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50",
                        borderColor: "border-gray-200 dark:border-gray-600/50",
                        hoverColor:
                          "hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700/60 dark:hover:to-gray-600/60",
                        iconBg: "bg-gray-500 dark:bg-gray-600",
                        icon: (
                          <img
                            className="h-4 w-4 brightness-0 invert"
                            src={icon_file_uploaded}
                            alt="uploaded"
                          />
                        ),
                        badge: getDocumentBadge(file),
                      };
                    }
                  };

                  const displayInfo = getFileDisplayInfo(file);

                  return (
                    <div
                      key={`${file.name}-${index}`}
                      className={`cursor-pointer flex-shrink-0 w-[200px] h-[80px] ${displayInfo.bgColor} ${displayInfo.hoverColor} ${displayInfo.borderColor} border rounded-lg transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md`}
                      onClick={() => {
                        // Updated preview preparation logic
                        let previewFile;

                        if (file.type === "audio") {
                          // For audio files, ensure we pass the correct format for PreviewModal
                          previewFile = {
                            name: file.name,
                            type: "audio",
                            text: file.text, // Use 'text' field which contains base64 data
                            format: file.format,
                            size: file.size,
                          };
                        } else if (file.type === "image") {
                          // For images, pass as simple string or keep object format
                          previewFile = file.text || file;
                        } else if (file.type === "video") {
                          // For videos, pass the data URL
                          previewFile = file.text || file;
                        } else {
                          // For text/document files, preserve original structure
                          previewFile = {
                            content: file.content || file.text,
                            name: file.name,
                            fileType: file.fileType,
                            processed: file.processed,
                            processedContent: file.processedContent,
                            originalFile: file.originalFile,
                            file: file.file,
                            data: file.data, // ADDED: Include any base64 data if available
                            text: file.text, // ADDED: Include any text data if available
                            type: file.type || "document", // ADDED: Ensure type is set
                          };
                        }

                        openModal("preview", {file: previewFile} );
                      }}
                    >
                      <div className="p-2 w-full h-full flex flex-col relative">
                        <div className="flex items-center gap-2 flex-1 min-h-0">
                          {/* Icon/Thumbnail */}
                          <div
                            className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded ${displayInfo.iconBg} overflow-hidden`}
                          >
                            {displayInfo.icon}
                          </div>

                          {/* File Info */}
                          <div className="min-w-0 flex-grow pr-6">
                            <p
                              className="font-medium text-xs text-gray-900 dark:text-white leading-tight mb-1 truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                                  file.type === "audio"
                                    ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                                    : file.type === "image"
                                    ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                    : file.type === "video"
                                    ? "bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                }`}
                              >
                                {displayInfo.badge}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Remove button - positioned at card corner */}
                        <button
                          className="absolute top-1 right-1 p-1 hover:bg-white/90 dark:hover:bg-black/70 rounded-full flex-shrink-0 focus:outline-none transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          aria-label="Remove file"
                        >
                          <img
                            src={icon_cross}
                            alt="remove"
                            className="h-4 w-4 opacity-70 hover:opacity-100 transition-opacity"
                          />
                        </button>

                        {/* PDF Processing Status */}
                        {file.fileType === "pdf" && (
                          <div className="flex items-center mt-1 w-full">
                            {file.processed ? (
                              <span className="text-green-600 dark:text-green-400 text-xs font-medium px-2 py-0.5 bg-green-100 dark:bg-green-900/30 rounded-full w-full text-center">
                                ✓ Processed
                              </span>
                            ) : processingFiles.has(index) ? (
                              <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 text-xs w-full py-0.5">
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
                                className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-medium transition-colors w-full"
                              >
                                Process PDF
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
          {isImageSupported || isVideoSupported || isAudioSupported ? (
            <div
              className="drag-drop-container"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <textarea
                autoFocus
                ref={textareaRef}
                className="p-5 outline-none text-base rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
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
                    (localState.prompt?.trim() !== "" ||
                      selectedFiles.length > 0)
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
              className="p-5 outline-none text-base rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark overflow-y-auto"
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
                  (localState.prompt?.trim() !== "" || selectedFiles.length > 0)
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
                  }}
                  disabled={loading || loadingResend}
                >
                  <img
                    className="cursor-pointer h-[25px] w-[25px]"
                    src={icon_cross_sm}
                    alt="clear"
                  />
                </button>
              </Tooltip>
            ) : null}

            <div className="flex gap-4 w-full justify-end items-center">
              {!showAdvOpt ? (
                <Tooltip text={t("description.settings_toggle")}>
                  <button
                    className="flex h-[25px] w-[25px] cursor-pointer"
                    onClick={toggleAdvOpt}
                  >
                    <img
                      className="cursor-pointer h-[25px] w-[25px]"
                      src={icon_settings}
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
                  className="h-[25px] w-[25px] cursor-pointer"
                  onClick={handleClick}
                  disabled={loading || loadingResend}
                >
                  <img
                    className="cursor-pointer h-[25px] w-[25px]"
                    src={icon_attach}
                    alt="upload"
                  />
                </button>
              </Tooltip>
              {(isImageSupported || isVideoSupported || isAudioSupported) && (
                <>
                  <input
                    type="file"
                    ref={hiddenFileInputImage}
                    multiple
                    accept={getAcceptedFileTypes(
                      isImageSupported,
                      isVideoSupported,
                      isAudioSupported
                    )}
                    onChange={handleFilesChangeMedia}
                    className="hidden"
                  />
                  <Tooltip text={t("description.attachImage")}>
                    <button
                      className="h-[25px] w-[25px] cursor-pointer"
                      onClick={() => hiddenFileInputImage.current?.click()}
                      disabled={loading || loadingResend}
                    >
                      <img
                        className="cursor-pointer h-[25px] w-[25px]"
                        src={icon_support_vision}
                        alt="attach file"
                      />
                    </button>
                  </Tooltip>
                </>
              )}
              {isAudioSupported && (
                <>
                  <Tooltip
                    text={
                      isRecording
                        ? t("description.stopRecording")
                        : t("description.startRecording")
                    }
                  >
                    <button
                      className={`h-[30px] w-[30px] cursor-pointer transition-all duration-200 flex items-center justify-center rounded-full ${
                        isRecording
                          ? "bg-red-500 border-2 border-red-600 animate-pulse"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                      }`}
                      type="button"
                      onClick={handleAudioClick}
                      onMouseDown={handleAudioMouseDown}
                      onMouseUp={handleAudioMouseUp}
                      onMouseLeave={handleAudioMouseUp} // Stop recording if mouse leaves while holding
                      onTouchStart={handleAudioMouseDown} // Mobile support
                      onTouchEnd={handleAudioMouseUp} // Mobile support
                      disabled={loading || loadingResend}
                    >
                      {isRecording ? (
                        // Stop icon when recording
                        <div className="w-3 h-3 bg-white rounded-sm"></div>
                      ) : (
                        // Microphone icon when not recording
                        <img
                          className="h-[18px] w-[18px]"
                          src={icon_mic}
                          alt="microphone"
                        />
                      )}
                    </button>
                  </Tooltip>
                </>
              )}
              {loading || loadingResend ? (
                <Tooltip text={t("description.pause")}>
                  <button className="h-[30px] w-[30px] cursor-pointer">
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={icon_stop}
                      alt="pause"
                      onClick={handleCancelRequest}
                    />
                  </button>
                </Tooltip>
              ) : localState.prompt !== "" || selectedFiles.length > 0 ? (
                <Tooltip text={t("description.send")}>
                  <button className="h-[30px] w-[30px] cursor-pointer">
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={icon_send}
                      alt="send"
                      onClick={(event) => {
                        handleSubmit(event);
                      }}
                      disabled={loading || loadingResend}
                    />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prompt;
