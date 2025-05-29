/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useRef, useState } from "react";
import Tooltip from "../Others/Tooltip";
import { fetchLLMResponse } from "../../apis/LlmRequestApi";

//Assets
import retry from "../../assets/icon_retry.svg";
import clear from "../../assets/cross_icon.svg";
import export_icon from "../../assets/export_icon.svg";
import import_icon from "../../assets/import_icon.svg";
import video_icon from "../../assets/video_icon.svg";
import send from "../../assets/icon_send.svg";
import edit_icon from "../../assets/edit_icon.svg";
import icon_resend from "../../assets/icon_resend.svg";
import ResponseItem from "../Markdown/ResponseItem";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  setIsResponding,
  updateConversation,
} from "../../Redux/reducers/conversationsSlice";
import PreviewImageModal from "../../modals/PreviewImageModal";
import { useParams } from "react-router-dom";

//Variable
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

function Responses({
  modelList,
  localState,
  setLocalState,
  loading,
  setShowModalSession,
  setShowBadRequest,
  setSelectedFiles,
  setShowHistoryModal,
  setShowFileModal,
  updateLocalState,
  adjustHeight,
  notifySuccess,
  notifyError,
  clearHistory,
  updateSettings,
  loadingResend,
  setLoadingResend,
  isArcanaSupported,
}) {
  // Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();

  // Redux state
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const { conversationId } = useParams();

  // Local useState
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [editingResponseIndex, setEditingResponseIndex] = useState(-1);
  const [editedResponse, setEditedResponse] = useState("");
  const [previewFile, setPreviewFile] = useState(null);

  //Refs
  const containerRefs = useRef([]);
  const textareaRefs = useRef([]);
  const hiddenFileInputJSON = useRef(null);
  const containerRef = useRef(null);
  const scrollTimeout = useRef(null);
  const lastResponseLength = useRef(0);

  //Functions
  const handleResponseEdit = (index, response) => {
    setEditingIndex(-1);
    setEditedResponse(response);
    setEditingResponseIndex(index);
  };
  const handleResponseSave = (index) => {
    // Find assistant response index in conversation array
    const assistantIndex = localState.conversation.findIndex(
      (msg) =>
        msg.role === "assistant" &&
        msg.content === localState.responses[index].response
    );

    // Update both responses and conversation
    const newResponses = localState.responses.map((res, i) => {
      if (i === index) {
        return { ...res, response: editedResponse };
      }
      return res;
    });

    const newConversation = localState.conversation.map((msg, i) => {
      if (i === assistantIndex) {
        return { ...msg, content: editedResponse };
      }
      return msg;
    });

    setLocalState({
      ...localState,
      responses: newResponses,
      conversation: newConversation,
    });

    setEditingResponseIndex(-1);
    setEditedResponse("");
  };
  const scrollToBottom = useCallback((forceSmooth = false) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

    // If distance is small or we're forcing smooth scroll, use smooth behavior
    const behavior =
      forceSmooth || distanceFromBottom < 500 ? "smooth" : "auto";

    container.scrollTo({
      top: scrollHeight,
      behavior,
    });
  }, []);

  // Debounced scroll handler
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    if (scrollTimeout.current) {
      window.clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = window.setTimeout(() => {
      const container = containerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;

      // Only show button if content is actually overflowing AND we're not at bottom
      const hasOverflow = scrollHeight > clientHeight;
      const scrolledFromBottom = scrollHeight - (scrollTop + clientHeight);

      setShowScrollButton(hasOverflow && scrolledFromBottom > 100);
    }, 100);
  }, []);

  // Click handler for scroll button - always use smooth scrolling
  const handleScrollButtonClick = useCallback(() => {
    scrollToBottom(true); // force smooth scroll
  }, [scrollToBottom]);

  // Function to handle resending a previous message
  const handleResendClick = async (index) => {
    // Set loading state while processing
    dispatch(setIsResponding(true));
    setLoadingResend(true);

    // Validate index is within bounds of responses array
    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      return;
    }

    // Get the prompt from the specified response
    const currentPrompt = localState.responses[index]?.prompt;
    // Validate prompt exists and isn't empty
    if (!currentPrompt || currentPrompt?.trim() === "") {
      notifyError("Invalid or empty prompt at the specified index.");
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      return;
    }

    // Initialize array for any attached images
    let imageFiles = [];
    // If the original message had images, copy them
    if (localState.responses[index]?.images?.length > 0) {
      imageFiles = localState.responses[index]?.images;
    }

    // Initialize array for any attached texts
    let textFiles = [];
    // If the original message had texts, copy them
    if (localState.responses[index]?.textFiles?.length > 0) {
      textFiles = localState.responses[index]?.textFiles;
    }

    let newConversation = [...localState.conversation].slice(0, index * 2);
    let newResponses = [...localState.responses].slice(0, index);

    // Update local state with trimmed responses
    updateLocalState({ responses: newResponses });
    // Add small delay to ensure state updates properly
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Prepare new message content based on whether there are images or text files
    if (imageFiles?.length > 0 || textFiles?.length > 0) {
      // Start with the prompt text
      const newPromptContent = [
        {
          type: "text",
          text: currentPrompt,
        },
      ];

      // Add images if they exist (keeping the original image structure)
      if (imageFiles?.length > 0) {
        newPromptContent.push(...imageFiles);
      }

      // Add text content if text files exist
      if (textFiles?.length > 0) {
        // Process all text files and append their content
        const textContent = textFiles.map((file) => file.content).join("\n\n");

        // Only add if there's actually content
        if (textContent.trim()) {
          newPromptContent.push({
            type: "text",
            text: textContent,
          });
        }
      }

      newConversation.push({ role: "user", content: newPromptContent });
    } else {
      // If no attachments, just use the text prompt
      newConversation.push({ role: "user", content: currentPrompt });
    }

    // Update local state with new response entry
    if (imageFiles?.length > 0 || textFiles?.length > 0) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: currentPrompt,
            images: imageFiles,
            textFiles: textFiles,
            response: "",
          },
        ],
      }));
    } else {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: currentPrompt,
            response: "",
          },
        ],
      }));
    }

    // Create updated conversation array for processing - REMOVE "info" role objects
    let updatedConversation = [...newConversation].filter(
      (message) => message.role !== "info"
    );

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

    // If model doesn't support images/videos, remove image/video content
    if (!imageSupport && !videoSupport) {
      updatedConversation = updatedConversation.map((message) => {
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

    // Try to fetch response from LLM
    try {
      await fetchLLMResponse(
        newConversation, // Original conversation with "info" objects (for local state)
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModalSession,
        setShowBadRequest,
        updatedConversation, // Filtered conversation without "info" objects (for API)
        isArcanaSupported
      );
      dispatch(setIsResponding(false));
      setLoadingResend(false);
    } catch (error) {
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      if (error.name === "AbortError") {
        notifyError("Request aborted.");
      } else {
        notifyError(error.message || "An unknown error occurred");
      }
    }
  };

  // Function to handle saving edited messages
  // Similar structure to handleResendClick but uses edited text
  const handleSave = async (index) => {
    dispatch(setIsResponding(true));
    setLoadingResend(true);

    // Validate index is within bounds of responses array
    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      return;
    }

    // Validate edited text exists and isn't empty
    if (!editedText || !editedText?.trim()) {
      notifyError("Prompt cannot be empty!");
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      return;
    }

    // Initialize array for any attached images
    let imageFiles = [];
    if (localState.responses[index]?.images?.length > 0) {
      imageFiles = localState.responses[index]?.images;
    }

    // Initialize array for any attached texts
    let textFiles = [];
    // If the original message had texts, copy them
    if (localState.responses[index]?.textFiles?.length > 0) {
      textFiles = localState.responses[index]?.textFiles;
    }

    // Slice conversation history up to (but not including) the selected message
    // Each response corresponds to a user-assistant pair, so index * 2 gives us everything before that pair
    let newConversation = [...localState.conversation].slice(0, index * 2);
    let newResponses = [...localState.responses].slice(0, index);

    updateLocalState({ responses: newResponses });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Prepare new message content based on whether there are images or text files
    if (imageFiles?.length > 0 || textFiles?.length > 0) {
      // Start with the prompt text
      const newPromptContent = [
        {
          type: "text",
          text: editedText,
        },
      ];

      // Add images if they exist (keeping the original image structure)
      if (imageFiles?.length > 0) {
        newPromptContent.push(...imageFiles);
      }

      // Add text content if text files exist
      if (textFiles?.length > 0) {
        // Process all text files and append their content
        const textContent = textFiles.map((file) => file.content).join("\n\n");

        // Only add if there's actually content
        if (textContent.trim()) {
          newPromptContent.push({
            type: "text",
            text: textContent,
          });
        }
      }

      newConversation.push({ role: "user", content: newPromptContent });
    } else {
      // If no attachments, just use the text prompt
      newConversation.push({ role: "user", content: editedText });
    }

    // Update local state with new response entry
    if (imageFiles?.length > 0 || textFiles?.length > 0) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: editedText,
            images: imageFiles,
            textFiles: textFiles,
            response: "",
          },
        ],
      }));
    } else {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: editedText,
            response: "",
          },
        ],
      }));
    }

    // Create updated conversation array for processing - REMOVE "info" role objects
    let updatedConversation = [...newConversation].filter(
      (message) => message.role !== "info"
    );

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

    // If model doesn't support images/videos, remove image/video content
    if (!imageSupport && !videoSupport) {
      updatedConversation = updatedConversation.map((message) => {
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

    // Try to fetch response from LLM
    try {
      await fetchLLMResponse(
        newConversation, // Original conversation with "info" objects (for local state)
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModalSession,
        setShowBadRequest,
        updatedConversation, // Filtered conversation without "info" objects (for API)
        isArcanaSupported
      );
      dispatch(setIsResponding(false));
      setLoadingResend(false);
    } catch (error) {
      dispatch(setIsResponding(false));
      setLoadingResend(false);
      if (error.name === "AbortError") {
        notifyError("Request aborted.");
      } else {
        notifyError(error.message || "An unknown error occurred");
      }
    }
  };

  // Function to handle retry of last message
  const handleRetry = (e) => {
    e.preventDefault();

    // Set prompt to last response's prompt
    setLocalState((prevState) => ({
      ...prevState,
      prompt: prevState.responses[prevState.responses.length - 1].prompt,
    }));

    // Handle any images from last response
    if (
      localState.responses[localState.responses.length - 1]?.images?.length > 0
    ) {
      const imageFileList = convertBase64ArrayToImageList(
        localState.responses[localState.responses.length - 1].images
      );

      setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
    }

    // Handle any textFiles from last response
    if (
      localState.responses[localState.responses.length - 1]?.textFiles?.length >
      0
    ) {
      const textFileList = localState.responses[
        localState.responses.length - 1
      ].textFiles.map((file) => {
        // Check if it's a PDF file
        if (file.fileType === "pdf") {
          return {
            ...file,
            content: file.content,
          };
        }
        return file;
      });

      setSelectedFiles((prevFiles) => [...prevFiles, ...textFileList]);
    }

    // Adjust textarea height after short delay
    setTimeout(() => {
      adjustHeight();
    }, 0);

    // Remove last conversation pair and response
    setLocalState((prevState) => ({
      ...prevState,
      conversation: prevState.conversation.slice(
        0,
        prevState.conversation.length - 2
      ),
      responses: prevState.responses.slice(0, prevState.responses.length - 1),
    }));
  };

  // Function to trigger JSON file input click
  const handleClickJSON = () => {
    hiddenFileInputJSON.current.value = null;
    hiddenFileInputJSON.current.click();
  };

  // Function to handle editing message at specific index
  const handleEditClick = (index, prompt) => {
    setEditingResponseIndex(-1);
    setEditedText(prompt);
    setEditingIndex(index);
    // Focus after state updates
    setTimeout(() => {
      if (textareaRefs.current[index]) {
        const textarea = textareaRefs.current[index];
        textarea.focus();
        textarea.selectionStart = prompt.length;
        textarea.selectionEnd = prompt.length;
      }
    }, 0);
  };

  // Function to handle closing edit mode
  const handleCloseClick = useCallback(
    (index) => {
      if (editingIndex === index) {
        setEditingIndex(null);
      }
    },
    [editingIndex]
  );

  // Function to handle JSON file import
  const handleFilesChangeJSON = async (e) => {
    try {
      const selectedFile = e.target.files[0];

      // Validate file selection and type
      if (!selectedFile) {
        notifyError("No file selected.");
        return;
      }

      if (selectedFile.type !== "application/json") {
        notifyError("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        notifyError("Error reading file.");
      };

      // Handle file content after loading
      reader.onload = async () => {
        // Inner function to process message data
        function processMessages(parsedData) {
          // Validate data structure
          if (
            parsedData.length > 0 &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "role") &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "content")
          ) {
            let newArray = [];

            // Handle system prompt if present - replace existing one
            if (parsedData[0].role === "system") {
              updateSettings({ systemPrompt: parsedData[0].content });
            }

            // Process each message
            for (let i = 0; i < parsedData.length; i++) {
              const currentMessage = parsedData[i];

              // Handle info role - always create standalone info object
              if (currentMessage.role === "info") {
                newArray.push({
                  info: currentMessage.content,
                });
                continue;
              }

              // Handle user-assistant pairs
              if (
                currentMessage.role === "user" &&
                parsedData[i + 1]?.role === "assistant"
              ) {
                let userContent = currentMessage.content;
                let images = [];

                // Handle different content types (text and images)
                if (Array.isArray(userContent)) {
                  let textContent = "";

                  userContent.forEach((item) => {
                    if (item.type === "text") {
                      textContent += item.text + "\n";
                    } else if (item.type === "image_url" && item.image_url) {
                      images.push({
                        type: item.type,
                        image_url: {
                          url: item.image_url.url,
                        },
                      });
                    }
                  });

                  const responseObj = {
                    prompt: textContent?.trim(),
                    images: images,
                    response: parsedData[i + 1]?.content,
                  };

                  newArray.push(responseObj);
                } else {
                  const responseObj = {
                    prompt: userContent,
                    response: parsedData[i + 1]?.content,
                  };

                  newArray.push(responseObj);
                }
              }
            }

            setLocalState((prevState) => ({
              ...prevState,
              responses: newArray,
              conversation: parsedData,
            }));

            // Only update conversation and responses in Redux
            dispatch(
              updateConversation({
                id: conversationId,
                updates: {
                  conversation: parsedData,
                  responses: newArray,
                },
              })
            );

            notifySuccess("Chat imported successfully");
          } else {
            notifyError("Invalid structure of JSON.");
          }
        }

        // Parse and process JSON data
        try {
          let data = reader.result;

          // Fix common JSON issues like trailing commas
          data = data.replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas

          const parsedData = JSON.parse(data);

          if (Array.isArray(parsedData)) {
            // Format 2: Direct array of messages
            processMessages(parsedData);
          } else if (
            parsedData &&
            parsedData.messages &&
            Array.isArray(parsedData.messages)
          ) {
            // Format 1: Object with messages array and settings
            const settings = {
              model: parsedData.model || parsedData["model-name"],
              model_api: parsedData.model_api,
              temperature: parsedData.temperature,
              top_p: parsedData.top_p,
            };

            // Get title from parsedData or use default
            const title = parsedData.title || "Imported Conversation";

            // Update settings and title before processing messages
            const updates = {
              title,
              settings: {
                ...localState.settings,
                ...settings,
              },
            };

            if (parsedData.arcana?.id) {
              updates.arcana = {
                id: parsedData.arcana.id,
                key: parsedData.arcana.key,
              };
            }

            dispatch(
              updateConversation({
                id: conversationId,
                updates,
              })
            );

            // Now process messages (this will only update conversation and responses)
            processMessages(parsedData.messages);
          } else {
            notifyError("Invalid structure of JSON.");
          }
        } catch (jsonError) {
          console.error("JSON Parse Error:", jsonError);
          notifyError("Invalid JSON file format: " + jsonError.message);
        }
      };

      reader.readAsText(selectedFile);
    } catch (error) {
      notifyError("An error occurred: " + error.toString());
    }
  };

  // Function to handle clearing chat history
  const handleClearHistory = () => {
    if (localState.dontShow.dontShowAgain) {
      clearHistory();
    } else {
      setShowHistoryModal(true);
    }
  };

  // Utility function to convert base64 image data to file-like objects
  const convertBase64ArrayToImageList = (base64Array) => {
    const imageFileList = base64Array.map((item, index) => {
      if (
        item.type === "image_url" &&
        item.image_url.url.startsWith("data:image")
      ) {
        const base64Data = item.image_url.url;
        const fileName = `image_${index + 1}`;
        const fileSize = atob(base64Data.split(",")[1]).length;

        return {
          name: fileName,
          type: "image",
          size: fileSize,
          text: base64Data,
        };
      }
      return null;
    });

    return imageFileList.filter(Boolean);
  };

  // Function to adjust textarea height for specific index
  const adjustHeightRefs = (index) => {
    if (textareaRefs.current[index]) {
      const textarea = textareaRefs.current[index];
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  useEffect(() => {
    if (editingIndex !== null) {
      // Use requestAnimationFrame for smoother height adjustments
      requestAnimationFrame(() => adjustHeightRefs(editingIndex));
    }
  }, [editedText, editingIndex]);

  useEffect(() => {
    // Use requestAnimationFrame for smoother height adjustments
    requestAnimationFrame(() => adjustHeight());
  }, [localState.prompt, editedText, adjustHeight]);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => {
      setCopied(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!containerRef.current || !localState.responses) return;

    const currentLength = localState.responses.length;
    const lastResponse = localState.responses[currentLength - 1];

    // If we have a new response or the last response is updating
    if (
      currentLength > lastResponseLength.current ||
      (lastResponse?.response && (loading || loadingResend))
    ) {
      // Check if user is already near bottom
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 300;

      // Scroll smoothly if user is near bottom or if it's a new response
      if (isNearBottom || currentLength > lastResponseLength.current) {
        scrollToBottom(true); // force smooth scroll
      }
    }

    lastResponseLength.current = currentLength;
  }, [localState.responses, loading, scrollToBottom, loadingResend]);

  useEffect(() => {
    handleScroll();
  }, [localState.responses, handleScroll]);

  // Cleanup
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Initial check
      handleScroll();

      container.addEventListener("scroll", handleScroll);
      // Also check on resize as container dimensions might change
      window.addEventListener("resize", handleScroll);

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        if (scrollTimeout.current) {
          window.clearTimeout(scrollTimeout.current);
        }
      };
    }
  }, [handleScroll]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setEditingIndex(-1);
        setEditingResponseIndex(-1);
        setIsEditing(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="p-2 flex flex-col gap-2 overflow-y-auto flex-1 relative"
      >
        {localState.responses?.map((res, index) => (
          <>
            {!res.info ? (
              <div key={index} className="flex flex-col gap-1">
                <div
                  ref={(el) => (containerRefs.current[index] = el)}
                  className={`text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-2xl bg-bg_chat_user dark:bg-bg_chat_user_dark ${
                    editingIndex === index ? "p-0" : "p-3"
                  } flex flex-col gap-2`}
                >
                  {editingIndex === index ? (
                    <div className="justify-between items-start text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-2xl bg-bg_chat_user dark:bg-bg_chat_user_dark p-3 flex flex-col gap-2">
                      <textarea
                        ref={(el) => (textareaRefs.current[index] = el)}
                        className="p-2 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
                        value={editedText}
                        style={{
                          minHeight: `${MIN_HEIGHT}px`,
                          maxHeight: `${MAX_HEIGHT}px`,
                        }}
                        onChange={(e) => {
                          setEditedText(e.target.value);
                          adjustHeight(index);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            editedText?.trim() !== ""
                          ) {
                            event.preventDefault();
                            handleCloseClick(index);
                            handleSave(index);
                            setIsEditing(false);
                          }
                        }}
                      />
                      <div className="flex gap-2 justify-between w-full">
                        <button
                          onClick={() => setEditedText("")}
                          disabled={loading || loadingResend}
                        >
                          <img
                            src={clear}
                            alt="clear"
                            className="h-[25px] w-[25px] cursor-pointer"
                          />
                        </button>
                        <button
                          onClick={() => {
                            handleCloseClick(index);
                            handleSave(index);
                          }}
                          disabled={loading || loadingResend}
                        >
                          <img
                            className="cursor-pointer h-[25px] w-[25px]"
                            src={send}
                            alt="send"
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-between items-start group">
                      <pre
                        className="font-sans flex-grow min-w-0"
                        style={{
                          overflow: "hidden",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {res.prompt}
                      </pre>
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2 items-center">
                        <button
                          onClick={(e) => handleResendClick(index, e)}
                          disabled={loading || loadingResend}
                        >
                          <img
                            src={icon_resend}
                            alt="icon_resend"
                            className="h-[25px] w-[25px] cursor-pointer"
                          />
                        </button>
                        <button
                          onClick={() => {
                            handleEditClick(index, res.prompt);
                          }}
                          disabled={loading || loadingResend}
                        >
                          <img
                            src={edit_icon}
                            alt="edit_icon"
                            className="h-[25px] w-[25px] cursor-pointer"
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {(res?.images?.length > 0 ||
                  res?.videos?.length > 0 ||
                  res?.textFiles?.length > 0) && (
                  <div className="flex gap-2 overflow-x-auto items-center p-3">
                    {res.images?.map((imageObj, imgIndex) => {
                      if (
                        imageObj.type === "image_url" &&
                        imageObj.image_url.url
                      ) {
                        return (
                          <img
                            key={`img-${imgIndex}`}
                            src={imageObj.image_url.url}
                            alt="Base64 Image"
                            className="h-[150px] w-[150px] rounded-2xl object-cover cursor-pointer"
                            onClick={() =>
                              setPreviewFile(imageObj.image_url.url)
                            }
                            onError={(e) => {
                              e.target.src = video_icon;
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                    {res.videos?.map((videoObj, vidIndex) => {
                      if (videoObj.type === "video_url") {
                        return (
                          <img
                            key={`vid-${vidIndex}`}
                            src={video_icon}
                            alt="Video content"
                            className="h-[150px] w-[150px] rounded-2xl object-cover cursor-pointer"
                          />
                        );
                      }
                      return null;
                    })}
                    {res.textFiles?.map((textObj, textIndex) => {
                      if (textObj.fileType === "text") {
                        // The correct path to access text content
                        const textContent = textObj.content;

                        // Get file type from content or default to "txt"
                        const fileType = textObj.content.fileType || "txt";

                        // Get a preview of the text (first 50 characters)
                        const textPreview =
                          textContent.substring(0, 100) +
                          (textContent.length > 100 ? "..." : "");

                        // Get file name if available
                        const fileName = textContent.split(":")[0] || "File";

                        return (
                          <div
                            key={`text-${textIndex}`}
                            className="h-[150px] w-[150px] rounded-2xl flex flex-col cursor-pointer bg-bg_light/80 dark:bg-bg_dark/80 hover:bg-bg_light/50 dark:hover:bg-white/5 overflow-hidden shadow-md transition-all"
                            onClick={() =>
                              setPreviewFile({
                                content: textObj.content,
                                name: fileName,
                                isText: true,
                              })
                            }
                          >
                            {/* File name at top */}
                            <div className="px-3 py-2 font-medium text-sm truncate border-b text-black dark:text-white">
                              {fileName}
                            </div>

                            {/* Text preview in middle */}
                            <div className="flex-1 p-3 text-xs overflow-hidden text-tertiary">
                              {textPreview}
                            </div>

                            {/* File type indicator at bottom */}
                            <div className="flex justify-center items-center pb-2">
                              <span
                                className="px-3 py-1 text-xs font-medium rounded-full 
                        bg-blue-100 dark:bg-blue-900 
                        text-blue-800 dark:text-blue-200 uppercase"
                              >
                                {fileType}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}

                <ResponseItem
                  res={res}
                  index={index}
                  isDarkModeGlobal={isDarkModeGlobal}
                  copied={copied}
                  setCopied={setCopied}
                  indexChecked={indexChecked}
                  setIndexChecked={setIndexChecked}
                  loading={loading}
                  loadingResend={loadingResend}
                  responses={localState.responses}
                  editingResponseIndex={editingResponseIndex}
                  setEditedResponse={setEditedResponse}
                  handleResponseEdit={handleResponseEdit}
                  handleResponseSave={handleResponseSave}
                  editedResponse={editedResponse}
                  setEditingResponseIndex={setEditingResponseIndex}
                  handleResendClick={handleResendClick}
                />
              </div>
            ) : (
              <div key={index} className="flex flex-col gap-1">
                {res.info && (
                  <div className="text-sm text-tertiary p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {res.info}
                  </div>
                )}
              </div>
            )}
          </>
        ))}
      </div>

      {localState.responses.length > 0 ? (
        <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
          <Tooltip text={t("description.clear")}>
            <button
              className="h-[30px] w-[30px] cursor-pointer"
              disabled={loading || loadingResend}
              onClick={handleClearHistory}
            >
              <img
                className="cursor-pointer h-[25px] w-[25px]"
                src={clear}
                alt="clear"
              />
            </button>
          </Tooltip>
          {showScrollButton && (
            <button
              onClick={handleScrollButtonClick}
              aria-label="Scroll to bottom"
              className="text-tertiary max-w-[150px] w-full p-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <p> Scroll to bottom</p>
            </button>
          )}
          <div className="flex items-baseline gap-6">
            <Tooltip text={t("description.export")}>
              <button
                className="text-tertiary flex gap-2 items-center"
                onClick={() => setShowFileModal(true)}
                disabled={loading || loadingResend}
              >
                <img
                  className="cursor-pointer h-[30px] w-[30px]"
                  src={export_icon}
                  alt="export"
                />
              </button>
            </Tooltip>

            <div className="flex items-center">
              <input
                type="file"
                ref={hiddenFileInputJSON}
                accept="application/JSON"
                onChange={handleFilesChangeJSON}
                className="hidden"
              />
              <Tooltip text={t("description.import")}>
                <button
                  className="h-[30px] w-[30px] cursor-pointer"
                  onClick={handleClickJSON}
                  disabled={loading || loadingResend}
                >
                  <img
                    className="h-[30px] w-[30px]"
                    src={import_icon}
                    alt="import"
                  />
                </button>
              </Tooltip>
            </div>
            <Tooltip text={t("description.undo")}>
              <button
                className="h-[30px] w-[30px] cursor-pointer"
                onClick={handleRetry}
                disabled={loading || loadingResend}
              >
                <img
                  className="cursor-pointer h-[30px] w-[30px]"
                  src={retry}
                  alt="retry"
                />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : (
        <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-end items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
          <input
            type="file"
            ref={hiddenFileInputJSON}
            accept="application/JSON"
            onChange={handleFilesChangeJSON}
            className="hidden"
          />
          <Tooltip text={t("description.import")}>
            <button
              className="h-[30px] w-[30px] cursor-pointer"
              onClick={handleClickJSON}
              disabled={loading || loadingResend}
            >
              <img
                className="cursor-pointer h-[30px] w-[30px]"
                src={import_icon}
                alt="import"
              />
            </button>
          </Tooltip>
        </div>
      )}
      {previewFile && (
        <PreviewImageModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
}

export default Responses;
