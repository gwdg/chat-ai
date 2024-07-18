/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
// Libraries and dependencies
import React, { useRef, useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Link, useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { useDispatch, useSelector } from "react-redux";
import { setPromptGlobal } from "../Redux/actions/promptAction";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
import Help_Model from "../model/Help_Modal";
import Mic_Model from "../model/Mic_Model";
import Cutom_Instructions_Model from "../model/Cutom_Instructions_Model";
import { abortFetch, getDataFromLLM } from "../apis/Completion";
import ExportTypeModel from "../model/ExportTypeModel";
import { setModel } from "../Redux/actions/modelAction";
import { setResponsesGlobal } from "../Redux/actions/responsesAction";
import { setConversationGlobal } from "../Redux/actions/conAction";
import { setInstructions } from "../Redux/actions/customInsAction"; // Redux action
import { getModels } from "../apis/ModelLIst";
import Tooltip from "./Tooltip";
import { setCountGlobal } from "../Redux/actions/alertAction";
import { setModelApiGlobal } from "../Redux/actions/setModelApi";
import Session_Expired from "../model/Session_Expired";
import Bad_Request_Model from "../model/Bad_Request_Model";

import Light from "../assets/light.svg"; // Light mode icon
import Dark from "../assets/dark.svg"; // Dark mode icon
import Logo from "../assets/chatai-logo-v3-preview.png"; // Chat AI logo
import { setAnncCountGlobal } from "../Redux/actions/anncAlertAction";
import AnnouncementBarMobile from "./AnnouncementBarMobile";
import ResponseItem from "./ResponseItem";
import Arcanas from "./Arcanas";

const MAX_HEIGHT_PX = 350;
const MIN_HEIGHT_PX = 200;

function Prompt() {
  const { t, i18n } = useTranslation(); // Objects of i18n lib
  const { transcript, listening, resetTranscript } = useSpeechRecognition(); // Speech recognition lib objects
  const location = useLocation();
  const navigate = useNavigate();

  // States from redux
  const promptGlobal = useSelector((state) => state.prompt);
  const model = useSelector((state) => state.model);
  const conversationGLobal = useSelector((state) => state.conversation);
  const responsesGLobal = useSelector((state) => state.responses);
  const customInstructions = useSelector((state) => state.instructions);
  const temperatureGlobal = useSelector((state) => state.temperature);
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const countClose = useSelector((state) => state.count);
  const modelApi = useSelector((state) => state.modelApi);
  const countAnncGlobal = useSelector((state) => state.anncCount);

  //Theme for toast
  let toastClass = isDarkModeGlobal ? "dark-toast" : "light-toast";

  // Dispatch for trigger setState
  const dispatch = useDispatch();

  // Language list for speech recognition
  const languageMap = {
    en: "en-US", // English
    de: "de-DE", // German
  };

  // All state variables
  const [prompt, setPrompt] = useState(promptGlobal); // prompt state
  const [chooseModel, setChooseModel] = useState(model); //Initialize model option
  const [chooseModelApi, setChooseModelApi] = useState(modelApi); //Initialize model option
  const [isOpen, setIsOpen] = useState(false); //To open and close select menu
  const [responses, setResponses] = useState(responsesGLobal); //Responses array contains chat and will be displayed on left
  const [conversation, setConversation] = useState(conversationGLobal); //Conversation for LLM API payload
  const [loading, setLoading] = useState(false); // Submit button state
  const [showModel, setShowModel] = useState(true); // Note model state
  const [showModelSession, setShowModelSession] = useState(false); // Session expired model state
  const [showBadRequest, setShowBadRequest] = useState(false); // Session expired model state
  const [showHelpModel, setShowHelpModel] = useState(false); // Help model state
  const [showMicModel, setShowMicModel] = useState(false); // Mic model state
  const [showCusModel, setShowCusModel] = useState(false); // Custom instructions model state
  const [showFileModel, setShowFileModel] = useState(false); // File format model state
  const [isAutoScroll, setAutoScroll] = useState(true); //Checks if user has scrolled while LLM is respondins
  const [selectedFiles, setSelectedFiles] = useState([]); // Files state
  const [modelList, setModelList] = useState([]);
  const [count, setCount] = useState(countClose);
  const hiddenFileInput = useRef(null); // Ref for hidden file input for prompt
  const hiddenFileInputJSON = useRef(null); // Ref for hidden file input for import for load history
  const messagesEndRef = useRef(null);
  const textAreaRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);
  const [direction, setDirection] = useState("down");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(isDarkModeGlobal); // Accessing dark mode state from Redux store
  // const [showAnnc, setShowAnnc] = useState(countAnncGlobal > 3 ? false : true);
  // const [countAnnc, setCountAnnc] = useState(countAnncGlobal);

  //TO scroll down when new chat is added in array
  const scrollToBottom = () => {
    if (isAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  };

  // The function `resetHeight` is used to reset the height of the HTML element referred to by `textAreaRef`.
  // The element's height is reset only if `textAreaRef` points to an existing element (not null).
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
      // const spaceAbove = rect.top;
      setDirection(spaceBelow > rect.height ? "up" : "down");
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

  // Function for getting response from backend
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

  // Handles aborting fetch request
  const handleAbortFetch = () => {
    abortFetch(notifyError);
    setIsSubmitting(false);
    setLoading(false);
  };

  // Handles submission of text area content
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

  // Handles changing the selected model
  const toggleOpen = () => setIsOpen(!isOpen);

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
    // setShowFileModel(true);
    if (value == "json") {
      exportJSON();
    } else {
      exportPDF();
    }
  };

  // Exports conversation to a JSON file
  const exportJSON = () => {
    try {
      const content = JSON.stringify(conversation, null, 2);
      let file = new Blob([content], { type: "application/json" });
      let a = document.createElement("a");
      let date = new Date();
      let year = date.getFullYear();
      let month = String(date.getMonth() + 1).padStart(2, "0");
      let day = String(date.getDate()).padStart(2, "0");
      let hour = String(date.getHours()).padStart(2, "0");
      let minute = String(date.getMinutes()).padStart(2, "0");
      let second = String(date.getSeconds()).padStart(2, "0");
      a.download = `chat-ai-${year}-${month}-${day}-${hour}${minute}${second}.json`;
      a.href = URL.createObjectURL(file);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess("Chat exported successfully");
    } catch (error) {
      notifyError("An error occurred while exporting to JSON: ", error);
    }
  };

  // Advanced setttings changed toast
  const advSettingsToast = () => {
    notifySuccess("Settings changed successfully");
  };

  // Exports conversation to a PDF file
  const exportPDF = () => {
    let date = new Date();
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, "0");
    let day = String(date.getDate()).padStart(2, "0");
    let hour = String(date.getHours()).padStart(2, "0");
    let minute = String(date.getMinutes()).padStart(2, "0");
    let second = String(date.getSeconds()).padStart(2, "0");

    try {
      const doc = new jsPDF();
      let content = "";

      conversation.forEach((entry, index) => {
        let text = `${entry.role}: ${entry.content}\n`;
        let splitText = [];
        let maxLength = 100; // Change to the maximum length you'd like.
        while (text.length > maxLength) {
          let substr = text.slice(0, maxLength);
          let lastSpaceIndex = substr.lastIndexOf(" ");

          if (lastSpaceIndex > -1) {
            substr = substr.slice(0, lastSpaceIndex);
            splitText.push(substr);
            text = text.slice(lastSpaceIndex + 1);
          } else {
            splitText.push(substr);
            text = text.slice(maxLength);
          }
        }
        splitText.push(text);
        content += splitText.join("\n");
      });

      const splitContent = doc.splitTextToSize(content, 160);
      let y = 30; // Initial y position to start the text
      let pageHeight = doc.internal.pageSize.height;

      splitContent.forEach((line) => {
        if (y + 10 > pageHeight) {
          doc.addPage();
          y = 30; // Reset y to a new start position
        }
        doc.text(line, 20, y);
        y += 10;
      });
      doc.setFontSize(8); // 12 is the font size

      doc.save(`chat-ai-${year}-${month}-${day}-${hour}${minute}${second}.pdf`);
      notifySuccess("File generated successfully");
    } catch (error) {
      notifyError("An error occurred while exporting to PDF: ", error);
    }
  };

  // Function for toggling theme using Redux store function
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode); // Toggle dark mode state
    dispatch({ type: "SET_THEME" }); // Dispatch action to update theme in Redux store
  };

  //Announcement alert count handler
  // const anncCounter = () => {
  //   setShowAnnc(false);
  //   dispatch(setAnncCountGlobal(countAnnc + 1));
  //   setCountAnnc(function (prevCount) {
  //     return (prevCount += 1);
  //   });
  // };

  return (
    <>
      <div className="flex flex-col md:flex-row h-screen md:h-full gap-3 md:pb-4 md:justify-between relative">
        {/* Header component used with same code */}
        <div className="flex flex-col">
          {" "}
          {/* Select input for model mobile*/}
          {/* {showAnnc && countAnnc < 3 ? (
            <AnnouncementBarMobile anncCounter={anncCounter} />
          ) : null} */}
          <div
            className={`w-full px-1 justify-between flex md:hidden gap-4 border-t border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark`}
          >
            {/* Help icon */}
            <div className="flex items-center min-w-[100px]">
              {/* Chat AI Logo */}
              <Link to={"/"}>
                <img
                  className="cursor-pointer h-[40px] object-contain"
                  src={Logo}
                />
              </Link>{" "}
            </div>
            {/* Select input */}
            <div
              className="relative flex index"
              ref={dropdownRef}
              tabIndex={0}
              onBlur={() => setIsOpen(false)}
            >
              {" "}
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
            {/* Toggle button for theme*/}
            <div className="cursor-pointer flex items-center">
              {" "}
              <button
                className="h-[30px] w-[30px]"
                onClick={toggleDarkMode} // Click handler to toggle dark mode
              >
                {/* Display light or dark mode icon based on dark mode state */}
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
              </button>{" "}
            </div>
          </div>
        </div>
        {/* response */}
        <div
          className={`md:max-h-full md:h-full h-full  flex flex-col relative md:w-[60%] border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark md:m-0 mx-2`}
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
                  setCount(function (prevCount) {
                    return (prevCount += 1);
                  });
                }}
              />
            </div>
          ) : null}

          {/* Prompt response */}
          <div
            ref={containerRef}
            className="p-2 flex flex-col gap-2 overflow-y-scroll flex-1 no-scrollbar"
          >
            {responses?.map((res, index) => (
              <div key={index} className={`flex flex-col gap-1`}>
                <div className="text-black dark:text-white overflow-y-auto border dark:border-border_dark rounded-2xl bg-bg_chat_user dark:bg-bg_chat_user_dark p-3 ">
                  <pre
                    className="font-sans"
                    style={{
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {res.prompt}
                  </pre>
                </div>
                <ResponseItem
                  res={res}
                  index={index}
                  handleRetryError={handleRetryError}
                  loading={loading}
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
            <div ref={messagesEndRef} />
          </div>

          {responses.length > 0 ? (
            <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl ">
              <Tooltip text={t("description.undo")}>
                <button
                  className="h-[30px] w-[30px] cursor-pointer "
                  onClick={handleRetry}
                  disabled={loading}
                >
                  <img
                    className="cursor-pointer h-[30px] w-[30px]"
                    src={retry}
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
                    {/* <p>Export as PDF</p>{" "} */}
                    <img
                      className="cursor-pointer h-[30px] w-[30px]"
                      src={export_icon}
                    />
                  </button>{" "}
                </Tooltip>
                <div className="flex items-center">
                  {" "}
                  <input
                    type="file"
                    ref={hiddenFileInputJSON}
                    accept="application/JSON"
                    onChange={handleFilesChangeJSON}
                    className="hidden"
                  />
                  {/* File upload button */}
                  <Tooltip text={t("description.import")}>
                    {" "}
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
                <Tooltip text={t("description.clear")}>
                  {" "}
                  <button
                    className="h-[30px] w-[30px] cursor-pointer "
                    disabled={loading}
                    onClick={() => {
                      setResponses([]);
                      setConversation((con) => {
                        if (con.length > 0) {
                          return [con[0]];
                        }
                        return con; // If array was empty, return it as it is
                      });
                      notifySuccess("History cleared");
                    }}
                  >
                    <img
                      className="cursor-pointer h-[25px] w-[25px]"
                      src={clear}
                    />
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="w-full bottom-0 sticky select-none h-fit px-4 py-2 flex justify-end items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl ">
              <>
                {" "}
                <input
                  type="file"
                  ref={hiddenFileInputJSON}
                  accept="application/JSON"
                  onChange={handleFilesChangeJSON}
                  className="hidden"
                />
                {/* File upload button */}
                <Tooltip text={t("description.import")}>
                  {" "}
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
              </>
            </div>
          )}
        </div>

        {/* prompt */}
        <div className="md:w-[40%] flex flex-col gap-4 dark:text-white text-black h-fit md:m-0 mx-2 justify-between md:h-full">
          {/* <div className="max-h-[650px] overflow-auto flex md:flex-col flex-row gap-2"> */}
          <div className="flex flex-col gap-4 w-full">
            <div className="relative select-none border dark:border-border_dark rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark">
              <textarea
                className="p-4 outline-none text-xl max-h-[350px] md:min-h-[200px] rounded-t-2xl w-full dark:text-white text-black bg-white dark:bg-bg_secondary_dark"
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
                {/* Clear prompt */}
                {prompt.trim() !== "" ? (
                  <Tooltip text={t("description.clear")}>
                    {" "}
                    <button
                      className="h-[30px] w-[30px] cursor-pointer "
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
                  <Link to={"/custom-instructions"} target="">
                    <button className="md:hidden flex h-[30px] w-[30px] cursor-pointer">
                      <img
                        className="cursor-pointer h-[30px] w-[30px]"
                        src={settings_icon}
                      />
                    </button>
                  </Link>
                  {/* Input for file hidden in UI */}
                  <input
                    type="file"
                    ref={hiddenFileInput}
                    multiple
                    accept=".txt"
                    onChange={handleFilesChange}
                    className="hidden"
                  />
                  {/* File upload button */}
                  <Tooltip text={t("description.upload")}>
                    {" "}
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

                  {/* Submit/Pause button */}
                  {loading ? (
                    <Tooltip text={t("description.pause")}>
                      <button className="h-[30px] w-[30px] cursor-pointer">
                        <img
                          className="cursor-pointer h-[30px] w-[30px]"
                          src={pause}
                          onClick={() => {
                            handleAbortFetch();
                          }}
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

            {/* List of selected files */}
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
                        <div className="flex">
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

          <div>
            <Arcanas />
          </div>
          {/* Select model */}
          <div className="md:flex flex-col hidden gap-4">
            {/* Select input for model for desktop */}
            <div className="flex items-center gap-4 select-none">
              <div className="flex-shrink-0 flex items-center gap-2">
                <p className="flex-shrink-0 text-xl">
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
                  className="text-tertiary block mt-1 cursor-pointer text-xl w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-bg_secondary_dark shadow-lg dark:shadow-dark"
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
                    } rounded-2xl border-opacity-10 border dark:border-border_dark`}
                  >
                    {modelList.map((option, index) => (
                      <div
                        key={index}
                        className={`bg-white dark:bg-bg_secondary_dark text-tertiary block text-xl w-full p-2 cursor-pointer ${
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
            <div className="flex items-center gap-2 select-none">
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
            </div>
          </div>
        </div>
        <div>
          <ToastContainer />
        </div>
      </div>

      {/* Help model for info on changing model */}
      <div className="">
        {showHelpModel ? <Help_Model showModal={setShowHelpModel} /> : null}
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
    </>
  );
}

export default Prompt;
