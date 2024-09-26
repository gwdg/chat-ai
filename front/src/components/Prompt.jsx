/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */

// Libraries and Dependencies
import React, { useRef, useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Link, useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Form, Formik, useFormik } from "formik";
import * as yup from "yup"; // Schema validation

// Redux Actions
import {
  setPromptGlobal,
  setModel,
  setResponsesGlobal,
  setConversationGlobal,
  setInstructions,
} from "../Redux/actions";
import {
  setTemperatureGlobal,
  setTpopGlobal,
} from "../Redux/actions/temperatureAction";
import {
  setCountGlobal,
  setModelApiGlobal,
} from "../Redux/actions/alertAction";

// APIs
import { abortFetch, getDataFromLLM } from "../apis/Completion";
import { getModels } from "../apis/ModelLIst";

// Assets
import retry from "../assets/icon_retry.svg";
import clear from "../assets/cross_icon.svg";
import export_icon from "../assets/export_icon.svg";
import import_icon from "../assets/import_icon.svg";
import settings_icon from "../assets/Settings_Icon.svg";
import send from "../assets/icon_send.svg";
import upload from "../assets/add.svg";
import uploaded from "../assets/file_uploaded.svg";
import dropdown from "../assets/icon_dropdown.svg";
import help from "../assets/icon_help.svg";
import cross from "../assets/cross.svg";
import mic from "../assets/icon_mic.svg";
import stop from "../assets/stop_listening.svg";
import pause from "../assets/pause.svg";
import edit_icon from "../assets/edit_icon.svg";
import icon_resend from "../assets/icon_resend.svg";
import Light from "../assets/light.svg";
import Dark from "../assets/dark.svg";
import Logo from "../assets/chatai-logo-v3-preview.png";

// Components and Modals
import Tooltip from "./Tooltip";
import ResponseItem from "./ResponseItem";
import Help_Model from "../model/Help_Modal";
import Mic_Model from "../model/Mic_Model";
import Cutom_Instructions_Model from "../model/Cutom_Instructions_Model";
import ExportTypeModel from "../model/ExportTypeModel";
import Session_Expired from "../model/Session_Expired";
import Bad_Request_Model from "../model/Bad_Request_Model";
import Clear_Catch_Model from "../model/Clear_Catch_Model";
import Help_Model_Custom from "../model/Help_Model_Custom";
import Help_model_Arcanas from "../model/Help_model_Arcanas";
import Help_Model_System from "../model/Help_Model_System";
import Help_Model_Tpop from "../model/Help_Model_Tpop";
import Clear_History_Model from "../model/Clear_History_Model";

// Constants
const MAX_HEIGHT_PX = 350;
const MIN_HEIGHT_PX = 200;

