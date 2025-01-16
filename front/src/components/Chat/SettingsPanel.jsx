/* eslint-disable no-unused-vars */
//Libraries
import { Trans, useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

//Components
import ArcanaContainer from "../Arcanas/ArcanaContainer";

//Assets
import help from "../../assets/icon_help.svg";
import image_supported from "../../assets/image_supported.svg";
import cross from "../../assets/cross.svg";
import dropdown from "../../assets/icon_dropdown.svg";
import uploaded from "../../assets/file_uploaded.svg";
import share_icon from "../../assets/share_icon.svg";

//Redux
import {
  addConversation,
  selectConversations,
  updateConversation,
} from "../../Redux/reducers/conversationsSlice";

const SettingsPanel = ({
  selectedFiles,
  setSelectedFiles,
  modelSettings,
  modelList,
  currentModel,
  isImageSupported,
  onModelChange,
  showAdvOpt,
  toggleAdvOpt,
  localState,
  setLocalState,
  updateSettings,
  setShareSettingsModal,
  handleShareSettings,
  setShowHelpModal,
  setShowArcanasHelpModal,
  setShowCustomHelpModal,
  setShowTopPHelpModal,
  setShowSystemHelpModal,
  notifySuccess,
  notifyError,
}) => {
  //Variables and Functions
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
  const modelStatus = useMemo(
    () => ({
      color: currentModel ? getStatusColor(currentModel.status) : "red",
    }),
    [currentModel]
  );
  const conversations = useSelector(selectConversations);

  //Hooks
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );

  //Local useStates
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const [isHovering, setHovering] = useState(false);
  const [isHoveringTopP, setHoveringTopP] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");

  //Refs
  const hasProcessedSettings = useRef(false);
  const hasProcessedImport = useRef(false);
  const hasProcessedArcana = useRef(false);
  const dropdownRef = useRef(null);

  //Functions
  const removeFile = (index) => {
    const newFiles = JSON.parse(JSON.stringify(selectedFiles));
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
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
  const handleInstructionsChange = (event) => {
    const { value } = event.target;

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
  const validateSystemPrompt = () => {
    if (!localState.settings.systemPrompt?.trim()) {
      setSystemPromptError(t("description.custom6"));
      return false;
    }
    return true;
  };
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };
  const toggleOpen = () => setIsOpen(!isOpen);

  const handleChangeTemp = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ temperature: numVal });
  };

  const handleChangeTopPhandleChangeTpophandleChangeTpop = (newValue) => {
    const numVal = parseFloat(newValue);
    updateSettings({ top_p: numVal });
  };
  const handleShareSettingsModal = () => {
    if (localState.dontShow.dontShowAgainShare) {
      handleShareSettings();
    } else {
      setShareSettingsModal(true);
    }
  };

  //Effects
  useEffect(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setDirection(spaceBelow > spaceAbove ? "down" : "up");
    }
  }, [isOpen]);
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
                model: settings.model_name || "Meta Llama 3.1 8B Instruct",
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
                    model: settings.model_name || "Meta Llama 3.1 8B Instruct",
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
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    setLocalState,
  ]);

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

              const systemMessage = parsedData?.messages?.find(
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

              const systemMessage = parsedData?.find(
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
                      model: "Meta Llama 3.1 8B Instruct",
                      model_api: "meta-llama-3.1-8b-instruct",
                      temperature: 0.5,
                      top_p: 0.5,
                    },
                  },
                })
              );
            }

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
  }, [
    searchParams,
    location.pathname,
    conversations.length,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    notifySuccess,
    setLocalState,
  ]);

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
              top_p: 0.05,
            },
          }));
          const currentConversation = conversations?.find(
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
                  top_p: 0.05,
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
    conversations,
    currentConversationId,
    dispatch,
    navigate,
    notifyError,
    setLocalState,
  ]);

  return (
    <div className="w-[40%] mobile:w-full p-2 text-tertiary flex flex-col justify-end">
      <div>
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-3 select-none">
            <div className="flex items-center justify-between">
              <p>
                <Trans i18nKey="description.file1" />
              </p>
              <p
                className="text-tertiary cursor-pointer"
                onClick={() => setSelectedFiles([])}
              >
                <Trans i18nKey="description.file2" />
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
        )}
      </div>

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
            <div className="flex flex-col mobile:hidden gap-4">
              <div className="flex flex-wrap items-center gap-4 select-none">
                <div className="flex-shrink-0 flex items-center gap-2 min-w-fit">
                  <p className="flex-shrink-0 text-[18px] whitespace-nowrap">
                    <Trans i18nKey="description.choose" />
                  </p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowHelpModal(true)}
                  />
                </div>

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
                              backgroundColor: getStatusColor(option.status),
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

            {localState.settings.model.toLowerCase().includes("external") && (
              <div className="text-yellow-600 text-sm mb-3 select-none">
                <Trans i18nKey="description.warning_settings" />
              </div>
            )}

            <div className="flex gap-4 w-full items-center">
              <div className="flex-shrink-0 flex items-center gap-2 select-none">
                <p className="text-[18px]">Arcana</p>
                <img
                  src={help}
                  alt="help"
                  className="h-[20px] w-[20px] cursor-pointer"
                  onClick={() => setShowArcanasHelpModal(true)}
                />
              </div>
              <ArcanaContainer
                localState={localState}
                setLocalState={setLocalState}
              />
            </div>

            <div className="flex flex-col gap-4 items-center">
              {localState.arcana.id && localState.arcana.key && (
                <div className="text-yellow-600 text-sm w-full select-none">
                  <Trans i18nKey="description.warning_arcana" />
                </div>
              )}

              <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                  <p className="text-[18px]">temp</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowCustomHelpModal(true)}
                  />
                </div>
                <div className="w-full">
                  <div className="relative w-full">
                    <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                      <span>Logical</span>
                      <span>Creative</span>
                    </div>
                    <div className="tick-marks-container cursor-pointer">
                      {[...Array(21)].map((_, i) => (
                        <div key={i} className="tick-mark"></div>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={localState.settings.temperature}
                      className="slider-input"
                      onChange={(event) => handleChangeTemp(event.target.value)}
                      onMouseEnter={() => setHovering(true)}
                      onMouseLeave={() => setHovering(false)}
                    />
                    {isHovering && (
                      <output
                        className="slider-tooltip"
                        style={{
                          left: `calc(${
                            (localState.settings.temperature / 2) * 100
                          }% - 15px)`,
                        }}
                      >
                        {Number(localState.settings.temperature).toFixed(1)}
                      </output>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:gap-4 gap-5 w-full md:items-center">
                <div className="flex-shrink-0 flex items-center gap-2 select-none min-w-[80px]">
                  <p className="text-[18px]">top_p</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowTopPHelpModal(true)}
                  />
                </div>
                <div className="w-full">
                  <div className="relative w-full">
                    <div className="select-none flex justify-between text-xs text-tertiary mb-2 absolute top-[-20px] w-full">
                      <span>Focused</span>
                      <span>Diverse</span>
                    </div>
                    <div className="tick-marks-container cursor-pointer">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="tick-mark"></div>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={localState.settings.top_p}
                      className="slider-input"
                      onChange={(event) => handleChangeTopPhandleChangeTpophandleChangeTpop(event.target.value)}
                      onMouseEnter={() => setHoveringTopP(true)}
                      onMouseLeave={() => setHoveringTopP(false)}
                    />
                    {isHoveringTopP && (
                      <output
                        className="slider-tooltip"
                        style={{
                          left: `calc(${
                            ((localState.settings.top_p - 0.05) / 0.95) * 100
                          }% - 15px)`,
                        }}
                      >
                        {Number(localState.settings.top_p).toFixed(2)}
                      </output>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex flex-col gap-4">
                <div className="flex-shrink-0 flex items-center gap-2 select-none">
                  <p className="text-[18px]">System prompt</p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowSystemHelpModal(true)}
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
                      onBlur={() => validateSystemPrompt()}
                    />
                  </div>
                  {systemPromptError && (
                    <p className="text-red-600 text-12-500">
                      {systemPromptError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-left md:justify-end gap-2 md:gap-4 items-center w-full">
                <div
                  className="cursor-pointer select-none flex-1 gap-4 justify-center items-center p-4 bg-white dark:bg-bg_secondary_dark h-fit"
                  onClick={toggleAdvOpt}
                >
                  <p className="hidden desktop:block text-[18px] h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text9" />
                  </p>
                  <p className="block desktop:hidden text-[18px] h-full text-tertiary cursor-pointer">
                    <Trans i18nKey="description.text10" />
                  </p>
                </div>

                <button
                  className="text-white p-3 bg-green-600 hover:bg-green-550 active:bg-green-700 dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none flex gap-2"
                  type="reset"
                  onClick={() => handleShareSettingsModal()}
                >
                  <div className="hidden desktop:block">
                    <Trans i18nKey="description.custom9" />
                  </div>
                  <img
                    src={share_icon}
                    alt="share_icon"
                    className="hidden desktop:block h-[20px] w-[20px] cursor-pointer"
                  />
                  <img
                    src={share_icon}
                    alt="share_icon"
                    className="block desktop:hidden h-[30px] w-[30px] cursor-pointer"
                  />
                </button>

                <button
                  className="text-black p-3 bg-bg_reset_default active:bg-bg_reset_default_pressed dark:border-border_dark rounded-lg justify-center items-center md:w-fit shadow-lg dark:shadow-dark border select-none"
                  type="reset"
                  onClick={resetDefault}
                >
                  <div className="hidden desktop:block">
                    <Trans i18nKey="description.custom7" />
                  </div>
                  <div className="block desktop:hidden">
                    <Trans i18nKey="description.custom10" />
                  </div>
                </button>
              </div>
            </div>
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
            <div className="sm:flex flex-col hidden gap-4">
              <div className="flex flex-wrap items-center gap-4 select-none">
                <div className="flex-shrink-0 flex items-center gap-2 min-w-fit">
                  <p className="flex-shrink-0 text-[18px] whitespace-nowrap">
                    <Trans i18nKey="description.choose" />
                  </p>
                  <img
                    src={help}
                    alt="help"
                    className="h-[20px] w-[20px] cursor-pointer"
                    onClick={() => setShowHelpModal(true)}
                  />
                </div>

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
                    <div
                      className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                      style={{ backgroundColor: modelStatus.color }}
                    />
                    <div className="mx-2 text-xl overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                      {modelSettings.model}
                    </div>
                    {isImageSupported && (
                      <img
                        src={image_supported}
                        alt="image_supported"
                        className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 mr-2"
                      />
                    )}
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
                          <div
                            className="h-[8px] w-[8px] rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: getStatusColor(option.status),
                            }}
                          />
                          <div className="flex-1 text-left overflow-hidden text-ellipsis whitespace-nowrap">
                            {option.name}
                          </div>
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
                <Trans i18nKey="description.text6" />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

SettingsPanel.defaultProps = {};

export default SettingsPanel;
