/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";

//Assets
import clear from "../../assets/cross_icon.svg";
import settings_icon from "../../assets/Settings_Icon.svg";
import image_icon from "../../assets/icon_image.svg";
import send from "../../assets/icon_send.svg";
import upload from "../../assets/add.svg";
import mic from "../../assets/icon_mic.svg";
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
import { selectAllMemories } from "../../Redux/reducers/userMemorySlice";
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
  isAudioSupported,
  isImageSupported,
  isVideoSupported,
  isArcanaSupported,
  selectedFiles,
  localState,
  setLocalState,
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
  const dispatch = useDispatch();
  const memories = useSelector(selectAllMemories);
  const timeoutTime = useSelector((state) => state.timeout.timeoutTime);

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
    const audioFiles = selectedFiles.filter((file) => file.type === "audio");
    const imageFiles = selectedFiles.filter((file) => file.type === "image");
    const videoFiles = selectedFiles.filter((file) => file.type === "video");
    const textFiles = selectedFiles.filter(
      (file) =>
        file.type !== "image" && file.type !== "video" && file.type !== "audio"
    );

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
      audioFiles,
      imageFiles,
      videoFiles,
      textFiles,
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

    try {
      let newConversation;

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

  // Handle media file attachments
  const handleFilesChangeMedia = async (e) => {
    console.log("🔍 Starting file attachment process...");

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

      console.log("📁 Files selected:", e.target.files.length);

      // Filter for supported file types
      const files = Array.from(e.target.files).filter((file) => {
        console.log(
          `📄 Checking file: ${file.name}, type: ${file.type}, size: ${file.size}`
        );
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

      console.log("✅ All files are supported, processing...");

      // Process files and check size limits
      const validFiles = [];
      for (const file of files) {
        console.log(`🔄 Processing: ${file.name}`);

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
          console.log(`✅ File size OK: ${file.name}`);
          validFiles.push(file);
        }
      }

      // If no valid files, return early
      if (validFiles.length === 0) {
        console.log("❌ No valid files to process");
        return;
      }

      console.log(`📦 Processing ${validFiles.length} valid files...`);

      // Notify success
      notifySuccess("File(s) attached");

      // Process valid files
      const fileList = [];
      for (const file of validFiles) {
        console.log(`🔧 Converting file: ${file.name}, type: ${file.type}`);

        let processedFile;

        if (file.type.startsWith("audio/")) {
          console.log("🎵 Processing audio file...");

          try {
            // Audio processing - Convert to raw base64
            console.log("📊 Creating ArrayBuffer...");
            const arrayBuffer = await file.arrayBuffer();
            console.log(
              `✅ ArrayBuffer created: ${arrayBuffer.byteLength} bytes`
            );

            // Convert to base64 in chunks to avoid memory issues
            const uint8Array = new Uint8Array(arrayBuffer);
            console.log(`📄 Uint8Array created: ${uint8Array.length} elements`);

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

            console.log(
              `✅ Base64 conversion completed: ${base64Data.length} characters`
            );

            // Determine format for OpenAI
            const format = file.type.includes("wav") ? "wav" : "mp3";
            console.log(`🎼 Audio format detected: ${format}`);

            processedFile = {
              name: file.name,
              type: "audio",
              size: file.size,
              text: base64Data, // Raw base64 without data URL prefix
              format: format, // Store format for OpenAI
            };

            console.log("✅ Audio file processed successfully");
          } catch (audioError) {
            console.error("❌ Error processing audio file:", audioError);
            notifyError(
              `Error processing audio file: ${file.name} - ${audioError.message}`
            );
            continue; // Skip this file and continue with others
          }
        } else {
          console.log("🖼️ Processing media file (image/video)...");

          try {
            // Media processing (images/videos) - Use existing readFileAsBase64 function
            const text = await readFileAsBase64(file);
            console.log(`✅ Media file converted: ${text.substring(0, 50)}...`);

            processedFile = {
              name: file.name,
              type: file.type.startsWith("image/") ? "image" : "video",
              size: file.size,
              text,
            };

            console.log("✅ Media file processed successfully");
          } catch (mediaError) {
            console.error("❌ Error processing media file:", mediaError);
            notifyError(
              `Error processing media file: ${file.name} - ${mediaError.message}`
            );
            continue;
          }
        }

        console.log(`📋 Final processed file:`, {
          name: processedFile.name,
          type: processedFile.type,
          size: processedFile.size,
          textLength: processedFile.text?.length || 0,
          format: processedFile.format || "N/A",
        });

        fileList.push(processedFile);
      }

      console.log(
        `🎉 All files processed successfully: ${fileList.length} files`
      );
      console.log(
        "📊 Final file list:",
        fileList.map((f) => ({ name: f.name, type: f.type, size: f.size }))
      );

      // Update state with new files
      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles, ...fileList];
        console.log(`💾 Updating state with ${newFiles.length} total files`);
        return newFiles;
      });

      e.target.value = "";
      console.log("✅ File attachment process completed successfully");
    } catch (error) {
      console.error("💥 Fatal error in file attachment:", error);
      console.error("📍 Error stack:", error.stack);
      notifyError(`An error occurred: ${error.message}`);
    }
  };


  const handleAudioClick = () => {
    if (loading || loadingResend) return;

    if (isRecording) {
      // Stop recording
      handleAudioRecording();
    } else {
      // Start recording
      handleAudioRecording();
    }
  };

  const handleAudioRecording = async () => {
    if (isRecording) {
      // Stop recording
      console.log("🛑 Stopping audio recording...");
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      console.log("🎙️ Starting audio recording...");
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

        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100, // High quality sample rate
          },
        });

        streamRef.current = stream;
        audioChunksRef.current = [];

        // Use MP3-compatible format for better OpenAI compatibility
        let mimeType = "audio/webm"; // Default fallback
        let fileExtension = "webm";

        // Try to use the best supported format
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
          fileExtension = "webm";
        } else if (
          MediaRecorder.isTypeSupported("audio/mp4;codecs=mp4a.40.2")
        ) {
          mimeType = "audio/mp4;codecs=mp4a.40.2";
          fileExtension = "m4a";
        } else if (MediaRecorder.isTypeSupported("audio/mpeg")) {
          mimeType = "audio/mpeg";
          fileExtension = "mp3";
        }

        console.log(`🎵 Using audio format: ${mimeType}`);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128000, // Higher quality for better results
        });

        mediaRecorderRef.current = mediaRecorder;

        // Handle data available event
        mediaRecorder.ondataavailable = (event) => {
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Handle stop event
        mediaRecorder.onstop = async () => {
          console.log("🔄 Processing recorded audio...");
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mimeType,
          });

          console.log(
            `📊 Final audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`
          );
          await processRecordedAudio(audioBlob, mimeType, fileExtension);

          // Clean up
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms for smoother recording
        setIsRecording(true);
        console.log("✅ Recording started successfully");
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

  // Updated process recorded audio function
  const processRecordedAudio = async (audioBlob, mimeType, fileExtension) => {
    try {
      console.log("🔧 Processing recorded audio...");

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `recording_${timestamp}.${fileExtension}`;

      console.log(`📝 Creating file: ${fileName}`);

      // Check file size (25MB limit for OpenAI)
      if (audioBlob.size > 25 * 1024 * 1024) {
        console.error(`❌ File too large: ${audioBlob.size} bytes`);
        notifyError(
          `Audio file too large: ${fileName}. OpenAI supports max 25MB.`
        );
        return;
      }

      console.log(`✅ File size OK: ${audioBlob.size} bytes`);

      // Convert to base64 using FileReader (more reliable than manual conversion)
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Remove the data URL prefix to get raw base64
          const result = reader.result.split(",")[1];
          console.log(
            `📄 Base64 conversion completed: ${result.length} characters`
          );
          resolve(result);
        };
        reader.onerror = (error) => {
          console.error("❌ FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(audioBlob);
      });

      // Determine the format for OpenAI API
      let openAIFormat = "mp3"; // Default to mp3 as it's most compatible

      if (mimeType.includes("webm")) {
        openAIFormat = "webm";
      } else if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
        openAIFormat = "m4a";
      } else if (mimeType.includes("wav")) {
        openAIFormat = "wav";
      } else if (mimeType.includes("mpeg")) {
        openAIFormat = "mp3";
      }

      console.log(`🎼 OpenAI format: ${openAIFormat}`);

      // Create file object with proper format for your system
      const fileObject = {
        name: fileName,
        type: "audio",
        size: audioBlob.size,
        text: base64Data, // Raw base64 without data URL prefix
        format: openAIFormat, // Format for OpenAI API
      };

      console.log("📋 Final file object:", {
        name: fileObject.name,
        type: fileObject.type,
        size: fileObject.size,
        format: fileObject.format,
        textLength: fileObject.text.length,
      });

      setSelectedFiles((prevFiles) => {
        const newFiles = [...prevFiles, fileObject];
        console.log(`💾 Added recorded audio. Total files: ${newFiles.length}`);
        return newFiles;
      });

      notifySuccess("Audio recorded successfully");
      console.log("🎉 Audio recording process completed successfully");
    } catch (error) {
      console.error("💥 Error processing audio file:", error);
      console.error("📍 Error stack:", error.stack);
      notifyError(`Error processing recorded audio: ${error.message}`);
    }
  };

  // Trigger file input click
  const handleClick = () => {
    hiddenFileInput.current.value = null;
    hiddenFileInput.current.click();
  };

  useEffect(() => {
    console.log("Selected files changed:", selectedFiles);
  }, [selectedFiles]);

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
                            src={mic}
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
                            src={video_icon}
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
                            src={uploaded}
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
                      className={`cursor-pointer flex-shrink-0 w-[220px] ${displayInfo.bgColor} ${displayInfo.hoverColor} ${displayInfo.borderColor} border rounded-lg transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md`}
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
                          };
                        }

                        setPreviewFile(previewFile);
                      }}
                    >
                      <div className="p-3 w-full">
                        <div className="flex items-start gap-3 w-full">
                          {/* Icon/Thumbnail */}
                          <div
                            className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded ${displayInfo.iconBg} overflow-hidden`}
                          >
                            {displayInfo.icon}
                          </div>

                          {/* File Info */}
                          <div className="min-w-0 flex-grow pr-6 relative">
                            <p
                              className="font-medium text-sm text-gray-900 dark:text-white leading-tight mb-1"
                              title={file.name}
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                wordBreak: "break-word",
                              }}
                            >
                              {file.name}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
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

                            {/* Remove button */}
                            <button
                              className="absolute -top-1 -right-2 p-1.5 hover:bg-white/80 dark:hover:bg-black/60 rounded-full flex-shrink-0 focus:outline-none transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(index);
                              }}
                              aria-label="Remove file"
                            >
                              <img
                                src={cross}
                                alt="remove"
                                className="h-3 w-3 opacity-60 hover:opacity-100 transition-opacity"
                              />
                            </button>
                          </div>
                        </div>

                        {/* PDF Processing Status */}
                        {file.fileType === "pdf" && (
                          <div className="flex items-center mt-3 w-full">
                            {file.processed ? (
                              <span className="text-green-600 dark:text-green-400 text-xs font-medium px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full w-full text-center">
                                ✓ Processed
                              </span>
                            ) : processingFiles.has(index) ? (
                              <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 text-xs w-full py-1">
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
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-medium transition-colors w-full"
                              >
                                Process PDF
                              </button>
                            )}
                          </div>
                        )}

                        {/* Audio file duration/format info */}
                        {file.type === "audio" && (
                          <div className="mt-2 text-center">
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              Audio File Ready
                            </span>
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
              {isAudioSupported && (
                <>
                  <Tooltip
                    text={isRecording ? "Stop Recording" : "Start Recording"}
                  >
                    <button
                      className={`h-[30px] w-[30px] cursor-pointer transition-all duration-200 flex items-center justify-center rounded-full ${
                        isRecording
                          ? "bg-red-500 border-2 border-red-600 animate-pulse"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                      }`}
                      type="button"
                      onClick={handleAudioClick}
                      title={
                        isRecording
                          ? "Click to stop recording"
                          : "Click to start recording"
                      }
                      disabled={loading || loadingResend}
                    >
                      {isRecording ? (
                        // Stop icon when recording
                        <div className="w-3 h-3 bg-white rounded-sm"></div>
                      ) : (
                        // Microphone icon when not recording
                        <img
                          className="h-[18px] w-[18px]"
                          src={mic}
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
                      src={pause}
                      alt="pause"
                      onClick={handleCancelRequest}
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
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Prompt;