function Prompt() {
  const { t, i18n } = useTranslation();
  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  const location = useLocation();
  const navigate = useNavigate();

  // Redux State and Dispatch
  const dispatch = useDispatch();
  const promptGlobal = useSelector((state) => state.prompt);
  const model = useSelector((state) => state.model);
  const conversationGLobal = useSelector((state) => state.conversation);
  const responsesGLobal = useSelector((state) => state.responses);
  const customInstructions = useSelector((state) => state.instructions);
  const temperatureGlobal = useSelector((state) => state.temperature);
  const tpopGlobal = useSelector((state) => state.tpop);
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const countClose = useSelector((state) => state.count);
  const modelApi = useSelector((state) => state.modelApi);
  const dontShowAgain = useSelector((state) => state.showAgain.dontShowAgain);

  //Theme for toast
  let toastClass = isDarkModeGlobal ? "dark-toast" : "light-toast";

  // Language list for speech recognition
  const languageMap = {
    en: "en-US", // English
    de: "de-DE", // German
  };

  // All state variables
  const [prompt, setPrompt] = useState(promptGlobal);
  const [chooseModel, setChooseModel] = useState(model);
  const [chooseModelApi, setChooseModelApi] = useState(modelApi);
  const [isOpen, setIsOpen] = useState(false);
  const [responses, setResponses] = useState(responsesGLobal);
  const [conversation, setConversation] = useState(conversationGLobal);
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
  const [isAutoScroll, setAutoScroll] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [modelList, setModelList] = useState([]);
  const [count, setCount] = useState(countClose);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [direction, setDirection] = useState("down");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResend, setIsResend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal);
  const [temperature, setTemperature] = useState(temperatureGlobal);
  const [isHovering, setHovering] = useState(false);
  const [tPop, setTpop] = useState(tpopGlobal);
  const [isHoveringTpop, setHoveringTpop] = useState(false);
  const [showCacheModel, setShowCacheModel] = useState(false);
  const [showHistoryModel, setShowHistoryModel] = useState(false);

  const [showAdvOpt, setShowAdvOpt] = useState(
    useSelector((state) => state.advOptions.isOpen) // Accessing dark mode state from Redux store
  );

  const hiddenFileInput = useRef(null);
  const hiddenFileInputJSON = useRef(null);
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);
  const textareaRefs = useRef([]);
  const containerRefs = useRef([]);

  //TO scroll down when new chat is added in array
  const scrollToBottom = () => {
    if (isAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  };

  // The new height of the element is set to the predefined constant `MIN_HEIGHT_PX`, and it's set in pixels.
  const resetHeight = () => {
    if (textAreaRef.current != null) {
      textAreaRef.current.style.height = `${MIN_HEIGHT_PX}px`;
    }
  };

  // Onchange function for textarea
  const handleChange = (event) => {
    setPrompt(event.target.value);

    if (event.target.value === "") {
      resetHeight();
    } else {
      // Reset the height to auto
      textAreaRef.current.style.height = "auto";

      // Get the scrollHeight, capped at MAX_HEIGHT_PX
      let scrollHeight = Math.min(
        textAreaRef.current.scrollHeight,
        MAX_HEIGHT_PX
      );

      // Set the height to the scrollHeight
      textAreaRef.current.style.height = `${scrollHeight}px`;
    }
  };

  // All useEffects

  // Triggers every time responses changes
  useEffect(scrollToBottom, [responses]);
  //WHen audio is being recorded transcript will be set into prompt state
  useEffect(() => {
    setPrompt(transcript);
  }, [transcript]);

  //Initialising prompt from redux prompt state on page change/refresh
  useEffect(() => {
    setPrompt(promptGlobal);
  }, []);

  // Dispatches an action to update the redux prompt value whenever prompt changes
  useEffect(() => {
    dispatch(setPromptGlobal(prompt));
  }, [prompt]);

  // Dispatches an action to update the redux responses value whenever responses changes
  useEffect(() => {
    dispatch(setResponsesGlobal(responses));
  }, [responses]);

  // Dispatches an action to update the redux conversation value whenever conversation changes
  useEffect(() => {
    dispatch(setConversationGlobal(conversation));
  }, [conversation]);

  // Triggers getRes function if isSubmitting is true
  useEffect(() => {
    if (isSubmitting) {
      getRes();
    }
  }, [isSubmitting]); // it will run whenever isSubmitting changes

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
    const container = containerRef.current;
    function handleScroll(e) {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      if (scrollTop + clientHeight < scrollHeight) {
        setAutoScroll(false);
      } else {
        setAutoScroll(true);
      }
    }
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  }, []);

  useEffect(() => {
    if (location.state && location.state.from === "/custom-instructions") {
      advSettingsToast();
      navigate(location.pathname, { state: { from: null } });
    }
  }, [location]);

  // Get model list
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getModels();
        setModelList(data);
      } catch (error) {
        notifyError("Error:", error);
      }
    };

    fetchData();
  }, []);

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
      responses.forEach((_, index) => {
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
  }, [isEditing, responses]);

  // Displays an error notification
  const notifyError = (message) => {
    toast.error(message, {
      className: toastClass,
      autoClose: 1000,
      onClose: () => {},
    });
  };

  // Displays a success notification
  const notifySuccess = (message) =>
    toast.success(message, {
      className: toastClass,
      autoClose: 1000,
      onClose: () => {},
    });

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

  async function getRes() {
    setLoading(true);
    resetHeight();
    setResponses((prevResponses) => [
      ...prevResponses,
      {
        prompt: prompt,
        response: "",
      },
    ]);
    setPrompt("");
    try {
      const response = await getDataFromLLM(
        conversation,
        customInstructions,
        chooseModelApi,
        temperatureGlobal,
        tpopGlobal,
        setResponses,
        setConversation,
        setShowModelSession,
        setPrompt,
        setShowBadRequest
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

    // Check if the index is valid
    if (index < 0 || index >= responses.length) {
      notifyError("Something went wrong");
      setLoadingResend(false);
      return;
    }

    const currentPrompt = responses[index]?.prompt;
    if (!currentPrompt || currentPrompt.trim() === "") {
      notifyError("Invalid or empty prompt at the specified index.");
      setLoadingResend(false);
      return;
    }

    // Update conversation and responses
    let newConversation = [...conversation].slice(0, index * 2 + 1);
    let newResponses = [...responses].slice(0, index);

    setResponses(newResponses);

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Handle sending the prompt
    const fullPrompt = currentPrompt;
    newConversation.push({ role: "user", content: fullPrompt });

    setResponses((prevResponses) => [
      ...prevResponses,
      {
        prompt: currentPrompt,
        response: "",
      },
    ]);
    setConversation(newConversation);

    try {
      await getDataFromLLM(
        newConversation,
        customInstructions,
        chooseModelApi,
        temperatureGlobal,
        tpopGlobal,
        setResponses,
        setConversation,
        setShowModelSession,
        setPrompt,
        setShowBadRequest
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
  };

  // Save the edited prompt and resend the request
  const handleSave = async (index) => {
    setLoadingResend(true);
    if (!editedText || !editedText.trim()) {
      notifyError("Prompt cannot be empty!");
      setLoadingResend(false);
      return;
    }

    let newConversation = [...conversation].slice(0, index * 2 + 1);
    let newResponses = [...responses].slice(0, index);

    setResponses(newResponses);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const fullPrompt = editedText;
    newConversation.push({ role: "user", content: fullPrompt });

    setResponses((prevResponses) => [
      ...prevResponses,
      {
        prompt: editedText,
        response: "",
      },
    ]);
    setConversation(newConversation);

    try {
      await getDataFromLLM(
        newConversation,
        customInstructions,
        chooseModelApi,
        temperatureGlobal,
        tpopGlobal,
        setResponses,
        setConversation,
        setShowModelSession,
        setPrompt,
        setShowBadRequest
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

    // Return function if prompt is empty or whitespace
    if (prompt.trim() === "") return;

    SpeechRecognition.stopListening();
    resetTranscript();

    if (selectedFiles.length > 0) {
      const allFilesText = selectedFiles
        .map((file) => `${file.name}: ${file.text}`)
        .join("\n");

      const fullPrompt = `${prompt}\n${allFilesText}`;

      setConversation([...conversation, { role: "user", content: fullPrompt }]);
      setIsSubmitting(true);
    } else {
      setConversation([...conversation, { role: "user", content: prompt }]);
      setIsSubmitting(true);
    }
  };

  // Handles retrying the conversation
  const handleRetry = (e) => {
    e.preventDefault();
    if (responses[responses.length - 1].prompt.length >= 300) {
      textAreaRef.current.style.height = `${MAX_HEIGHT_PX}px`;
    }
    setPrompt(responses[responses.length - 1].prompt);

    setConversation((conversation) => {
      const newArray = conversation.slice(0, conversation.length - 2);
      return newArray;
    });

    setResponses((res) => {
      const newArray = res.slice(0, res.length - 1);
      return newArray;
    });
  };

  // Handles retrying the conversation
  const handleRetryError = (index, e) => {
    e.preventDefault();

    if (index < 0 || index >= responses.length) {
      notifyError("Something went wrong");
      return;
    }

    let tempPrompt = responses[index].prompt;
    setPrompt(tempPrompt);

    let newArray = [...conversation];
    newArray.splice(index * 2 + 1, 2); // index*2 + 1 because the conversation array is twice as large as responses array and also we want to keep "system" attribute unaffected

    setResponses((res) => {
      const resCopy = [...res];
      resCopy.splice(index, 1);
      return resCopy;
    });

    SpeechRecognition.stopListening();
    resetTranscript();

    if (selectedFiles.length > 0) {
      const allFilesText = selectedFiles
        .map((file) => `${file.name}: ${file.text}`)
        .join("\n");
      const fullPrompt = `${tempPrompt}\n${allFilesText}`;
      newArray.push({ role: "user", content: fullPrompt });
    } else {
      newArray.push({ role: "user", content: tempPrompt });
    }

    setConversation(newArray);
    setIsSubmitting(true);
  };

  const handleChangeModel = (option) => {
    setChooseModel(option.name);
    setChooseModelApi(option.id);
    dispatch(setModel(option.name));
    dispatch(setModelApiGlobal(option.id));
    setIsOpen(false);
  };

  // Handles changing files
  const handleFilesChange = async (e) => {
    try {
      const textFiles = Array.from(e.target.files).filter(
        (file) => file.type === "text/plain"
      );

      if (textFiles.length !== e.target.files.length) {
        notifyError("All files must be text");
      } else {
        notifySuccess("File attached");
      }

      const filesWithText = [];
      for (const file of textFiles) {
        const text = await readFileAsText(file);
        filesWithText.push({
          name: file.name,
          text,
        });
      }

      setSelectedFiles((prevFiles) => [...prevFiles, ...filesWithText]);
    } catch (error) {
      notifyError("An error occurred: ", error);
    }
  };

  // Handles clicking on the file icon
  const handleClick = () => {
    hiddenFileInput.current.value = null; // Clear the input field prior to previous selections
    hiddenFileInput.current.click();
  };

  // Handles changing JSON files
  const handleFilesChangeJSON = async (e) => {
    try {
      // let newArray = [];

      const selectedFile = e.target.files[0];

      if (selectedFile.type === "application/json") {
        const reader = new FileReader();

        reader.onload = async () => {
          const data = reader.result;
          const parsedData = JSON.parse(data);
          if (
            Array.isArray(parsedData) &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "role") &&
            Object.prototype.hasOwnProperty.call(parsedData[0], "content")
          ) {
            let newArray = [];
            for (let i = 0; i < parsedData.length; i++) {
              if (parsedData[i].role === "system") {
                dispatch(setInstructions(parsedData[i].content));
              }
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
            setResponses(newArray);
            setConversation(parsedData);
            notifySuccess("Chat imported successfully");
          } else {
            notifyError("Invalid structure of JSON.");
          }
        };

        reader.readAsText(selectedFile);
      } else {
        notifyError("Please select a valid JSON file.");
      }
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
    // setShowFileModel(true); // Uncomment if you need to show a modal before export
    if (value === "json") {
      exportJSON(conversation);
    } else if (value === "pdf") {
      exportPDF(conversation);
    } else if (value === "text") {
      exportTextFile(conversation);
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
    // Convert conversation JSON to a formatted string
    const textContent = conversation
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    // Create a blob from the string
    const blob = new Blob([textContent], { type: "text/plain" });

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
      const content = JSON.stringify(conversation, null, 2);
      let file = new Blob([content], { type: "application/json" });
      let a = document.createElement("a");
      a.download = generateFileName("json"); // Set the consistent file name
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
    doc.setFont("helvetica"); // Set the default font

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const lineHeight = 7;
    let y = margin;
    const headerHeight = 25;

    // Set up fonts
    doc.setFont("helvetica", "bold"); // When setting Font
    doc.setFont("helvetica", "normal");

    const addHeader = (isFirstPage) => {
      y = margin;
      if (isFirstPage) {
        doc.addImage(Logo, "PNG", margin, margin, 20, 10);
      }
      const date = new Date().toLocaleDateString();
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(date, pageWidth - margin - 5, margin + 10, { align: "right" });
      doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
      y = headerHeight + 10;
    };

    const addPageNumber = () => {
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10, // Adjust this placement
        { align: "center" }
      );
    };

    const addNewPageIfNeeded = (spaceNeeded) => {
      if (y + spaceNeeded > pageHeight - margin) {
        doc.addPage();
        addHeader(false);
        addPageNumber();
      }
    };

    // Initialize the PDF with headers on the first page
    addHeader(true);
    addPageNumber();

    for (const entry of conversation) {
      addNewPageIfNeeded(lineHeight * 2);

      // Role
      doc.setFontSize(10);
      doc.setTextColor(0, 102, 204); // Blue color for role
      doc.text(`${entry.role}:`, margin, y);
      y += lineHeight;

      // Content
      doc.setFontSize(10);
      doc.setTextColor(0);

      if (typeof entry.content === "string") {
        if (entry.content.includes("```")) {
          const parts = entry.content.split(/(```[\s\S]+?```)/);
          for (const part of parts) {
            if (part.startsWith("```")) {
              const [, language, code] =
                part.match(/```(\w+)?\n([\s\S]+?)```/) || [];
              if (code) {
                const codeLines = code.trim().split("\n");
                addNewPageIfNeeded(lineHeight * (codeLines.length + 2));

                // Language title
                doc.text(language || "Code:", margin, y);
                y += lineHeight * 0.5; // Reduced gap between title and code block

                // Code block
                doc.setFillColor(240, 240, 240);
                doc.rect(
                  margin,
                  y,
                  contentWidth,
                  lineHeight * codeLines.length,
                  "F"
                );
                doc.setFont("Courier", "normal");
                doc.setFontSize(10);
                codeLines.forEach((line, index) => {
                  doc.text(line, margin + 5, y + 5 + index * lineHeight);
                });
                y += lineHeight * (codeLines.length + 0.5); // Slightly reduced gap after code block
              }
            } else {
              doc.setFontSize(10);
              const lines = doc.splitTextToSize(part, contentWidth);
              lines.forEach((line) => {
                addNewPageIfNeeded(lineHeight);
                doc.text(line, margin, y);
                y += lineHeight;
              });
            }
          }
        } else {
          const lines = doc.splitTextToSize(entry.content, contentWidth);
          lines.forEach((line) => {
            addNewPageIfNeeded(lineHeight);
            doc.text(line, margin, y);
            y += lineHeight;
          });
        }
      } else {
        addNewPageIfNeeded(lineHeight);
        doc.text("Content unavailable", margin, y);
        y += lineHeight;
      }

      y += lineHeight; // Space after each entry
    }

    // Save the PDF with a consistent file name
    doc.save(generateFileName("pdf"));
  };

  // Advanced setttings changed toast
  const advSettingsToast = () => {
    notifySuccess("Settings changed successfully");
  };

  // Function for toggling theme using Redux store function
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode); // Toggle dark mode state
    dispatch({ type: "SET_THEME" }); // Dispatch action to update theme in Redux store
  };

  const toggleAdvOpt = () => {
    setShowAdvOpt(!showAdvOpt); // Toggle dark mode state
    dispatch({ type: "SET_ADV" }); // Dispatch action to update theme in Redux store
  };

  // Handles changing the selected model
  const toggleOpen = () => setIsOpen(!isOpen);

  // Validation schema for form fields
  const validationSchema = yup.object({
    instructions: yup.string().required(() => t("description.custom6")),
  });

  // Formik form initialization
  const formik = useFormik({
    initialValues: {
      instructions: customInstructions,
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      // Dispatching action to update custom instructions
      dispatch(setInstructions(values.instructions));
      // navigate("/chat");
      // navigate("/chat", { state: { from: "/custom-instructions" } });
    },
  });

  const handleChangeTemp = (newValue) => {
    let numVal = parseFloat(newValue);
    setTemperature(numVal);
    dispatch(setTemperatureGlobal(numVal));
  };

  const handleChangeTpop = (newValue) => {
    let numVal = parseFloat(newValue);
    setTpop(numVal);
    dispatch(setTpopGlobal(numVal));
  };

  const resetDefault = () => {
    let updatedConversation = conversation.map((item) => {
      if (item.role === "system") {
        return { ...item, content: "You are a helpful assistant" };
      } else {
        return item;
      }
    });
    setConversation(updatedConversation);
    setTemperature(0.5);
    setTpop(0.5);
    formik.setFieldValue("instructions", "You are a helpful assistant");
    dispatch(setTemperatureGlobal(0.5));
    dispatch(setTpopGlobal(0.5));
    dispatch(setInstructions("You are a helpful assistant"));
  };

  const clearCatch = () => {
    persistor
      .purge()
      .then(() => {
        notifySuccess("Cache cleared successfully");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      })
      .catch((error) => {
        notifyError("Failed to clear cache: " + error.message);
      });
  };

  const handleClearHistory = () => {
    if (dontShowAgain) {
      clearHistory();
    } else {
      setShowHistoryModel(true);
    }
  };

  const clearHistory = () => {
    setResponses([]);
    setConversation((con) => {
      if (con.length > 0) {
        return [con[0]];
      }
      return con; // If array was empty, return it as it is
    });
    setShowHistoryModel(false);
    notifySuccess("History cleared");
  };

  // const toggleEdit = () => {
  //   setIsEditingCustom(!isEditingCustom);
  // };

  // const saveInstructions = () => {
  //   let updatedConversation = conversation.map((item) => {
  //     if (item.role === "system") {
  //       return { ...item, content: formik.values.instructions };
  //     } else {
  //       return item;
  //     }
  //   });
  //   setConversation(updatedConversation);
  //   dispatch(setInstructions(formik.values.instructions));
  //   setIsEditingCustom(!isEditingCustom);
  // };

  const handleInstructionsChange = (event) => {
    const { value } = event.target;

    // Update Formik values
    formik.setFieldValue("instructions", value);

    // Update conversation state and Redux state simultaneously
    let updatedConversation = conversation.map((item) => {
      if (item.role === "system") {
        return { ...item, content: value };
      } else {
        return item;
      }
    });

    setConversation(updatedConversation);
    dispatch(setInstructions(value));
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row h-full gap-3 sm:pt-2 sm:justify-between relative overflow-y-auto">
        {/* Header component used with the same code */}
        <div className="flex flex-col">
          {/* Select input for model mobile */}
          <div
            className={`w-full px-1 justify-between flex sm:hidden gap-4 border-t border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark`}
          >
            {/* Help icon */}
            <div className="flex items-center min-w-[100px]">
              {/* Chat AI Logo */}
              <Link to={"/"}>
                <img
                  className="cursor-pointer h-[40px] object-contain"
                  src={Logo}
                />
              </Link>
            </div>
            {/* Select input */}
            <div
              className="relative flex index"
              ref={dropdownRef}
              tabIndex={0}
              onBlur={() => setIsOpen(false)}
            >
              <div
                className="text-tertiary max-w-[160px] flex items-center text-[16px] w-full py-[10px] px-[5px] appearance-none focus:outline-none cursor-pointer"
                onClick={toggleOpen}
              >
                <p className="text-ellipsis overflow-hidden whitespace-nowrap">
                  {chooseModel}
                </p>
              </div>
              {isOpen && (
                <div
                  className={`absolute z-[999] w-full top-full shadow-lg dark:shadow-dark rounded-2xl border-opacity-10 border dark:border-border_dark `}
                >
                  {modelList.map((option, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-bg_secondary_dark text-tertiary block text-xl w-full p-2 "
                      onClick={() => handleChangeModel(option)}
                    >
                      {option.name}
                    </div>
                  ))}
                </div>
              )}
              <div className="cursor-pointer w-[30px] flex items-center">
                <img
                  src={help}
                  alt="help"
                  className="h-[30px] w-[30px] cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowHelpModel(true);
                  }}
                />
              </div>
            </div>
            {/* Toggle button for theme */}
            <div className="cursor-pointer flex items-center">
              <button className="h-[30px] w-[30px]" onClick={toggleDarkMode}>
                {isDarkMode ? (
                  <img
                    className="cursor-pointer h-[30px] w-[30px]"
                    src={Light}
                  />
                ) : (
                  <img
                    className="cursor-pointer h-[30px] w-[30px] -rotate-45"
                    src={Dark}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row h-full gap-3 sm:justify-between relative sm:p-0 px-2 w-full sm:pb-2 pb-2 bg-bg_light dark:bg-bg_dark">
          {/* Response section */}
          <div
            className={`sm:max-h-full sm:h-full h-full flex flex-col relative sm:w-[60%] border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark`}
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
              id="divToPrint"
              ref={containerRef}
              className="p-2 flex flex-col gap-2 overflow-y-auto flex-1"
            >
              {responses?.map((res, index) => (
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
                          ref={(el) => (textareaRefs.current[index] = el)} // Attach ref to textarea
                          className="no-scrollbar outline-none text-xl max-h-[350px] rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark"
                          value={editedText}
                          onChange={(e) => setEditedText(e.target.value)}
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" &&
                              !event.shiftKey &&
                              editedText.trim() !== ""
                            ) {
                              event.preventDefault();
                              handleCloseClick(index); // Close the textarea
                              handleSave(index); // Save the edited text
                              setIsEditing(false); // Exit edit mode after saving
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

                  {/* Render additional response item details */}
                  <ResponseItem
                    res={res}
                    index={index}
                    handleRetryError={handleResendClick}
                    loading={loading}
                    loadingResend={loadingResend}
                    responses={responses}
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
              {/* Scrolls to the end when new messages are added */}
            </div>

            {responses.length > 0 ? (
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
          <div className="sm:w-[40%] flex flex-col dark:text-white text-black h-fit justify-between sm:h-full no-scrollbar sm:overflow-y-auto sm:gap-3 relative rounded-2xl shadow-bottom dark:shadow-darkBottom bg-bg_light dark:bg-bg_dark">
            <div className="flex flex-col gap-4 w-full">
              <div className="relative select-none border dark:border-border_dark rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark">
                <textarea
                  className="no-scrollbar p-4 outline-none text-xl max-h-[350px] sm:min-h-[200px] rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark"
                  value={prompt}
                  ref={textAreaRef}
                  name="prompt"
                  placeholder={t("description.placeholder")}
                  onChange={handleChange}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      prompt.trim() !== ""
                    ) {
                      event.preventDefault();
                      handleSubmit(event);
                    }
                  }}
                />

                <div className="px-3 py-2 w-full h-fit flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl">
                  {prompt.trim() !== "" ? (
                    <Tooltip text={t("description.clear")}>
                      <button
                        className="h-[30px] w-[30px] cursor-pointer"
                        onClick={() => {
                          setPrompt("");
                          resetTranscript();
                          resetHeight();
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
                      className="sm:hidden flex h-[30px] w-[30px] cursor-pointer"
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
                      accept=".txt"
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
                    ) : prompt !== "" ? (
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
                        <img className="h-[30px] w-[30px]" src={uploaded} />
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center">
                            <p className="overflow-hidden whitespace-nowrap overflow-ellipsis w-[80%]">
                              {file.name}
                            </p>
                            <p>&nbsp;-&nbsp;</p>
                            <p> {file.size} </p>
                            <p>&nbsp;bytes</p>
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
            </div>

            <div className="sm:static flex justify-center absolute bottom-0 sm:w-full w-[calc(100%-16px)] shadow-lg dark:shadow-dark">
              {showAdvOpt ? (
                <div className="flex flex-col gap-4 sm:p-6 py-4 px-3 border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark h-fit w-full">
                  {/* Select model */}
                  <div className="md:flex flex-col hidden gap-4">
                    {/* Select input for model for desktop */}
                    <div className="flex items-center gap-4 select-none">
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <p className="flex-shrink-0 text-[18px]">
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
                        className="relative w-full flex flex-col"
                        ref={dropdownRef}
                        tabIndex={0}
                        onBlur={() => setIsOpen(false)}
                      >
                        <div
                          className="text-tertiary block mt-1 cursor-pointer text-[18px] w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
                          onClick={toggleOpen}
                        >
                          {chooseModel}
                          <div className="absolute right-0 flex items-center pr-[10px]  bottom-2 ">
                            <img
                              src={dropdown}
                              alt="drop-down"
                              className="h-[30px] w-[30px] cursor-pointer"
                            />
                          </div>
                        </div>
                        {isOpen && (
                          <div
                            className={`absolute w-full ${
                              direction === "up" ? "bottom-full" : "top-full"
                            } rounded-2xl border-opacity-10 border dark:border-border_dark z-[99] max-h-[200px] overflow-y-auto`}
                          >
                            {modelList.map((option, index) => (
                              <div
                                key={index}
                                className={`bg-white dark:bg-black text-tertiary block text-xl w-full p-2 cursor-pointer ${
                                  index === 0
                                    ? "rounded-t-2xl" // The first element
                                    : index === modelList.length - 1
                                    ? "rounded-b-2xl" // The last element
                                    : "" // All other elements
                                }`}
                                onClick={() => handleChangeModel(option)}
                              >
                                {option.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>{" "}
                  </div>
                  {/* Arcanas */}
                  {/* <div className="flex gap-4 w-full items-center">
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {" "}
                      <p className="text-[18px]">Arcanas</p>{" "}
                      <img
                        src={help}
                        alt="help"
                        className="h-[20px] w-[20px] cursor-pointer"
                        onClick={() => setShowArcanasHelpModel(true)}
                      />
                    </div>
                    <Arcanas
                      notifyError={notifyError}
                      notifySuccess={notifySuccess}
                    />
                  </div> */}
                  {/* Custom instructions */}
                  <div className="">
                    <Formik enableReinitialize={true} onSubmit>
                      <Form onSubmit={formik.handleSubmit}>
                        <div className="flex flex-col gap-4 items-center">
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
                            <div className="mx-2 w-full">
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
                                  value={temperature}
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
                                        (temperature / 2) * 100
                                      }% - 15px)`,
                                    }}
                                  >
                                    {Number(temperature).toFixed(1)}
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
                            <div className="mx-2 w-full">
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
                                  value={tPop}
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
                                        ((tPop - 0.05) / 0.95) * 100
                                      }% - 15px)`,
                                    }}
                                  >
                                    {Number(tPop).toFixed(2)}
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
                                  className={`no-scrollbar dark:text-white text-black bg-white dark:bg-bg_secondary_dark p-4 border dark:border-border_dark outline-none rounded-2xl shadow-lg dark:shadow-dark w-full min-h-[150px]`}
                                  type="text"
                                  name="instructions"
                                  placeholder={t("description.custom4")}
                                  value={formik.values.instructions}
                                  onBlur={formik.handleBlur}
                                  onChange={handleInstructionsChange}
                                />
                              </div>
                              {/* <div className="absolute bottom-4 right-4 z-[99] flex justify-end items-center">
                                {!isEditingCustom ? (
                                  <img
                                    src={edit_icon}
                                    alt="edit_icon"
                                    onClick={toggleEdit}
                                    className="h-[30px] w-[30px] cursor-pointer"
                                  />
                                ) : (
                                  <button
                                    className="text-white p-3 bg-tertiary dark:border-border_dark rounded-2xl justify-center items-center shadow-lg dark:shadow-dark border min-w-[100px] md:w-fit"
                                    type="button"
                                    onClick={saveInstructions}
                                  >
                                    Save
                                  </button>
                                )}
                              </div>{" "} */}
                            </div>
                            {/* Display error message if any */}
                            {formik.errors.instructions &&
                            formik.touched.instructions ? (
                              <p className="text-red-600 text-12-500 ">
                                {formik.errors.instructions}
                              </p>
                            ) : null}{" "}
                          </div>

                          {/* Submit button */}
                          <div className="flex md:justify-end gap-2 items-center w-full">
                            <div
                              className="flex gap-4 items-center justify-center select-none w-full"
                              onClick={toggleAdvOpt} // Click handler to toggle dark mode
                            >
                              <p className="text-[18px] h-full text-tertiary cursor-pointer">
                                <Trans i18nKey="description.text9"></Trans>
                              </p>{" "}
                            </div>
                            {/* <button
                              className="text-white p-3 bg-tertiary dark:border-border_dark md:hidden rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full select-none "
                              type="reset"
                              onClick={toggleAdvOpt}
                            >
                              <Trans i18nKey="description.save"></Trans>
                            </button> */}
                            {/* Opens clear cache model */}
                            <button
                              className="text-white p-3 bg-red-600 dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border min-w-[130px] select-none "
                              type="reset"
                              onClick={() => {
                                setShowCacheModel(true);
                              }}
                            >
                              <Trans i18nKey="description.custom8"></Trans>
                            </button>
                            {/* Resets settings, and clears redux */}
                            <button
                              className="text-black p-3 bg-bg_reset_default dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border min-w-[130px] select-none "
                              onClick={resetDefault}
                              type="reset"
                            >
                              <Trans i18nKey="description.custom7"></Trans>
                            </button>
                            {/* Applies changes */}
                            {/* <button
                            className="text-white p-3 bg-tertiary dark:border-border_dark  rounded-2xl justify-center items-center md:w-fit shadow-lg dark:shadow-dark border w-full min-w-[150px] select-none "
                            type="submit"
                          >
                            <Trans i18nKey="description.custom5"></Trans>
                          </button> */}
                          </div>
                        </div>
                      </Form>
                    </Formik>
                  </div>{" "}
                </div>
              ) : (
                <div className="sm:flex hidden flex-col gap-4 sm:px-6 py-4 px-3 border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark h-fit w-full">
                  {/* Select model */}
                  <div className="md:flex flex-col hidden gap-4">
                    {/* Select input for model for desktop */}
                    <div className="flex items-center gap-4 select-none">
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <p className="flex-shrink-0 text-[18px]">
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
                        className="relative w-full flex flex-col"
                        ref={dropdownRef}
                        tabIndex={0}
                        onBlur={() => setIsOpen(false)}
                      >
                        <div
                          className="text-tertiary block mt-1 cursor-pointer text-xl w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
                          onClick={toggleOpen}
                        >
                          {chooseModel}
                          <div className="absolute right-0 flex items-center pr-[10px]  bottom-2 ">
                            <img
                              src={dropdown}
                              alt="drop-down"
                              className="h-[30px] w-[30px] cursor-pointer"
                            />
                          </div>
                        </div>
                        {isOpen && (
                          <div
                            className={`absolute w-full ${
                              direction === "up" ? "bottom-full" : "top-full"
                            } rounded-2xl border-opacity-10 border dark:border-border_dark z-[99]`}
                          >
                            {modelList.map((option, index) => (
                              <div
                                key={index}
                                className={`bg-white dark:bg-black text-tertiary block text-xl w-full p-2 cursor-pointer ${
                                  index === 0
                                    ? "rounded-t-2xl" // The first element
                                    : index === modelList.length - 1
                                    ? "rounded-b-2xl" // The last element
                                    : "" // All other elements
                                }`}
                                onClick={() => handleChangeModel(option)}
                              >
                                {option.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>{" "}
                    {/* <div className="flex items-center gap-2 select-none">
              <Link to={"/custom-instructions"} target="">
                <p className="text-xl h-full text-tertiary">
                  <Trans i18nKey="description.text6"></Trans>
                </p>
              </Link>{" "}
              <img
                src={help}
                alt="help"
                className="h-[20px] w-[20px] cursor-pointer"
                onClick={() => setShowCusModel(true)}
              />
            </div> */}
                  </div>
                  <div
                    className="cursor-pointer select-none flex gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit w-full"
                    onClick={toggleAdvOpt} // Click handler to toggle dark mode
                  >
                    <p className="text-[18px] h-full text-tertiary">
                      <Trans i18nKey="description.text6"></Trans>
                    </p>{" "}
                    {/* <img
                    src={advanced_settings_arrow}
                    alt="drop-down"
                    className={`${
                      showAdvOpt ? "" : "rotate-180"
                    } h-[15px] w-[40px] cursor-pointer`}
                  /> */}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div>
        <ToastContainer />
      </div>

      {/* Help model for info on changing model */}
      <>{showHelpModel ? <Help_Model showModal={setShowHelpModel} /> : null}</>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showCustomHelpModel ? (
          <Help_Model_Custom showModal={setShowCustomHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom temperature */}
      <div className="">
        {showTpopHelpModel ? (
          <Help_Model_Tpop showModal={setShowTpopHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on system prompt */}
      <div className="">
        {showSystemHelpModel ? (
          <Help_Model_System showModal={setShowSystemHelpModel} />
        ) : null}
      </div>

      {/* Help model for info on custom instructions */}
      <div className="">
        {showArcanasHelpModel ? (
          <Help_model_Arcanas showModal={setShowArcanasHelpModel} />
        ) : null}
      </div>

      {/* Pop-up if microphone permission is not given or denied */}
      <div className="">
        {showMicModel ? <Mic_Model showModal={setShowMicModel} /> : null}
      </div>

      {/* Pop-up for info about custom instructions */}
      <div className="">
        {showCusModel ? (
          <Cutom_Instructions_Model showModal={setShowCusModel} />
        ) : null}
      </div>

      {/* Pop-up  for export file model*/}
      <div className="">
        {showFileModel ? (
          <ExportTypeModel
            showModal={setShowFileModel}
            exportFile={exportFile}
          />
        ) : null}
      </div>

      {/* Pop-up  for session expired model*/}
      <div className="">
        {showModelSession ? (
          <Session_Expired showModal={setShowModelSession} />
        ) : null}
      </div>

      {/* Pop-up token limit exceed*/}
      <div className="">
        {showBadRequest ? (
          <Bad_Request_Model showModal={setShowBadRequest} />
        ) : null}
      </div>

      {/* Pop-up clear cache*/}
      <div className="">
        {showCacheModel ? (
          <Clear_Catch_Model
            showModal={setShowCacheModel}
            clearCatch={clearCatch}
          />
        ) : null}
      </div>

      {/* Pop-up clear history*/}
      <div className="">
        {showHistoryModel ? (
          <Clear_History_Model
            showModal={setShowHistoryModel}
            clearHistory={clearHistory}
          />
        ) : null}
      </div>
    </>
  );
}

export default Prompt;
