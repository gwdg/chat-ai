/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// Libraries and dependencies
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useTranslation, Trans } from "react-i18next";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import "react-toastify/dist/ReactToastify.css";
import Tooltip from "./Others/Tooltip";

// Assets
import retry from "../assets/icon_retry.svg";
import clear from "../assets/cross_icon.svg";
import export_icon from "../assets/export_icon.svg";
import import_icon from "../assets/import_icon.svg";
import settings_icon from "../assets/Settings_Icon.svg";
import image_icon from "../assets/icon_image.svg";
import share_icon from "../assets/share_icon.svg";
import send from "../assets/icon_send.svg";
import upload from "../assets/add.svg";
import uploaded from "../assets/file_uploaded.svg";
import dropdown from "../assets/icon_dropdown.svg";

// import advanced_settings_arrow from "../assets/advanced_settings_arrow.svg";
import help from "../assets/icon_help.svg";
import image_supported from "../assets/image_supported.svg";
import cross from "../assets/cross.svg";
import mic from "../assets/icon_mic.svg";
import stop from "../assets/stop_listening.svg";
import pause from "../assets/pause.svg";
import edit_icon from "../assets/edit_icon.svg";
import icon_resend from "../assets/icon_resend.svg";
import Help_Model from "../model/Help_Model";
import Mic_Model from "../model/Mic_Model";
import Cutom_Instructions_Model from "../model/Cutom_Instructions_Model";
import { abortFetch, getDataFromLLM } from "../apis/Completion";
import ExportTypeModel from "../model/ExportTypeModel";
import { setCountGlobal } from "../Redux/actions/alertAction";
import Session_Expired from "../model/Session_Expired";
import Bad_Request_Model from "../model/Bad_Request_Model";

import Logo from "../assets/chatai-logo-v3-preview.png"; // Chat AI logo
import ResponseItem from "./Markdown/ResponseItem";
import Help_Model_Custom from "../model/Help_Model_Custom";
import Help_model_Arcanas from "../model/Help_model_Arcanas";
import Help_Model_System from "../model/Help_Model_System";
import Help_Model_Tpop from "../model/Help_Model_Tpop";
import Clear_History_Model from "../model/Clear_History_Model";
import Share_Settings_Model from "../model/Share_Settings_Model";
import {
  addConversation,
  selectConversations,
  setCurrentConversation,
  updateConversation,
} from "../Redux/reducers/conversationsSlice";
import { useToast } from "../hooks/useToast";
import ArcanaContainer from "./Arcanas/ArcanaContainer";

const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

const getStatusColor = (status) => {
  switch (status) {
    case "ready":
      return "limegreen";
    case "loading":
      return "orange";
    case "offline":
      return "grey";
    default:
      return "red";
  }
};

