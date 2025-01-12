/* eslint-disable no-unused-vars */
//Libraries
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

//
import Tooltip from "../Others/Tooltip";
import ResponseItem from "../Markdown/ResponseItem";

//API
import { abortFetch, getDataFromLLM } from "../../apis/Completion";

//Redux
import { setCountGlobal } from "../../Redux/actions/alertAction";
import { useDispatch, useSelector } from "react-redux";

//Assets
import retry from "../../assets/icon_retry.svg";
import clear from "../../assets/cross_icon.svg";
import export_icon from "../../assets/export_icon.svg";
import import_icon from "../../assets/import_icon.svg";
import settings_icon from "../../assets/Settings_Icon.svg";
import image_icon from "../../assets/icon_image.svg";
import send from "../../assets/icon_send.svg";
import upload from "../../assets/add.svg";
import mic from "../../assets/icon_mic.svg";
import stop from "../../assets/stop_listening.svg";
import pause from "../../assets/pause.svg";
import edit_icon from "../../assets/edit_icon.svg";
import cross from "../../assets/cross.svg";
import icon_resend from "../../assets/icon_resend.svg";

//Variables
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

const languageMap = {
  en: "en-US",
  de: "de-DE",
};

const Responses = ({
  modelList,
  selectedFiles,
  setSelectedFiles,
  localState,
  setLocalState,
  isImageSupported,
  setShowModelSession,
  setShowBadRequest,
  setShowFileModel,
  setShowMicModel,
  setShowHistoryModel,
  toggleAdvOpt,
  updateLocalState,
  updateSettings,
  clearHistory,
  notifySuccess,
  notifyError,
}) => {
  // Hooks
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { listening, resetTranscript } = useSpeechRecognition();

  // Redux state
  const countClose = useSelector((state) => state.count);
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);

  // Local useState
  const [showModel, setShowModel] = useState(true);
  const [count, setCount] = useState(countClose);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [loadingResend, setLoadingResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  //Variable
  const isLoading = loading || loadingResend;

  //Refs
  const lastScrollPosition = useRef(0);
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const hiddenFileInput = useRef(null);
  const hiddenFileInputImage = useRef(null);
  const hiddenFileInputJSON = useRef(null);
  const textareaRefs = useRef([]);
  const containerRefs = useRef([]);

  //Functions
  async function getRes(updatedConversation) {
    setLoading(true);

    const imageSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("image")
    );

    let processedConversation = updatedConversation;
    if (!imageSupport) {
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
      const imageContent = imageFiles.map((imageFile) => ({
        type: "image_url",
        image_url: {
          url: imageFile.text,
        },
      }));

      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: prevState.prompt,
            images: imageContent,
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
            prompt: prevState.prompt,
            response: "",
          },
        ],
      }));
    }

    updateLocalState({ prompt: "" });

    try {
      const response = await getDataFromLLM(
        processedConversation,
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModelSession,
        setShowBadRequest,
        processedConversation
      );

      setIsSubmitting(false);
      setLoading(false);
      setSelectedFiles([]);
    } catch (error) {
      setIsSubmitting(false);
      setLoading(false);
      setSelectedFiles([]);

      if (error.name === "AbortError") {
        notifyError("Request aborted.");
      } else if (error.message) {
        notifyError(error.message);
      } else {
        notifyError("An unknown error occurred");
      }
    }
  }

  const handleAbortFetch = () => {
    abortFetch(notifyError);
    setIsSubmitting(false);
    setLoading(false);
  };

  const handleResendClick = async (index) => {
    setLoadingResend(true);

    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      setLoadingResend(false);
      return;
    }

    const currentPrompt = localState.responses[index]?.prompt;
    if (!currentPrompt || currentPrompt?.trim() === "") {
      notifyError("Invalid or empty prompt at the specified index.");
      setLoadingResend(false);
      return;
    }
    let imageFiles = [];

    if (localState.responses[index]?.images?.length > 0) {
      imageFiles = localState.responses[index]?.images;
    }

    let newConversation = [...localState.conversation].slice(0, index * 2 + 1);
    let newResponses = [...localState.responses].slice(0, index);

    updateLocalState({ responses: newResponses });
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (imageFiles?.length > 0) {
      const newPromptContent = [
        {
          type: "text",
          text: currentPrompt,
        },
        ...imageFiles,
      ];
      newConversation.push({ role: "user", content: newPromptContent });
    } else {
      newConversation.push({ role: "user", content: currentPrompt });
    }

    if (imageFiles?.length > 0) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: currentPrompt,
            images: imageFiles,
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

    let updatedConversation = [...newConversation];
    const imageSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("image")
    );

    if (!imageSupport) {
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

    try {
      await getDataFromLLM(
        newConversation,
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModelSession,
        setShowBadRequest,
        updatedConversation
      );
      setLoadingResend(false);
    } catch (error) {
      setLoadingResend(false);
      if (error.name === "AbortError") {
        notifyError("Request aborted.");
      } else {
        notifyError(error.message || "An unknown error occurred");
      }
    }
  };

  const handleSave = async (index) => {
    setLoadingResend(true);

    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      setLoadingResend(false);
      return;
    }

    if (!editedText || !editedText?.trim()) {
      notifyError("Prompt cannot be empty!");
      setLoadingResend(false);
      return;
    }

    let imageFiles = [];

    if (localState.responses[index]?.images?.length > 0) {
      imageFiles = localState.responses[index]?.images;
    }

    let newConversation = [...localState.conversation].slice(0, index * 2 + 1);
    let newResponses = [...localState.responses].slice(0, index);

    updateLocalState({ responses: newResponses });

    await new Promise((resolve) => setTimeout(resolve, 0));

    if (imageFiles?.length > 0) {
      const newPromptContent = [
        {
          type: "text",
          text: editedText,
        },
        ...imageFiles,
      ];
      newConversation.push({ role: "user", content: newPromptContent });
    } else {
      newConversation.push({ role: "user", content: editedText });
    }

    if (imageFiles?.length > 0) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: [
          ...prevState.responses,
          {
            prompt: editedText,
            images: imageFiles,
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

    let updatedConversation = [...newConversation];
    const imageSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("image")
    );

    if (!imageSupport) {
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

    try {
      await getDataFromLLM(
        newConversation,
        localState.settings.systemPrompt,
        localState.settings.model_api,
        localState.settings.temperature,
        localState.settings.top_p,
        localState.arcana,
        setLocalState,
        setShowModelSession,
        setShowBadRequest,
        updatedConversation
      );
      setLoadingResend(false);
    } catch (error) {
      setLoadingResend(false);
      notifyError(error.message || "An unknown error occurred");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (localState.prompt?.trim() === "") return;

    SpeechRecognition.stopListening();
    resetTranscript();

    let newConversation;

    if (selectedFiles.length > 0) {
      const textFiles = selectedFiles.filter((file) => file.type !== "image");
      const imageFiles = selectedFiles.filter((file) => file.type === "image");

      const allTextFilesText = textFiles
        .map((file) => `${file.name}: ${file.text}`)
        .join("\n");

      const fullPrompt = `${localState.prompt}\n${allTextFilesText}`;

      const imageContent = imageFiles.map((imageFile) => ({
        type: "image_url",
        image_url: {
          url: imageFile.text,
        },
      }));

      const newPromptContent = [
        {
          type: "text",
          text: fullPrompt,
        },
        ...imageContent,
      ];

      newConversation = [
        ...localState.conversation,
        { role: "user", content: newPromptContent },
      ];
    } else {
      newConversation = [
        ...localState.conversation,
        { role: "user", content: localState.prompt },
      ];
    }

    setLocalState((prevState) => ({
      ...prevState,
      conversation: newConversation,
    }));

    setIsSubmitting(true);
    await getRes(newConversation);
  };

  const handleRetry = (e) => {
    e.preventDefault();

    setLocalState((prevState) => ({
      ...prevState,
      prompt: prevState.responses[prevState.responses.length - 1].prompt,
    }));
    if (
      localState.responses[localState.responses.length - 1]?.images?.length > 0
    ) {
      const imageFileList = convertBase64ArrayToImageList(
        localState.responses[localState.responses.length - 1].images
      );

      setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
    }

    setTimeout(() => {
      adjustHeight();
    }, 0);

    setLocalState((prevState) => ({
      ...prevState,
      conversation: prevState.conversation.slice(
        0,
        prevState.conversation.length - 2
      ),
      responses: prevState.responses.slice(0, prevState.responses.length - 1),
    }));
  };
  const handleClick = () => {
    hiddenFileInput.current.value = null;
    hiddenFileInput.current.click();
  };
  const handleClickJSON = () => {
    hiddenFileInputJSON.current.value = null;
    hiddenFileInputJSON.current.click();
  };
  const handleEditClick = (index, prompt) => {
    setEditingIndex(index);
    setEditedText(prompt);
    setTimeout(() => adjustHeight(index), 0);
  };
  const handleCloseClick = (index) => {
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };
  const handleClickOutside = (event, index) => {
    if (
      containerRefs.current[index] &&
      !containerRefs.current[index].contains(event.target) &&
      textareaRefs.current[index] !== event.target
    ) {
      handleCloseClick(index);
      setIsEditing(false);
    }
  };
  const handleFilesChangeJSON = async (e) => {
    try {
      const selectedFile = e.target.files[0];

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

      reader.onload = async () => {
        function processMessages(parsedData) {
          if (
            parsedData.length > 0 &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "role") &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "content")
          ) {
            let newArray = [];
            if (parsedData[0].role === "system") {
              updateSettings({ systemPrompt: parsedData[0].content });
            }
            for (let i = 0; i < parsedData.length; i++) {
              if (
                parsedData[i].role === "user" &&
                parsedData[i + 1]?.role === "assistant"
              ) {
                let userContent = parsedData[i].content;
                let images = [];

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

                  newArray.push({
                    prompt: textContent?.trim(),
                    images: images,
                    response: parsedData[i + 1]?.content,
                  });
                } else {
                  newArray.push({
                    prompt: userContent,
                    response: parsedData[i + 1]?.content,
                  });
                }
              }
            }
            setLocalState((prevState) => ({
              ...prevState,
              responses: newArray,
              conversation: parsedData,
            }));
            notifySuccess("Chat imported successfully");
          } else {
            notifyError("Invalid structure of JSON.");
          }
        }

        try {
          const data = reader.result;
          const parsedData = JSON.parse(data);

          if (Array.isArray(parsedData)) {
            processMessages(parsedData);
          } else if (
            parsedData &&
            parsedData.messages &&
            Array.isArray(parsedData.messages)
          ) {
            if (parsedData.temperature) {
              updateSettings({ temperature: parsedData.temperature });
            }
            if (parsedData.top_p) {
              updateSettings({ top_p: parsedData.top_p });
            }
            if (parsedData.arcana) {
              setLocalState((prev) => ({
                ...prev,
                arcana: parsedData.arcana,
              }));
            }
            if (parsedData.model) {
              updateSettings({ model_api: parsedData.model });
            }
            if (parsedData["model-name"]) {
              updateSettings({ model: parsedData["model-name"] });
            } else {
              updateSettings({ model: parsedData.model });
            }
            processMessages(parsedData.messages);
          } else {
            notifyError("Invalid structure of JSON.");
          }
        } catch (jsonError) {
          notifyError("Invalid JSON file format.");
        }
      };

      reader.readAsText(selectedFile);
    } catch (error) {
      notifyError("An error occurred: " + error.toString());
    }
  };
  const handleClickImage = () => {
    hiddenFileInputImage.current.value = null;
    hiddenFileInputImage.current.click();
  };
  const handleFilesChange = async (e) => {
    try {
      const textFiles = Array.from(e.target.filemodelLists).filter(
        (file) => file.type === "text/plain"
      );
      const csvFiles = Array.from(e.target.files).filter(
        (file) => file.type === "text/csv"
      );

      if (textFiles.length + csvFiles.length !== e.target.files.length) {
        notifyError("All files must be text or CSV");
      } else {
        notifySuccess("File attached");
      }

      const filesWithText = [];
      for (const file of textFiles) {
        const text = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          text,
        });
      }

      for (const file of csvFiles) {
        const text = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          size: file.size,
          text: formatCSVText(text),
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...filesWithText]);
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  const handleFilesChangeImage = async (e) => {
    try {
      const imageFiles = Array.from(e.target.files).filter(
        (file) =>
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/gif" ||
          file.type === "image/webp"
      );

      if (imageFiles.length !== e.target.files.length) {
        notifyError("All files must be images");
      } else {
        notifySuccess("File attached");
      }

      const imageFileList = [];
      for (const file of imageFiles) {
        const text = await readFileAsBase64(file);
        imageFileList.push({
          name: file.name,
          type: "image",
          size: file.size,
          text,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  const handlePaste = async (event) => {
    try {
      const clipboardItems = event.clipboardData.items;
      const imageItems = [];

      for (const item of clipboardItems) {
        if (item.type.startsWith("image/")) {
          imageItems.push(item.getAsFile());
        }
      }

      if (imageItems.length > 0) {
        const imageFileList = [];

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

  const handleDrop = async (event) => {
    if (!isImageSupported) return;
    event.preventDefault();
    try {
      const droppedFiles = Array.from(event.dataTransfer.files).filter(
        (file) =>
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/gif" ||
          file.type === "image/webp"
      );

      if (droppedFiles.length === 0) {
        notifyError("Only image files are allowed");
        return;
      } else {
        notifySuccess("Image(s) dropped");
      }

      const imageFileList = [];
      for (const file of droppedFiles) {
        const base64 = await readFileAsBase64(file);
        imageFileList.push({
          name: file.name,
          type: "image",
          size: file.size,
          text: base64,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
    } catch (error) {
      notifyError("An error occurred while dropping the files: ", error);
    }
  };
  const handleScroll = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
    const isNotAtBottom = distanceFromBottom > 20;
    const hasEnoughContent = scrollHeight > clientHeight + 100;

    setShowScrollButton(isNotAtBottom && hasEnoughContent);

    if (Math.abs(scrollTop - lastScrollPosition.current) > 10) {
      setUserScrolled(isNotAtBottom);
      lastScrollPosition.current = scrollTop;
    }
  }, []);

  const handleClearHistory = () => {
    if (localState.dontShow.dontShowAgain) {
      clearHistory();
    } else {
      setShowHistoryModel(true);
    }
  };

  const handleChange = (event) => {
    updateLocalState({ prompt: event.target.value });
    adjustHeight();
  };
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

  const adjustHeightRefs = (index) => {
    if (textareaRefs.current[index]) {
      const textarea = textareaRefs.current[index];
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const formatCSVText = (csvText) => {
    const rows = csvText.split("\n");
    const formattedRows = rows.map((row) => row.split(",").join(" | "));
    return formattedRows.join("\n");
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  const focusTextArea = (index) => {
    if (textareaRefs.current[index]) {
      textareaRefs.current[index].focus();
    }
    setIsEditing(true);
  };
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setUserScrolled(false);
      setShowScrollButton(false);
    }
  }, []);

  //Effects
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => container?.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (localState.responses.length === 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      setShowScrollButton(false);
      setUserScrolled(false);
    }
  }, [localState.responses.length]);

  useEffect(() => {
    if (editingIndex !== null) {
      adjustHeightRefs(editingIndex);
    }
  }, [editedText, editingIndex]);
  useEffect(() => {
    const handleOutsideClick = (event) => {
      localState.responses.forEach((_, index) => {
        handleClickOutside(event, index);
      });
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEditing, localState.responses]);
  useEffect(() => {
    adjustHeight();
  }, [localState.prompt, editedText]);
  useEffect(() => {
    if (!userScrolled && messagesEndRef.current) {
      const behavior = isLoading ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, [localState.responses, isLoading, userScrolled]);
  useEffect(() => {
    let timer;
    if (copied) {
      timer = setTimeout(() => {
        setCopied(false);
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="flex flex-col items-center mobile:w-full w-[60%] h-full gap-3 sm:justify-between relative p-2 bg-bg_light dark:bg-bg_dark">
      <div className="desktop:max-h-full flex-1 min-h-0 overflow-y-auto flex flex-col relative w-[calc(100%-12px)] mobile:w-full border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark">
        {showModel && count < 3 && (
          <div className="w-[calc(100%-16px)] sticky select-none m-2 h-fit bg-white dark:bg-black p-2 rounded-2xl flex justify-between items-center border dark:border-border_dark shadow-lg dark:shadow-dark">
            <p className="dark:text-white text-black">
              <Trans i18nKey="description.note1" />
              <Link
                to="https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note6" />
                &nbsp;
              </Link>
              <Trans i18nKey="description.note2" />
              <Link
                to="https://datenschutz.gwdg.de/services/chatai"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note3" />
                &nbsp;
              </Link>
              <Trans i18nKey="description.note4" />
              <Link
                to="https://gwdg.de/imprint/"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note5" />
              </Link>
              .
            </p>
            <img
              src={cross}
              alt="cross"
              className="h-[30px] w-[30px] cursor-pointer"
              onClick={() => {
                setShowModel(false);
                dispatch(setCountGlobal(count + 1));
                setCount((prevCount) => prevCount + 1);
              }}
            />
          </div>
        )}

        <div
          ref={containerRef}
          className="p-2 flex flex-col gap-2 overflow-y-auto flex-1 relative"
        >
          {localState.responses?.map((res, index) => (
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
                        disabled={loadingResend}
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
                        disabled={loadingResend}
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
                        disabled={loadingResend}
                      >
                        <img
                          src={icon_resend}
                          alt="icon_resend"
                          className="h-[25px] w-[25px] cursor-pointer"
                        />
                      </button>
                      <button
                        onClick={() => {
                          focusTextArea(index);
                          handleEditClick(index, res.prompt);
                        }}
                        disabled={loadingResend}
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

              {res?.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto items-center p-3">
                  {res.images.map((imageObj, imgIndex) => {
                    if (
                      imageObj.type === "image_url" &&
                      imageObj.image_url.url
                    ) {
                      return (
                        <img
                          key={imgIndex}
                          src={imageObj.image_url.url}
                          alt="Base64 Image"
                          className="h-[150px] w-[150px] rounded-2xl object-cover"
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              )}

              <ResponseItem
                res={res}
                index={index}
                handleRetryError={handleResendClick}
                loading={loading}
                loadingResend={loadingResend}
                responses={localState.responses}
                notifyError={notifyError}
                isDarkModeGlobal={isDarkModeGlobal}
                copied={copied}
                indexChecked={indexChecked}
                setCopied={setCopied}
                setIndexChecked={setIndexChecked}
              />
            </div>
          ))}
          <div ref={messagesEndRef} />

          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              style={{
                left: "50%",
                transform: "translateX(-50%)",
              }}
              className="bg-tertiary sticky bottom-0 hover:bg-blue-600 text-white w-fit rounded-full shadow-lg transition-all duration-200 flex items-center justify-center gap-1 py-2 px-4 group hover:shadow-xl"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="25"
                height="25"
                viewBox="0 0 24 24"
                className="transform transition-transform group-hover:translate-y-0.5"
              >
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </button>
          )}
        </div>

        {localState.responses.length > 0 ? (
          <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
            <Tooltip text={t("description.clear")}>
              <button
                className="h-[30px] w-[30px] cursor-pointer"
                disabled={loading}
                onClick={handleClearHistory}
              >
                <img
                  className="cursor-pointer h-[25px] w-[25px]"
                  src={clear}
                  alt="clear"
                />
              </button>
            </Tooltip>

            <div className="flex items-center gap-6">
              <Tooltip text={t("description.export")}>
                <button
                  className="text-tertiary flex gap-2 items-center"
                  onClick={() => setShowFileModel(true)}
                  disabled={loading}
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
                    disabled={loading}
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
                  disabled={loading}
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
                disabled={loading}
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
      </div>
      <div className="mobile:w-full flex flex-shrink-0 flex-col w-[calc(100%-12px)] dark:text-white text-black mobile:h-fit justify-between sm:overflow-y-auto sm:gap-3 rounded-2xl shadow-bottom dark:shadow-darkBottom bg-bg_light dark:bg-bg_dark">
        <div className="flex flex-col gap-4 w-full">
          <div className="relative select-none border dark:border-border_dark rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark">
            {isImageSupported ? (
              <div
                className="drag-drop-container"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <textarea
                  autoFocus
                  ref={textareaRef}
                  className="p-5 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
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
                  onPaste={isImageSupported ? handlePaste : null}
                />
              </div>
            ) : (
              <textarea
                autoFocus
                ref={textareaRef}
                className="p-5 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
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

            <div className="px-3 py-2 w-full h-fit flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
              {localState.prompt?.trim() !== "" ? (
                <Tooltip text={t("description.clear")}>
                  <button
                    className="h-[30px] w-[30px] cursor-pointer"
                    onClick={() => {
                      updateLocalState({ prompt: "" });
                      resetTranscript();
                    }}
                    disabled={loading}
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
                  className="hidden mobile:flex h-[30px] w-[30px] cursor-pointer"
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
                  accept=".txt, .csv"
                  onChange={handleFilesChange}
                  className="hidden"
                />
                <Tooltip text={t("description.upload")}>
                  <button
                    className="h-[30px] w-[30px] cursor-pointer"
                    onClick={handleClick}
                    disabled={loading}
                  >
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={upload}
                      alt="upload"
                    />
                  </button>
                </Tooltip>

                {isImageSupported && (
                  <>
                    <input
                      type="file"
                      ref={hiddenFileInputImage}
                      multiple
                      accept=".jpg, .jpeg, .png, .gif, .webp"
                      onChange={handleFilesChangeImage}
                      className="hidden"
                    />
                    <Tooltip text={t("description.attachImage")}>
                      <button
                        className="h-[30px] w-[30px] cursor-pointer"
                        onClick={handleClickImage}
                        disabled={loading}
                      >
                        <img
                          className="cursor-pointer h-[30px] w-[30px]"
                          src={image_icon}
                          alt="attach image"
                        />
                      </button>
                    </Tooltip>
                  </>
                )}

                {loading ? (
                  <Tooltip text={t("description.pause")}>
                    <button className="h-[30px] w-[30px] cursor-pointer">
                      <img
                        className="cursor-pointer h-[30px] w-[30px]"
                        src={pause}
                        alt="pause"
                        onClick={handleAbortFetch}
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
                        disabled={loading}
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
                              setShowMicModel(true);
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
    </div>
  );
};

Responses.defaultProps = {};

export default Responses;
