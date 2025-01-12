import { useCallback, useEffect, useRef, useState } from "react";
import Tooltip from "../Others/Tooltip";
import { getDataFromLLM } from "../../apis/Completion";

//Assets
import retry from "../../assets/icon_retry.svg";
import clear from "../../assets/cross_icon.svg";
import export_icon from "../../assets/export_icon.svg";
import import_icon from "../../assets/import_icon.svg";
import send from "../../assets/icon_send.svg";
import edit_icon from "../../assets/edit_icon.svg";
import icon_resend from "../../assets/icon_resend.svg";
import ResponseItem from "../Markdown/ResponseItem";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

//Variable
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

function Responses({
  modelList,
  localState,
  adjustHeight,
  loading,
  notifySuccess,
  notifyError,
  updateLocalState,
  setLocalState,
  setShowModelSession,
  setShowBadRequest,
  setSelectedFiles,
  setShowHistoryModel,
  clearHistory,
  updateSettings,
  setShowFileModel,
}) {
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  const { t } = useTranslation();

  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [indexChecked, setIndexChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  const containerRef = useRef(null);
  const containerRefs = useRef([]);
  const textareaRefs = useRef([]);
  const hiddenFileInputJSON = useRef(null);
  const lastScrollPosition = useRef(0);
  const messagesEndRef = useRef(null);

  //Variable
  const isLoading = loading || loadingResend;

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

  const handleClickJSON = () => {
    hiddenFileInputJSON.current.value = null;
    hiddenFileInputJSON.current.click();
  };

  const handleEditClick = (index, prompt) => {
    setEditingIndex(index);
    setEditedText(prompt);
    setTimeout(() => adjustHeight(index), 0);
  };
  const handleCloseClick = useCallback(
    (index) => {
      if (editingIndex === index) {
        setEditingIndex(null);
      }
    },
    [editingIndex]
  );

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
  const handleClearHistory = () => {
    if (localState.dontShow.dontShowAgain) {
      clearHistory();
    } else {
      setShowHistoryModel(true);
    }
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

  const handleScroll = useCallback(() => {
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

  const adjustHeightRefs = (index) => {
    if (textareaRefs.current[index]) {
      const textarea = textareaRefs.current[index];
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
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
        if (
          containerRefs.current[index] &&
          !containerRefs.current[index].contains(event.target) &&
          textareaRefs.current[index] !== event.target
        ) {
          handleCloseClick(index);
          setIsEditing(false);
        }
      });
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isEditing, localState.responses, handleCloseClick]);
  useEffect(() => {
    adjustHeight();
  }, [localState.prompt, editedText, adjustHeight]);
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
    <>
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
                  if (imageObj.type === "image_url" && imageObj.image_url.url) {
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
              isDarkModeGlobal={isDarkModeGlobal}
              copied={copied}
              setCopied={setCopied}
              indexChecked={indexChecked}
              setIndexChecked={setIndexChecked}
              loading={loading}
              loadingResend={loadingResend}
              responses={localState.responses}
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
    </>
  );
}

export default Responses;