function Prompt({ modelSettings, modelList, onModelChange }) {
  const { t, i18n } = useTranslation();
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const location = useLocation();
  const navigate = useNavigate();
  const hasProcessedSettings = useRef(false);
  const hasProcessedImport = useRef(false);
  const hasProcessedArcana = useRef(false);
  const { notifySuccess, notifyError } = useToast();

  // Redux State and Dispatch
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { conversationId } = useParams();

  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const countClose = useSelector((state) => state.count);
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );
  const currentConversation = useSelector((state) =>
    state.conversations.conversations.find((conv) => conv.id === conversationId)
  );

  const [localState, setLocalState] = useState({
    prompt: "",
    responses: [],
    conversation: [],
    settings: {
      model: "",
      model_api: "",
      temperature: null,
      top_p: null,
      systemPrompt: "",
    },
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
    },
    arcana: {
      id: "",
      key: "",
    },
  });

  useEffect(() => {
    if (conversationId && currentConversation) {
      dispatch(setCurrentConversation(conversationId));
      setLocalState({
        prompt: currentConversation.prompt,
        responses: currentConversation.responses,
        conversation: currentConversation.conversation,
        settings: { ...currentConversation.settings },
        exportOptions: { ...currentConversation.exportOptions },
        dontShow: { ...currentConversation.dontShow },
        arcana: { ...currentConversation.arcana },
      });
    }
  }, [conversationId, currentConversation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentConversation) {
        dispatch(
          updateConversation({
            id: conversationId,
            updates: {
              ...localState,
              lastModified: new Date().toISOString(),
            },
          })
        );
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localState, currentConversation]);

  const updateLocalState = (updates) => {
    setLocalState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const updateSettings = (settingUpdates) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...settingUpdates,
      },
    }));
  };

  //Theme for toast
  let toastClass = isDarkModeGlobal ? "dark-toast" : "light-toast";

  // Language list for speech recognition
  const languageMap = {
    en: "en-US", // English
    de: "de-DE", // German
  };

  // All state variables
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showModel, setShowModel] = useState(true);
  const [showModelSession, setShowModelSession] = useState(false);
  const [showBadRequest, setShowBadRequest] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [showMicModel, setShowMicModel] = useState(false);
  const [showCustomHelpModel, setShowCustomHelpModel] = useState(false);
  const [showTpopHelpModel, setShowTpopHelpModel] = useState(false);
  const [showSystemHelpModel, setShowSystemHelpModel] = useState(false);
  const [showArcanasHelpModel, setShowArcanasHelpModel] = useState(false);
  const [showCusModel, setShowCusModel] = useState(false);
  const [showFileModel, setShowFileModel] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [count, setCount] = useState(countClose);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [direction, setDirection] = useState("down");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [isHovering, setHovering] = useState(false);
  const [isHoveringTpop, setHoveringTpop] = useState(false);
  const [showHistoryModel, setShowHistoryModel] = useState(false);
  const [shareSettingsModel, setShareSettingsModel] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");
  // Computed properties using useMemo
  const currentModel = useMemo(
    () => modelList.find((m) => m.name === modelSettings.model),
    [modelList, modelSettings.model]
  );

  const isImageSupported = useMemo(
    () => currentModel?.input.includes("image") || false,
    [currentModel]
  );

  const modelStatus = useMemo(
    () => ({
      color: currentModel ? getStatusColor(currentModel.status) : "red",
    }),
    [currentModel]
  );
  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen) // Accessing dark mode state from Redux store
  );
  const hiddenFileInput = useRef(null);
  const hiddenFileInputImage = useRef(null);
  const hiddenFileInputJSON = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const textareaRefs = useRef([]);
  const containerRefs = useRef([]);

  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const lastScrollPosition = useRef(0);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isLoading = loading || loadingResend;

  const handleScroll = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop;

    setShowScrollButton(distanceFromBottom > 100);
    if (Math.abs(scrollTop - lastScrollPosition.current) > 10) {
      setUserScrolled(distanceFromBottom > 100);
      lastScrollPosition.current = scrollTop;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => container?.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!userScrolled && messagesEndRef.current) {
      const behavior = isLoading ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, [localState.responses, isLoading, userScrolled]);

  useEffect(() => {
    if (localState.responses.length === 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [localState.responses.length]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setUserScrolled(false);
      setShowScrollButton(false);
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      // Reset height to allow proper scrollHeight calculation
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;

      // Calculate new height
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      // Set new height
      textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  // Adjust the height function to accept an index
  const adjustHeightRefs = (index) => {
    if (textareaRefs.current[index]) {
      const textarea = textareaRefs.current[index];
      textarea.style.height = `${MIN_HEIGHT}px`; // Reset height
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  // Add effect to handle initial content and updates for each textarea
  useEffect(() => {
    // Find the active textarea and adjust its height
    if (editingIndex !== null) {
      adjustHeightRefs(editingIndex);
    }
  }, [editedText, editingIndex]);

  // Onchange function for textarea
  const handleChange = (event) => {
    updateLocalState({ prompt: event.target.value });
    adjustHeight();
  };

  // All useEffects
  useEffect(() => {
    adjustHeight();
  }, [localState.prompt, editedText]);

  // If copied icon is shown, revert it back to copy icon after 3 seconds
  useEffect(() => {
    let timer;
    if (copied) {
      timer = setTimeout(() => {
        setCopied(false);
      }, 1000);
    }

    // Cleanup function
    return () => clearTimeout(timer);
  }, [copied]); // Dependency array, makes the effect only run when "copied" updates

  // Detect if there's enough space below and adjust direction accordingly
  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDirection(spaceBelow > spaceAbove ? "down" : "up");
    }
  }, [isOpen]);

  useEffect(() => {
    // If copied icon is shown, revert it back to copy icon after 3 seconds
    let timer;
    if (copied) {
      timer = setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  }, []);

  // useEffect for theme
  useEffect(() => {
    const root = window.document.documentElement;
    // Add or remove 'dark' class to root element based on dark mode state
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]); // Run this effect when isDarkMode changes

  useEffect(() => {
    const handleOutsideClick = (event) => {
      // Iterate over all responses to check if the click was outside any textarea or container
      localState.responses.forEach((_, index) => {
        handleClickOutside(event, index);
      });
    };

    // Attach event listener when editing starts
    if (isEditing) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    // Clean up the event listener when editing stops or on unmount
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEditing, localState.responses]);

  // Function to focus the textarea for a given index
  const focusTextArea = (index) => {
    if (textareaRefs.current[index]) {
      textareaRefs.current[index].focus();
    }
    setIsEditing(true);
  };

  // Function to detect clicks outside the textarea and container for a given index
  const handleClickOutside = (event, index) => {
    if (
      containerRefs.current[index] &&
      !containerRefs.current[index].contains(event.target) &&
      textareaRefs.current[index] !== event.target // Ensure it's not the textarea itself
    ) {
      handleCloseClick(index); // Call handleCloseClick for specific index
      setIsEditing(false);
    }
  };

  async function getRes(updatedConversation) {
    setLoading(true);

    const imageSupport = modelList.some(
      (modelX) =>
        modelX.name === localState.settings.model &&
        modelX.input.includes("image")
    );

    // Remove image part from the conversation if model doesn't support images
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

  // Handles aborting fetch request
  const handleAbortFetch = () => {
    abortFetch(notifyError);
    setIsSubmitting(false);
    setLoading(false);
  };

  // Handle resending the request for a specific response
  const handleResendClick = async (index) => {
    setLoadingResend(true);

    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      setLoadingResend(false);
      return;
    }

    const currentPrompt = localState.responses[index]?.prompt;
    if (!currentPrompt || currentPrompt.trim() === "") {
      notifyError("Invalid or empty prompt at the specified index.");
      setLoadingResend(false);
      return;
    }
    let imageFiles = [];

    if (localState.responses[index]?.images?.length > 0) {
      imageFiles = localState.responses[index]?.images;
    }

    // Update conversation and responses
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

    // Remove image part from the conversation if model doesn't support images
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

  // Handle editing a prompt
  const handleEditClick = (index, prompt) => {
    setEditingIndex(index);
    setEditedText(prompt);
    setTimeout(() => adjustHeight(index), 0);
  };

  // Save the edited prompt and resend the request
  const handleSave = async (index) => {
    setLoadingResend(true);

    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      setLoadingResend(false);
      return;
    }

    if (!editedText || !editedText.trim()) {
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

    // Remove image part from the conversation if model doesn't support images
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

  // Handle close editing a prompt
  const handleCloseClick = (index) => {
    if (editingIndex === index) {
      setEditingIndex(null); // Only close the currently edited item
    }
  };

  // Submit handler
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Return if prompt is empty or whitespace
    if (localState.prompt.trim() === "") return;

    SpeechRecognition.stopListening();
    resetTranscript();

    let newConversation;

    // Handle files with images
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

    // Update state and pass the new conversation to getRes
    setLocalState((prevState) => ({
      ...prevState,
      conversation: newConversation,
    }));

    setIsSubmitting(true);
    await getRes(newConversation);
  };

  const convertBase64ArrayToImageList = (base64Array) => {
    const imageFileList = base64Array.map((item, index) => {
      if (
        item.type === "image_url" &&
        item.image_url.url.startsWith("data:image")
      ) {
        const base64Data = item.image_url.url;
        // Extract the name from the base64 string or assign a default name
        const fileName = `image_${index + 1}`; // You can customize how to generate names if needed
        const fileSize = atob(base64Data.split(",")[1]).length; // Approximate size calculation

        return {
          name: fileName,
          type: "image",
          size: fileSize,
          text: base64Data, // The base64 string is what you use as "text"
        };
      }
      return null;
    });

    return imageFileList.filter(Boolean); // Remove any null items
  };

  // Handles retrying the conversation
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
      adjustHeight(); // Adjust height after refilling the textarea
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

  // Handles retrying the conversation
  const handleRetryError = (index, e) => {
    e.preventDefault();

    if (index < 0 || index >= localState.responses.length) {
      notifyError("Something went wrong");
      return;
    }

    let tempPrompt = localState.responses[index].prompt;

    setLocalState((prevState) => ({
      ...prevState,
      prompt: tempPrompt,
    }));

    let newArray = [...localState.conversation];
    newArray.splice(index * 2 + 1, 2); // index*2 + 1 because the conversation array is twice as large as responses array and also we want to keep "system" attribute unaffected

    setLocalState((prevState) => ({
      ...prevState,
      responses: prevState.responses.filter((_, i) => i !== index),
    }));
    setLocalState((prevState) => {
      const newResponses = [...prevState.responses];
      newResponses.splice(index, 1);

      return {
        ...prevState,
        prompt: tempPrompt,
        responses: newResponses,
      };
    });
    SpeechRecognition.stopListening();
    resetTranscript();

    if (selectedFiles.length > 0) {
      const textFiles = selectedFiles.filter((file) => file.type !== "image"); // filter out image files
      const imageFiles = selectedFiles.filter((file) => file.type === "image"); // filter image files

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
      setLocalState((prevState) => ({
        ...prevState,
        conversation: [
          ...prevState.conversation,
          { role: "user", content: newPromptContent },
        ],
      }));

      setIsSubmitting(true);
    } else {
      setLocalState((prevState) => ({
        ...prevState,
        conversation: [
          ...prevState.conversation,
          { role: "user", content: localState.prompt },
        ],
      }));
      setIsSubmitting(true);
    }
    setLocalState((prevState) => ({
      ...prevState,
      conversation: newArray,
    }));
    setIsSubmitting(true);
  };

  // Handle model change
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };

  function formatFileSize(bytes) {
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  const formatCSVText = (csvText) => {
    const rows = csvText.split("\n");
    const formattedRows = rows.map((row) => row.split(",").join(" | "));
    return formattedRows.join("\n");
  };

  // Handles changing files
  const handleFilesChange = async (e) => {
    try {
      const textFiles = Array.from(e.target.files).filter(
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

  // Handles changing image files
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

      // Loop through clipboard items to find image files
      for (const item of clipboardItems) {
        if (item.type.startsWith("image/")) {
          imageItems.push(item.getAsFile());
        }
      }

      // If there are images, handle them similar to the file input
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
    if (!isImageSupported) return; // Guard clause to check if image support is enabled
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

  // Helper function to read file as base64
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handles clicking on the file icon
  const handleClick = () => {
    hiddenFileInput.current.value = null; // Clear the input field prior to previous selections
    hiddenFileInput.current.click();
  };

  // Handles clicking on the Image file icon
  const handleClickImage = () => {
    hiddenFileInputImage.current.value = null; // Clear the input field prior to previous selections
    hiddenFileInputImage.current.click();
  };

  // Handles changing JSON files
  const handleFilesChangeJSON = async (e) => {
    try {
      const selectedFile = e.target.files[0];

      // Check if the file is selected and is of correct type
      if (!selectedFile) {
        notifyError("No file selected.");
        return;
      }

      if (selectedFile.type !== "application/json") {
        notifyError("Please select a valid JSON file.");
        return;
      }

      const reader = new FileReader();

      // Handle FileReader error
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
                  // Handle case where content contains multiple types (e.g., text and image)
                  let textContent = "";

                  userContent.forEach((item) => {
                    if (item.type === "text") {
                      textContent += item.text + "\n"; // Combine text content if multiple text entries
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
                    prompt: textContent.trim(), // Trim to avoid extra newlines
                    images: images,
                    response: parsedData[i + 1]?.content,
                  });
                } else {
                  // Handle the case where content is plain text
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
            // Handle the case where parsedData is an object with a "messages" attribute
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
            // Notify the user about the invalid structure
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

  // Handles clicking on the JSON file icon
  const handleClickJSON = () => {
    hiddenFileInputJSON.current.value = null; // Clear the input field prior to previous selections
    hiddenFileInputJSON.current.click();
  };

  // Removes a file from selected files
  const removeFile = (index) => {
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  // Reads a file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Exports conversation to a file
  const exportFile = (value) => {
    // setShowFileModel(true); // Uncomment if you need to show a model before export
    if (value === "json") {
      exportJSON(localState.conversation);
    } else if (value === "pdf") {
      exportPDF(localState.conversation);
    } else if (value === "text") {
      exportTextFile(localState.conversation);
    }
  };

  // Function to generate a consistent file name
  const generateFileName = (extension) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `chat-ai-${year}-${month}-${day}-${hour}${minute}${second}.${extension}`;
  };

  // Function to export conversation as a text file
  const exportTextFile = (conversation) => {
    // Start with a copy of the conversation
    let exportData = [...conversation];

    // Update system message with latest system prompt
    const systemMessageIndex = exportData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      exportData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    // Convert conversation JSON to a formatted string
    const textContent = exportData
      .map((msg) => {
        let contentString = `${msg.role.toUpperCase()}: `;

        // Check if content is an array (i.e., contains text and image types)
        if (Array.isArray(msg.content)) {
          msg.content.forEach((item) => {
            if (item.type === "text") {
              contentString += `${item.text}\n`; // Add text part
            } else if (item.type === "image_url") {
              if (localState.exportOptions.exportImage) {
                contentString += "[Image]\n"; // Add image placeholder if exportImage is true
              }
            }
          });
        } else {
          // For text-only content
          contentString += msg.content;
        }

        return contentString;
      })
      .join("\n\n");

    let finalTextContent = textContent;

    if (localState.exportOptions.exportSettings) {
      // Append model information at the end of the text file
      const additionalText = `\n\nSettings used\nmodel-name: ${
        localState.settings.model
      }\nmodel: ${localState.settings.model_api}\ntemperature: ${
        localState.settings.temperature
      }\ntop_p: ${localState.settings.top_p}${
        localState.exportOptions.exportArcana
          ? `\nArcana: {\n  id: ${localState.arcana.id},\n  key: ${localState.arcana.key}\n}`
          : ""
      }`;
      finalTextContent += additionalText;
    }

    // Create a blob from the final string
    const blob = new Blob([finalTextContent], { type: "text/plain" });

    // Create a link element
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = generateFileName("txt"); // Set the consistent file name

    // Trigger the download
    link.click();

    // Clean up the object URL
    URL.revokeObjectURL(link.href);
  };

  // Exports conversation to a JSON file
  const exportJSON = (conversation) => {
    try {
      // Start with a copy of the conversation
      let exportData = [...conversation];

      // Update system message with latest system prompt
      const systemMessageIndex = exportData.findIndex(
        (msg) => msg.role === "system"
      );
      if (systemMessageIndex !== -1) {
        exportData[systemMessageIndex] = {
          role: "system",
          content: localState.settings.systemPrompt,
        };
      }

      // Continue with the rest of the export logic
      if (!localState.exportOptions.exportImage) {
        exportData = exportData.map((msg) => {
          if (Array.isArray(msg.content)) {
            let filteredContent = msg.content
              .filter((item) => item.type === "text")
              .map((item) => item.text)
              .join("\n");

            return { ...msg, content: filteredContent };
          }
          return msg;
        });
      }

      if (localState.exportOptions.exportSettings) {
        const settingsObject = {
          "model-name": localState.settings.model,
          model: localState.settings.model_api,
          temperature: localState.settings.temperature,
          top_p: localState.settings.top_p,
          ...(localState.exportOptions.exportArcana && {
            arcana: {
              id: localState.arcana.id,
              key: localState.arcana.key,
            },
          }),
        };

        exportData = { ...settingsObject, messages: exportData };
      }

      const content = JSON.stringify(exportData, null, 2);
      let file = new Blob([content], { type: "application/json" });
      let a = document.createElement("a");
      a.download = generateFileName("json");
      a.href = URL.createObjectURL(file);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      notifySuccess("Chat exported successfully");
    } catch (error) {
      notifyError("An error occurred while exporting to JSON: ", error);
    }
  };

  // Function to export conversation as a PDF file
  const exportPDF = async (conversation) => {
    const doc = new jsPDF();
    doc.setProperties({
      title: "CHAT AI Conversation",
      subject: "History",
      author: "CHAT-AI",
      keywords: "LLM Generated",
      creator: "LLM",
    });
    doc.setFont("helvetica");

    // Define colors as constants for consistency
    const COLORS = {
      DEFAULT: [0, 0, 0], // Black
      HEADER_DATE: [150, 150, 150], // Gray for date
      ROLE: [0, 102, 204], // Blue for role names
    };

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 7;
    let y = margin;
    const headerHeight = 25;

    const addHeader = (isFirstPage) => {
      y = margin;
      if (isFirstPage) {
        doc.addImage(Logo, "PNG", margin, margin, 20, 10);
      }
      const date = new Date().toLocaleDateString();
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.HEADER_DATE);
      doc.text(date, pageWidth - margin - 5, margin + 10, { align: "right" });
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
      y = headerHeight + 10;
    };

    const addPageNumbers = () => {
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.DEFAULT);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
          align: "center",
        });
      }
    };

    const resetTextStyle = () => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.DEFAULT);
    };

    const addNewPageIfNeeded = (spaceNeeded) => {
      if (y + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        addHeader(false);
        resetTextStyle(); // Reset text style after new page
      }
    };

    // Initialize the PDF
    addHeader(true);
    resetTextStyle();

    // Process conversation
    let conversationData = [...conversation];

    // Update system message with latest system prompt
    const systemMessageIndex = conversationData.findIndex(
      (msg) => msg.role === "system"
    );
    if (systemMessageIndex !== -1) {
      conversationData[systemMessageIndex] = {
        role: "system",
        content: localState.settings.systemPrompt,
      };
    }

    if (!localState.exportOptions.exportImage) {
      conversationData = conversationData.map((entry) => {
        if (Array.isArray(entry.content)) {
          const filteredContent = entry.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n");
          return { ...entry, content: filteredContent };
        }
        return entry;
      });
    }

    // Render conversation content
    for (const entry of conversationData) {
      addNewPageIfNeeded(lineHeight * 2);

      // Role header
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.ROLE);
      doc.text(`${entry.role}:`, margin, y);
      y += lineHeight;

      // Reset to default style for content
      resetTextStyle();

      if (typeof entry.content === "string") {
        if (entry.content.includes("```")) {
          // Handle code blocks
          const parts = entry.content.split(/(```[\s\S]+?```)/);
          for (const part of parts) {
            if (part.startsWith("```")) {
              const [, language, code] =
                part.match(/```(\w+)?\n([\s\S]+?)```/) || [];
              if (code) {
                const codeLines = code.trim().split("\n");
                addNewPageIfNeeded(lineHeight * (codeLines.length + 2));

                doc.text(language || "Code:", margin, y);
                y += lineHeight * 0.5;

                doc.setFillColor(240, 240, 240);
                doc.rect(
                  margin,
                  y,
                  contentWidth,
                  lineHeight * codeLines.length,
                  "F"
                );
                doc.setFont("Courier", "normal");
                codeLines.forEach((line, index) => {
                  doc.text(line, margin + 5, y + 5 + index * lineHeight);
                });
                y += lineHeight * (codeLines.length + 0.5);
                resetTextStyle(); // Reset after code block
              }
            } else {
              // Normal text
              const lines = doc.splitTextToSize(part, contentWidth);
              lines.forEach((line) => {
                addNewPageIfNeeded(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
              });
            }
          }
        } else {
          // Regular text content
          const lines = doc.splitTextToSize(entry.content, contentWidth);
          lines.forEach((line) => {
            addNewPageIfNeeded(lineHeight);
            doc.text(line, margin, y);
            y += lineHeight;
          });
        }
      } else if (
        Array.isArray(entry.content) &&
        localState.exportOptions.exportImage
      ) {
        entry.content.forEach((item) => {
          if (item.type === "text") {
            const lines = doc.splitTextToSize(item.text, contentWidth);
            lines.forEach((line) => {
              addNewPageIfNeeded(lineHeight);
              doc.text(line, margin, y);
              y += lineHeight;
            });
          } else if (item.type === "image_url") {
            addNewPageIfNeeded(lineHeight + 60);
            if (item.image_url.url.startsWith("data:image")) {
              doc.addImage(item.image_url.url, "JPEG", margin, y, 50, 50);
              y += 60;
            } else {
              doc.text("[Invalid image format]", margin, y);
              y += lineHeight;
            }
          }
        });
      } else {
        addNewPageIfNeeded(lineHeight);
        doc.text("Content unavailable", margin, y);
        y += lineHeight;
      }

      y += lineHeight;
    }

    // Add settings information
    if (localState.exportOptions.exportSettings) {
      addNewPageIfNeeded(
        lineHeight * (localState.exportOptions.exportArcana ? 7 : 5)
      );
      y += lineHeight * 2;

      resetTextStyle();
      doc.text(`Settings used`, margin, y);
      y += lineHeight;
      doc.text(`model-name: ${modelSettings.model}`, margin, y);
      y += lineHeight;
      doc.text(`model: ${localState.settings.model_api}`, margin, y);
      y += lineHeight;
      doc.text(`temperature: ${localState.settings.temperature}`, margin, y);
      y += lineHeight;
      doc.text(`top_p: ${localState.settings.top_p}`, margin, y);
      y += lineHeight;

      if (localState.exportOptions.exportArcana) {
        doc.text(`Arcana: {`, margin, y);
        y += lineHeight;
        doc.text(`  id: ${localState.arcana.id}`, margin, y);
        y += lineHeight;
        doc.text(`  key: ${localState.arcana.key}`, margin, y);
        y += lineHeight;
        doc.text(`}`, margin, y);
        y += lineHeight;
      }
    }
    // Add page numbers and save
    addPageNumbers();
    doc.save(generateFileName("pdf"));
  };

  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt); // Toggle dark mode state
  };

  // Handles changing the selected model
  const toggleOpen = () => setIsOpen(!isOpen);

  const handleChangeTemp = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ temperature: numVal });
  };

  const handleChangeTpop = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ top_p: numVal });
  };

  const resetDefault = () => {
    let updatedConversation = localState.conversation.map((item) => {
      if (item.role === "system") {
        return { ...item, content: "You are a helpful assistant" };
      } else {
        return item;
      }
    });
    setLocalState((prevState) => ({
      ...prevState,
      conversation: updatedConversation,
      settings: {
        ...prevState.settings,
        temperature: 0.5,
        top_p: 0.5,
      },
    }));
    updateSettings({ systemPrompt: "You are a helpful assistant" });
  };

  const handleClearHistory = () => {
    if (localState.dontShow.dontShowAgain) {
      clearHistory();
    } else {
      setShowHistoryModel(true);
    }
  };

  const clearHistory = () => {
    setLocalState((prevState) => ({
      ...prevState,
      responses: [],
      conversation:
        prevState.conversation.length > 0
          ? [prevState.conversation[0]]
          : prevState.conversation,
    }));

    setShowHistoryModel(false);
    notifySuccess("History cleared");
  };

  const handleInstructionsChange = (event) => {
    const { value } = event.target;

    // Clear error when user starts typing
    if (systemPromptError) {
      setSystemPromptError("");
    }

    setLocalState((prevState) => ({
      ...prevState,
      settings: {
        ...prevState.settings,
        systemPrompt: value,
      },
    }));
  };

  const validateSystemPrompt = () => {
    if (!localState.settings.systemPrompt?.trim()) {
      setSystemPromptError(t("description.custom6")); // Your error message
      return false;
    }
    return true;
  };

  useEffect(() => {
    const handleSettings = async () => {
      const encodedSettings = searchParams.get("settings");

      if (
        encodedSettings &&
        location.pathname === "/chat" &&
        !hasProcessedSettings.current
      ) {
        try {
          hasProcessedSettings.current = true;

          // Try to decode the settings
          const decodedSettings = atob(encodedSettings);
          const settings = JSON.parse(decodedSettings);

          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            setLocalState((prev) => ({
              ...prev,
              settings: {
                systemPrompt: settings.systemPrompt
                  ? decodeURIComponent(settings.systemPrompt)
                  : "You are a helpful assistant",
                model: settings.model_name || "Meta LLaMA 3.1 8B Instruct",
                model_api: settings.model || "meta-llama-3.1-8b-instruct",
                temperature: settings.temperature || 0.5,
                top_p: settings.top_p || 0.5,
              },
              ...(settings.arcana && {
                arcana: {
                  id: settings.arcana.id,
                  key: settings.arcana.key,
                },
              }),
            }));

            dispatch(
              updateConversation({
                id: newId,
                updates: {
                  settings: {
                    systemPrompt: settings.systemPrompt
                      ? decodeURIComponent(settings.systemPrompt)
                      : "You are a helpful assistant",
                    model: settings.model_name || "Meta LLaMA 3.1 8B Instruct",
                    model_api: settings.model || "meta-llama-3.1-8b-instruct",
                    temperature: settings.temperature ?? 0.5,
                    top_p: settings.top_p ?? 0.5,
                  },
                  ...(settings.arcana && {
                    arcana: {
                      id: settings.arcana.id,
                      key: settings.arcana.key,
                    },
                  }),
                },
              })
            );

            // Navigate to new conversation
            navigate(`/chat/${newId}`, { replace: true });
          }
        } catch (error) {
          console.error("Error applying shared settings:", error);
          notifyError(
            "Invalid settings in shared link. Redirecting to default chat."
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
          window.location.reload();
        }
      }
    };

    if (conversations.length > 0) {
      handleSettings();
    }
  }, [searchParams, location.pathname, conversations.length]);

  useEffect(() => {
    const handleImport = async () => {
      const importUrl = searchParams.get("import");

      if (
        importUrl &&
        location.pathname === "/chat" &&
        !hasProcessedImport.current
      ) {
        try {
          hasProcessedImport.current = true;
          const response = await fetch(importUrl);

          if (!response.ok) {
            if (response.status >= 400 && response.status < 500) {
              throw new Error("Client Error: Failed to fetch the JSON file.");
            } else if (response.status >= 500) {
              throw new Error("Server Error: Please try again later.");
            } else {
              throw new Error("Unknown Error: Could not fetch the JSON file.");
            }
          }

          const parsedData = await response.json();
          const action = dispatch(addConversation());
          const newId = action.payload?.id;

          if (newId) {
            if (Array.isArray(parsedData.messages)) {
              // Handle object with messages format
              let newArray = [];
              for (let i = 0; i < parsedData.messages.length; i++) {
                if (
                  parsedData.messages[i].role === "user" &&
                  parsedData.messages[i + 1]?.role === "assistant"
                ) {
                  newArray.push({
                    prompt: parsedData.messages[i].content,
                    response: parsedData.messages[i + 1]?.content,
                  });
                }
              }

              const systemMessage = parsedData.messages.find(
                (message) => message.role === "system"
              );

              dispatch(
                updateConversation({
                  id: newId,
                  updates: {
                    title: parsedData.messages[1].content,
                    conversation: parsedData.messages,
                    responses: newArray,
                    settings: {
                      systemPrompt:
                        systemMessage?.content || "You are a helpful assistant",
                      model:
                        parsedData["model-name"] ||
                        parsedData.model ||
                        "Meta LLaMA 3.1 8B Instruct",
                      model_api:
                        parsedData.model || "meta-llama-3.1-8b-instruct",
                      temperature: parsedData.temperature || 0.5,
                      top_p: parsedData.top_p || 0.5,
                    },
                    ...(parsedData.arcana && {
                      arcana: {
                        id: parsedData.arcana.id,
                        key: parsedData.arcana.key,
                      },
                    }),
                  },
                })
              );
            } else if (Array.isArray(parsedData)) {
              // Handle array format
              let newArray = [];
              for (let i = 0; i < parsedData.length; i++) {
                if (
                  parsedData[i].role === "user" &&
                  parsedData[i + 1]?.role === "assistant"
                ) {
                  newArray.push({
                    prompt: parsedData[i].content,
                    response: parsedData[i + 1]?.content,
                  });
                }
              }

              const systemMessage = parsedData.find(
                (message) => message.role === "system"
              );

              dispatch(
                updateConversation({
                  id: newId,
                  updates: {
                    title: parsedData[1].content,
                    conversation: parsedData,
                    responses: newArray,
                    settings: {
                      systemPrompt:
                        systemMessage?.content || "You are a helpful assistant",
                      model: "Meta LLaMA 3.1 8B Instruct",
                      model_api: "meta-llama-3.1-8b-instruct",
                      temperature: 0.5,
                      top_p: 0.5,
                    },
                  },
                })
              );
            }

            // Navigate after update
            navigate(`/chat/${newId}`, { replace: true });
            notifySuccess("Chat imported successfully");
          }
        } catch (error) {
          if (error.name === "TypeError") {
            notifyError("Network Error: Unable to reach the server.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else if (error.message.includes("Client Error")) {
            notifyError("Client Error: The provided link might be incorrect.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else if (error.message.includes("Server Error")) {
            notifyError("Server Error: Please try again later.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          } else {
            notifyError(error.message || "An unexpected error occurred.");
            navigate(`/chat/${currentConversationId}`, { replace: true });
            window.location.reload();
          }
          console.error("Error:", error);
          navigate(`/chat/${currentConversationId}`, { replace: true });
          window.location.reload();
        }
      }
    };

    if (conversations.length > 0) {
      handleImport();
    }
  }, [searchParams, location.pathname, conversations.length]);

  useEffect(() => {
    const handleArcanaParams = async () => {
      const arcanaID = searchParams.get("arcana");
      const arcanaKey = searchParams.get("arcana_key");

      if (
        arcanaID &&
        arcanaKey &&
        location.pathname === "/chat" &&
        !hasProcessedArcana.current
      ) {
        try {
          hasProcessedArcana.current = true;

          setLocalState((prev) => ({
            ...prev,
            arcana: {
              id: decodeURIComponent(arcanaID),
              key: decodeURIComponent(arcanaKey),
            },
            settings: {
              ...prev.settings,
              temperature: 0,
              top_p: 0,
            },
          }));
          const currentConversation = conversations.find(
            (conv) => conv.id === currentConversationId
          );
          dispatch(
            updateConversation({
              id: currentConversationId,
              updates: {
                arcana: {
                  id: decodeURIComponent(arcanaID),
                  key: decodeURIComponent(arcanaKey),
                },
                settings: {
                  ...currentConversation.settings,
                  temperature: 0,
                  top_p: 0,
                },
              },
            })
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
        } catch (error) {
          console.error("Error processing arcana parameters:", error);
          hasProcessedArcana.current = false;
          notifyError(
            "Invalid arcana parameters in shared link. Redirecting to default chat."
          );
          navigate(`/chat/${currentConversationId}`, { replace: true });
        }
      }
    };

    if (conversations.length > 0) {
      handleArcanaParams();
    }
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
  ]);

  const handleShareSettingsModel = () => {
    if (localState.dontShow.dontShowAgainShare) {
      handleShareSettings();
    } else {
      setShareSettingsModel(true);
    }
  };

  const handleShareSettings = () => {
    if (!localState.settings.systemPrompt) {
      notifyError("System prompt is missing");
      return;
    }

    try {
      // Build the settings object with validation
      const settings = {
        systemPrompt: encodeURIComponent(localState.settings.systemPrompt),
        model_name: localState.settings.model,
        model: localState.settings.model_api,
        temperature:
          localState.settings.temperature !== undefined &&
          localState.settings.temperature !== null
            ? Number(localState.settings.temperature)
            : null,
        top_p:
          localState.settings.top_p !== undefined &&
          localState.settings.top_p !== null
            ? Number(localState.settings.top_p)
            : null,
        ...(localState.exportOptions.exportArcana && {
          arcana: {
            id: localState.arcana.id,
            key: localState.arcana.key,
          },
        }),
      };

      // Validate the settings object
      if (Object.values(settings).some((value) => value === undefined)) {
        throw new Error("Invalid settings detected");
      }

      // Convert settings object to a Base64-encoded string
      const settingsString = JSON.stringify(settings);
      const encodedSettings = btoa(settingsString);

      // Get the base URL dynamically and always use /chat path
      const baseURL = window.location.origin;
      const url = `${baseURL}/chat?settings=${encodedSettings}`;

      // Copy to clipboard
      navigator.clipboard
        .writeText(url)
        .then(() => {
          notifySuccess("URL copied successfully");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          notifyError("Failed to copy URL to clipboard");
        });

      setShareSettingsModel(false);
    } catch (error) {
      console.error("Error generating settings URL:", error);
      notifyError("Failed to generate settings URL");
    }
  };

  return (
    <>
      <div className="flex mobile:flex-col flex-row h-full sm:justify-between relative">
        {/* Section 1 */}
        <div className="flex flex-col items-center mobile:w-full w-[60%] h-full gap-3 sm:justify-between relative p-2 bg-bg_light dark:bg-bg_dark">
          {/* Response section */}
          <div
            className={`desktop:max-h-full flex-1 min-h-0 overflow-y-auto flex flex-col relative w-[90%] mobile:w-full border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark`}
          >
            {/* Note model */}
            {showModel && count < 3 ? (
              <div className="w-[calc(100%-16px)] sticky select-none m-2 h-fit bg-white dark:bg-black p-2 rounded-2xl flex justify-between items-center border dark:border-border_dark shadow-lg dark:shadow-dark">
                <p className="dark:text-white text-black">
                  <Trans i18nKey="description.note1"></Trans>
                  <Link
                    to={
                      "https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
                    }
                    target="_blank"
                    className="text-tertiary"
                  >
                    &nbsp;<Trans i18nKey="description.note6"></Trans>&nbsp;
                  </Link>
                  <Trans i18nKey="description.note2"></Trans>
                  <Link
                    to={"https://datenschutz.gwdg.de/services/chatai"}
                    target="_blank"
                    className="text-tertiary"
                  >
                    &nbsp;<Trans i18nKey="description.note3"></Trans>&nbsp;
                  </Link>
                  <Trans i18nKey="description.note4"></Trans>
                  <Link
                    to={"https://gwdg.de/imprint/"}
                    target="_blank"
                    className="text-tertiary"
                  >
                    &nbsp;<Trans i18nKey="description.note5"></Trans>
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
            ) : null}
            {/* Prompt response section */}
            <div
              ref={containerRef}
              className="p-2 flex flex-col gap-2 overflow-y-auto flex-1 relative"
            >
              {localState.responses?.map((res, index) => (
                <div key={index} className={`flex flex-col gap-1`}>
                  <div
                    ref={(el) => (containerRefs.current[index] = el)} // Attach ref to container
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
                              editedText.trim() !== ""
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
                            onClick={() => setEditedText("")} // Clear the edited text
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
                              handleCloseClick(index); // Close the textarea
                              handleSave(index); // Save the edited text
                            }}
                            disabled={loadingResend}
                          >
                            <img
                              className="cursor-pointer h-[25px] w-[25px]"
                              src={send}
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
                            onClick={(e) => handleResendClick(index, e)} // Resend the request for this response
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
                              focusTextArea(index); // Focus on this textarea for editing
                              handleEditClick(index, res.prompt); // Set this response to be edited
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
                  {res?.images?.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto items-center p-3">
                      {res?.images?.map((imageObj, index) => {
                        if (
                          imageObj.type === "image_url" &&
                          imageObj.image_url.url
                        ) {
                          return (
                            <img
                              key={index}
                              src={imageObj.image_url.url}
                              alt="Base64 Image"
                              className="h-[150px] w-[150px] rounded-2xl object-cover"
                            />
                          );
                        }
                        return null; // Handle cases where type or URL might be missing
                      })}
                    </div>
                  ) : null}
                  {/* Render additional response item details */}
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
              <div ref={messagesEndRef} />{" "}
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
              <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl ">
                {/* Clear, Export, Import buttons */}
                <Tooltip text={t("description.clear")}>
                  <button
                    className="h-[30px] w-[30px] cursor-pointer"
                    disabled={loading}
                    onClick={handleClearHistory}
                  >
                    <img
                      className="cursor-pointer h-[25px] w-[25px]"
                      src={clear}
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
                      />
                    </button>
                  </Tooltip>
                </div>
              </div>
            ) : (
              <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-end items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl ">
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
                    />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
          {/* Prompt section */}
          <div className="mobile:w-full flex flex-shrink-0 flex-col w-[90%] dark:text-white text-black mobile:h-fit justify-between sm:overflow-y-auto sm:gap-3 rounded-2xl shadow-bottom dark:shadow-darkBottom bg-bg_light dark:bg-bg_dark">
            <div className="flex flex-col gap-4 w-full">
              <div className="relative select-none border dark:border-border_dark rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark">
                {isImageSupported ? (
                  <div
                    className="drag-drop-container"
                    onDragOver={(e) => e.preventDefault()} // Allow drop by preventing default behavior
                    onDrop={handleDrop}
                  >
                    <textarea
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
                          localState.prompt.trim() !== ""
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
                    ref={textareaRef}
                    className="p-5 outline-none text-xl rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark resize-none overflow-y-auto"
                    value={localState.prompt}
                    name="prompt"
                    placeholder={t("description.placeholder")}
                    rows={1}
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
                        localState.prompt.trim() !== ""
                      ) {
                        event.preventDefault();
                        handleSubmit(event);
                      }
                    }}
                  />
                )}
                <div className="px-3 py-2 w-full h-fit flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
                  {localState.prompt.trim() !== "" ? (
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
                        />
                      </button>
                    </Tooltip>
                    {/* Attach image */}
                    {isImageSupported ? (
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
                          {" "}
                          <button
                            className="h-[30px] w-[30px] cursor-pointer"
                            onClick={handleClickImage}
                            disabled={loading}
                          >
                            <img
                              className="cursor-pointer h-[30px] w-[30px]"
                              src={image_icon}
                            />
                          </button>
                        </Tooltip>
                      </>
                    ) : null}
                    {loading ? (
                      <Tooltip text={t("description.pause")}>
                        <button className="h-[30px] w-[30px] cursor-pointer">
                          <img
                            className="cursor-pointer h-[30px] w-[30px]"
                            src={pause}
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
                          />
                        </button>
                      </Tooltip>
                    ) : localState.prompt !== "" ? (
                      <Tooltip text={t("description.send")}>
                        <button className="h-[30px] w-[30px] cursor-pointer">
                          <img
                            className="cursor-pointer h-[30px] w-[30px]"
                            src={send}
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
        {/* Section 2 */}
        <div className="w-[40%] mobile:w-full p-2 text-tertiary flex flex-col justify-end">
          {/* Files */}
          <div>
            {selectedFiles.length > 0 ? (
              <div className="flex flex-col gap-3 select-none">
                <div className="flex items-center justify-between">
                  <p>
                    <Trans i18nKey="description.file1"></Trans>
                  </p>
                  <p
                    className="text-tertiary cursor-pointer"
                    onClick={() => setSelectedFiles([])}
                  >
                    <Trans i18nKey="description.file2"></Trans>
                  </p>
                </div>

                <ul className="flex flex-col gap-4 overflow-auto max-h-[400px] pb-4">
                  {Array.from(selectedFiles).map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="cursor-pointer flex gap-2 items-center"
                    >
                      {file.type === "image" ? (
                        <img
                          className="h-[30px] w-[30px] rounded-md"
                          src={file.text}
                          alt={file.name}
                        />
                      ) : (
                        <img
                          className="h-[30px] w-[30px]"
                          src={uploaded}
                          alt="uploaded"
                        />
                      )}
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-1 w-full">
                          <p className="overflow-hidden whitespace-nowrap overflow-ellipsis w-[60%]">
                            {file.name}
                          </p>
                          <p className="mx-2"> | </p>
                          <p>{formatFileSize(file.size)}</p>
                        </div>

                        <img
                          src={cross}
                          alt="cross"
                          className="h-[30px] w-[30px]"
                          onClick={() => removeFile(index)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>{" "}
          {/* Panel */}
          <div className="static flex justify-center mobile:absolute bottom-0 w-[calc(100%-12px)] shadow-lg dark:shadow-dark">
            {showAdvOpt ? (
              <div
                className={`transform transition-all duration-300 ${
                  showAdvOpt
                    ? "translate-y-0 opacity-100"
                    : "translate-y-full opacity-0"
                } flex flex-col gap-4 sm:p-6 py-4 px-3 border dark:border-border_dark 
      rounded-2xl shadow-lg dark:shadow-dark bg-white 
      dark:bg-bg_secondary_dark h-fit w-full`}
              >
                {/* Select model */}
                <div className="flex flex-col mobile:hidden gap-4">
                  {/* Select input for model for desktop */}
                  <div className="flex flex-wrap items-center gap-4 select-none">
                    <div className="flex-shrink-0 flex items-center gap-2 min-w-fit">
                      <p className="flex-shrink-0 text-[18px] whitespace-nowrap">
                        <Trans i18nKey="description.choose"></Trans>
                      </p>
                      <img
                        src={help}
                        alt="help"
                        className="h-[20px] w-[20px] cursor-pointer"
                        onClick={() => setShowHelpModel(true)}
                      />
                    </div>

                    {/* Select input */}
                    <div
                      className="relative flex-1 min-w-[200px]"
                      ref={dropdownRef}
                      tabIndex={0}
                      onBlur={() => setIsOpen(false)}
                    >
                      <div
                        className="text-tertiary flex items-center mt-1 cursor-pointer text-[18px] w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
                        onClick={toggleOpen}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                            style={{ backgroundColor: modelStatus.color }}
                          />
                          <div className="text-xl overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                            {modelSettings.model}
                          </div>
                          {isImageSupported && (
                            <img
                              src={image_supported}
                              alt="image_supported"
                              className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mx-2"
                            />
                          )}
                          <img
                            src={dropdown}
                            alt="drop-down"
                            className="h-[30px] w-[30px] cursor-pointer flex-shrink-0"
                          />
                        </div>
                      </div>

                      {isOpen && (
                        <div
                          className={`absolute w-full ${
                            direction === "up" ? "bottom-full" : "top-full"
                          } mt-1 rounded-2xl border-opacity-10 border dark:border-border_dark z-[99] max-h-[200px] overflow-y-auto bg-white dark:bg-black`}
                        >
                          {modelList.map((option, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-2 text-tertiary text-xl w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                index === 0
                                  ? "rounded-t-2xl"
                                  : index === modelList.length - 1
                                  ? "rounded-b-2xl"
                                  : ""
                              }`}
                              onClick={() => handleChangeModel(option)}
                            >
                              <div
                                className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: getStatusColor(
                                    option.status
                                  ),
                                }}
                              />
                              <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {option.name}
                              </div>
                              {option.input.includes("image") && (
                                <img
                                  src={image_supported}
                                  alt="image_supported"
                                  className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-2"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {localState.settings.model
                  .toLowerCase()
                  .includes("external") && (
                  <div className="text-yellow-600 text-sm mb-3 select-none">
                    <Trans i18nKey="description.warning_settings"></Trans>
                  </div>
                )}
                {/* Arcanas */}
                <div className="flex gap-4 w-full items-center">
                  <div className="flex-shrink-0 flex items-center gap-2 select-none">
                    {" "}
                    <p className="text-[18px]">Arcana</p>{" "}
                    <img
                      src={help}
                      alt="help"
                      className="h-[20px] w-[20px] cursor-pointer"
                      onClick={() => setShowArcanasHelpModel(true)}
                    />
                  </div>
                  <ArcanaContainer
                    localState={localState}
                    setLocalState={setLocalState}
                  />
                </div>
                {/* Custom instructions */}
                <div className="">
                  <div className="flex flex-col gap-4 items-center">
                    {localState.arcana.id && localState.arcana.key && (
                      <div className="text-yellow-600 text-sm w-full select-none">
                        <Trans i18nKey="description.warning_arcana"></Trans>
                      </div>
                    )}
                    {/* Temperature slider */}
                    <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                      <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                        <p className="text-[18px]">temp</p>
                        <img
                          src={help}
                          alt="help"
                          className="h-[20px] w-[20px] cursor-pointer"
                          onClick={() => setShowCustomHelpModel(true)}
                        />
                      </div>
                      <div className="w-full">
                        <div className="relative w-full">
                          {/* Labels for guidance */}
                          <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                            <span>Logical</span>
                            <span>Creative</span>
                          </div>

                          {/* Container for tick marks */}
                          <div className="tick-marks-container cursor-pointer">
                            {[...Array(21)].map((_, i) => (
                              <div key={i} className="tick-mark"></div>
                            ))}
                          </div>

                          {/* Slider Input */}
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={localState.settings.temperature}
                            className="slider-input"
                            onChange={(event) =>
                              handleChangeTemp(event.target.value)
                            }
                            onMouseEnter={() => setHovering(true)}
                            onMouseLeave={() => setHovering(false)}
                          />

                          {/* Tooltip Display */}
                          {isHovering && (
                            <output
                              className="slider-tooltip"
                              style={{
                                left: `calc(${
                                  (localState.settings.temperature / 2) * 100
                                }% - 15px)`,
                              }}
                            >
                              {Number(localState.settings.temperature).toFixed(
                                1
                              )}
                            </output>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Top_p slider */}
                    <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                      <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                        <p className="text-[18px]">top_p</p>
                        <img
                          src={help}
                          alt="help"
                          className="h-[20px] w-[20px] cursor-pointer"
                          onClick={() => setShowTpopHelpModel(true)}
                        />
                      </div>
                      <div className="w-full">
                        <div className="relative w-full">
                          {/* Labels for guidance */}
                          <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                            <span>Focused</span>
                            <span>Diverse</span>
                          </div>

                          {/* Container for tick marks */}
                          <div className="tick-marks-container cursor-pointer">
                            {[...Array(20)].map((_, i) => (
                              <div key={i} className="tick-mark"></div>
                            ))}
                          </div>

                          {/* Slider Input */}
                          <input
                            type="range"
                            min="0.05"
                            max="1"
                            step="0.05"
                            value={localState.settings.top_p}
                            className="slider-input"
                            onChange={(event) =>
                              handleChangeTpop(event.target.value)
                            }
                            onMouseEnter={() => setHoveringTpop(true)}
                            onMouseLeave={() => setHoveringTpop(false)}
                          />

                          {/* Tooltip Display */}
                          {isHoveringTpop && (
                            <output
                              className="slider-tooltip"
                              style={{
                                left: `calc(${
                                  ((localState.settings.top_p - 0.05) / 0.95) *
                                  100
                                }% - 15px)`,
                              }}
                            >
                              {Number(localState.settings.top_p).toFixed(2)}
                            </output>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Custom instructions input*/}
                    <div className="w-full flex flex-col gap-4">
                      <div className="flex-shrink-0 flex items-center gap-2 select-none">
                        {" "}
                        <p className="text-[18px]">System prompt</p>{" "}
                        <img
                          src={help}
                          alt="help"
                          className="h-[20px] w-[20px] cursor-pointer"
                          onClick={() => setShowSystemHelpModel(true)}
                        />
                      </div>
                      <div className="w-full relative">
                        <div className="relative z-10">
                          <textarea
                            className={`dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border ${
                              systemPromptError
                                ? "border-red-500"
                                : "dark:border-border_dark"
                            } outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[150px]`}
                            type="text"
                            name="systemPrompt"
                            placeholder={t("description.custom4")}
                            value={localState.settings.systemPrompt}
                            onChange={handleInstructionsChange}
                            onBlur={() => validateSystemPrompt()} // Validate on blur
                          />
                        </div>
                        {systemPromptError && (
                          <p className="text-red-600 text-12-500">
                            {systemPromptError}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Submit button */}
                    <div className="flex flex-wrap justify-left md:justify-end gap-2 md:gap-4 items-center w-full">
                      <div
                        // className="flex gap-2 md:gap-4 items-center justify-center w-full md:w-auto select-none"
                        className="cursor-pointer select-none flex-1 gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit"
                        onClick={toggleAdvOpt} // Click handler to toggle advanced options
                      >
                        {/* Text for large screens */}
                        <p className="hidden desktop:block text-[18px] h-full text-tertiary cursor-pointer">
                          <Trans i18nKey="description.text9"></Trans>
                        </p>
                        {/* Text for small screens */}
                        <p className="block desktop:hidden text-[18px] h-full text-tertiary cursor-pointer">
                          <Trans i18nKey="description.text10"></Trans>
                        </p>
                      </div>

                      {/* Share settings button */}
                      <button
                        className="text-white p-3 bg-green-600 hover:bg-green-550 active:bg-green-700 dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none flex gap-2"
                        type="reset"
                        onClick={() => handleShareSettingsModel()}
                      >
                        {/* Text for large screens */}
                        <div className="hidden desktop:block">
                          <Trans i18nKey="description.custom9"></Trans>
                        </div>
                        {/* Icon for large screens */}
                        <img
                          src={share_icon}
                          alt="share_icon"
                          className="hidden desktop:block h-[20px] w-[20px] cursor-pointer"
                        />
                        {/* Icon for small screens */}
                        <img
                          src={share_icon}
                          alt="share_icon"
                          className="block desktop:hidden h-[30px] w-[30px] cursor-pointer"
                        />
                      </button>

                      {/* Reset default button */}
                      <button
                        className="text-black p-3 bg-bg_reset_default active:bg-bg_reset_default_pressed dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none"
                        type="reset"
                        onClick={resetDefault}
                      >
                        {/* Text for large screens */}
                        <div className="hidden desktop:block">
                          <Trans i18nKey="description.custom7"></Trans>
                        </div>
                        {/* Text for small screens */}
                        <div className="block desktop:hidden">
                          <Trans i18nKey="description.custom10"></Trans>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>{" "}
              </div>
            ) : (
              <div
                className={`transform transition-all duration-300 motion-safe:duration-300
        ${
          showAdvOpt
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-0 opacity-100 scale-100"
        }
        mobile:hidden flex flex-col gap-4 sm:px-6 py-4 px-3 border 
        dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark 
        bg-white dark:bg-bg_secondary_dark h-fit w-full
        ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
              >
                {/* Select model */}
                <div className="sm:flex flex-col hidden gap-4">
                  {/* Select input for model for desktop */}
                  <div className="flex flex-wrap items-center gap-4 select-none">
                    <div className="flex-shrink-0 flex items-center gap-2 min-w-fit">
                      <p className="flex-shrink-0 text-[18px] whitespace-nowrap">
                        <Trans i18nKey="description.choose"></Trans>
                      </p>
                      <img
                        src={help}
                        alt="help"
                        className="h-[20px] w-[20px] cursor-pointer"
                        onClick={() => setShowHelpModel(true)}
                      />
                    </div>

                    {/* Select input */}
                    <div
                      className="relative flex-1 min-w-[200px]"
                      ref={dropdownRef}
                      tabIndex={0}
                      onBlur={() => setIsOpen(false)}
                    >
                      <div
                        className="text-tertiary flex items-center mt-1 cursor-pointer text-[18px] w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
                        onClick={toggleOpen}
                      >
                        {/* Status dot */}
                        <div
                          className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: modelStatus.color }}
                        />

                        {/* Model name */}
                        <div className="mx-2 text-xl overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                          {modelSettings.model}
                        </div>

                        {/* Image support icon */}
                        {isImageSupported && (
                          <img
                            src={image_supported}
                            alt="image_supported"
                            className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mr-2"
                          />
                        )}

                        {/* Dropdown arrow */}
                        <img
                          src={dropdown}
                          alt="drop-down"
                          className="h-[30px] w-[30px] cursor-pointer flex-shrink-0"
                        />
                      </div>

                      {isOpen && (
                        <div
                          className={`absolute w-full ${
                            direction === "up" ? "bottom-full" : "top-full"
                          } mt-1 rounded-2xl border-opacity-10 border dark:border-border_dark z-[99] max-h-[200px] overflow-y-auto bg-white dark:bg-black`}
                        >
                          {modelList.map((option, index) => (
                            <div
                              key={index}
                              className={`flex items-center gap-2 text-tertiary text-xl w-full p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                index === 0
                                  ? "rounded-t-2xl"
                                  : index === modelList.length - 1
                                  ? "rounded-b-2xl"
                                  : ""
                              }`}
                              onClick={() => handleChangeModel(option)}
                            >
                              {/* Status dot */}
                              <div
                                className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: getStatusColor(
                                    option.status
                                  ),
                                }}
                              />

                              {/* Model name */}
                              <div className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">
                                {option.name}
                              </div>

                              {/* Image support icon */}
                              {option.input.includes("image") && (
                                <img
                                  src={image_supported}
                                  alt="image_supported"
                                  className="h-[20px] w-[20px] cursor-pointer flex-shrink-0"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="cursor-pointer select-none flex gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit w-full"
                  onClick={toggleAdvOpt}
                >
                  <p className="text-[18px] h-full text-tertiary">
                    <Trans i18nKey="description.text6"></Trans>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help model for info on changing model */}
      <>{showHelpModel ? <Help_Model showModel={setShowHelpModel} /> : null}</>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showCustomHelpModel ? (
          <Help_Model_Custom showModel={setShowCustomHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showTpopHelpModel ? (
          <Help_Model_Tpop showModel={setShowTpopHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on system prompt */}
      <div className="">
        {showSystemHelpModel ? (
          <Help_Model_System showModel={setShowSystemHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom instructions */}
      <div className="">
        {showArcanasHelpModel ? (
          <Help_model_Arcanas showModel={setShowArcanasHelpModel} />
        ) : null}
      </div>

      {/* Pop-up if microphone permission is not given or denied */}
      <div className="">
        {showMicModel ? <Mic_Model showModel={setShowMicModel} /> : null}
      </div>

      {/* Pop-up for info about custom instructions */}
      <div className="">
        {showCusModel ? (
          <Cutom_Instructions_Model showModel={setShowCusModel} />
        ) : null}
      </div>

      {/* Pop-up  for export file model*/}
      <div className="">
        {showFileModel ? (
          <ExportTypeModel
            arcana={localState.arcana}
            showModel={setShowFileModel}
            exportFile={exportFile}
            conversation={localState.conversation}
            exportSettings={localState.exportOptions.exportSettings}
            exportImage={localState.exportOptions.exportImage}
            exportArcana={localState.exportOptions.exportArcana}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>

      {/* Pop-up  for session expired model*/}
      <div className="">
        {showModelSession ? (
          <Session_Expired showModel={setShowModelSession} />
        ) : null}
      </div>

      {/* Pop-up token limit exceed*/}
      <div className="">
        {showBadRequest ? (
          <Bad_Request_Model showModel={setShowBadRequest} />
        ) : null}
      </div>

      {/* Pop-up clear history*/}
      <div className="">
        {showHistoryModel ? (
          <Clear_History_Model
            showModel={setShowHistoryModel}
            clearHistory={clearHistory}
            dontShowAgain={localState.dontShow.dontShowAgain}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>

      {/* Pop-up share settings*/}
      <div className="">
        {shareSettingsModel ? (
          <Share_Settings_Model
            arcana={localState.arcana}
            exportArcana={localState.exportOptions.exportArcana}
            showModel={setShareSettingsModel}
            handleShareSettings={handleShareSettings}
            dontShowAgainShare={localState.dontShow.dontShowAgainShare}
            setLocalState={setLocalState}
          />
        ) : null}
      </div>
    </>
  );
}

export default Prompt;
