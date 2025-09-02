import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useModal } from "../../modals/ModalContext";
import { useSelector, useDispatch } from "react-redux";

import { HelpCircle } from "lucide-react";
import icon_support_vision from "../../assets/icons/support_vision.svg";
import icon_support_audio from "../../assets/icons/support_audio.svg";
import icon_support_video from "../../assets/icons/support_video.svg";
import icon_support_reasoning from "../../assets/icons/support_reasoning.svg";
import icon_support_arcana from "../../assets/icons/support_arcana.svg";
import icon_dropdown from "../../assets/icons/dropdown.svg";
import DemandStatusIcon from "./DemandStatusIcon";

export default function ModelSelector({
  localState,
  setLocalState,
  modelsData,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { openModal } = useModal();
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState("down");
  const dropdownRef = useRef(null);
  const dispatch = useDispatch();

  // Toggle dropdown open/close state
  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  // Conversation state management
  const currentModel = localState?.settings?.model;

  // Handle model selection changes
  const handleModelChange = useCallback(
    (model) => {
      if (!model) return;
      console.log("Changing model to ", model);
      if (model?.status === "offline") {
        openModal("serviceOffline");
      }
      setLocalState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          model: model,
        },
      }));
    },
    [dispatch]
  );

  // Filter function to search through models
  const filteredModelList = useMemo(() => {
    if (!searchQuery.trim()) {
      return modelsData;
    }

    const query = searchQuery.toLowerCase();

    return modelsData.filter((model) => {
      // Search by model name
      const nameMatch = model.name.toLowerCase().includes(query);

      // Search by input types (text, image, audio, video, arcana)
      const inputMatch = model.input.some((inputType) =>
        inputType.toLowerCase().includes(query)
      );

      // Search by output types (text, thought)
      const outputMatch = model.output.some((outputType) =>
        outputType.toLowerCase().includes(query)
      );

      // Search by status
      const statusMatch = model.status.toLowerCase().includes(query);

      // Search by owner
      const ownerMatch = model.owned_by.toLowerCase().includes(query);

      return (
        nameMatch || inputMatch || outputMatch || statusMatch || ownerMatch
      );
    });
  }, [modelsData, searchQuery]);

  return (
    <div className="flex flex-wrap items-center gap-4 select-none">
      <div
        className="relative flex-1 min-w-[200px]"
        ref={dropdownRef}
        tabIndex={0}
        onBlur={(e) => {
          // Only close if the new focus target is not within this dropdown
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <div
          // className="text-tertiary flex items-center mt-1 cursor-pointer text-sm w-full py-[10px] px-3 appearance-none focus:outline-none rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark"
          className="text-tertiary flex items-center mt-1 cursor-pointer text-sm w-full py-[8px] px-3 appearance-none focus:outline-none rounded-2xl border:none  bg-white dark:bg-black"
          onClick={toggleOpen}
        >
          <div className="flex items-center gap-2 w-full">
            <DemandStatusIcon
              status={currentModel?.status}
              demand={currentModel?.demand}
            />
            <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {currentModel?.name || currentModel || "Select Model"}
            </div>
            {(currentModel?.input?.includes("audio") || false) && (
              <img
                src={icon_support_audio}
                alt="audio_supported"
                className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 mx-0.5"
              />
            )}
            {(currentModel?.input?.includes("image") || false) && (
              <img
                src={icon_support_vision}
                alt="image_supported"
                className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 mx-0.5"
              />
            )}
            {(currentModel?.input?.includes("video") || false) && (
              <img
                src={icon_support_video}
                alt="video_icon"
                className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 mx-0.5"
              />
            )}
            {(currentModel?.output?.includes("thought") || false) && (
              <img
                src={icon_support_reasoning}
                alt="thought_supported"
                className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 mx-0.5"
              />
            )}

            {(currentModel?.input?.includes("arcana") || false) && (
              <img
                src={icon_support_arcana}
                alt="books"
                className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 mx-0.5"
              />
            )}
            <img
              src={icon_dropdown}
              alt="drop-down"
              className="h-[24px] w-[24px] cursor-pointer flex-shrink-0"
            />
            <HelpCircle
              className="h-[20px] w-[20px] cursor-pointer text-[#009EE0]"
              alt="help"
              onClick={() => openModal("helpModels")}
            />
          </div>
        </div>

        {isOpen && (
          <div
            className={`absolute w-full ${
              direction === "up" ? "bottom-full" : "top-full"
            } mt-1 rounded-2xl  z-[99] max-h-[280px] bg-white dark:bg-black shadow-lg`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Search Input */}
            <div className="p-3 sticky top-0 bg-white dark:bg-black rounded-t-2xl">
              <div className="relative">
                <input
                  type="text"
                  // TODO use translation
                  placeholder={"Search models..."}
                  value={searchQuery}
                  autoFocus={true}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg  bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Model List Container */}
            <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
              {filteredModelList.length > 0 ? (
                <div className="py-1">
                  {filteredModelList.map((option, index) => (
                    <div
                      key={option.id}
                      className={`group flex items-center gap-2 w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        index === filteredModelList.length - 1
                          ? "rounded-b-2xl"
                          : ""
                      }`}
                      onClick={() => {
                        handleModelChange(option);
                        toggleOpen();
                        setSearchQuery("");
                      }}
                    >
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        <DemandStatusIcon
                          status={option?.status}
                          demand={option?.demand}
                        />
                      </div>

                      {/* Model Name - with proper text handling */}
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="text-sm text-tertiary truncate">
                          {option.name}
                        </div>
                      </div>

                      {/* Capability Icons */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {option.input.includes("audio") && (
                          <img
                            src={icon_support_audio}
                            alt="audio_supported"
                            className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 ml-0.5"
                          />
                        )}
                        {option.input.includes("image") && (
                          <img
                            src={icon_support_vision}
                            alt="image_supported"
                            className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 ml-0.5"
                          />
                        )}
                        {option.input.includes("video") && (
                          <img
                            src={icon_support_video}
                            alt="video_icon"
                            className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 ml-0.5"
                          />
                        )}
                        {option.output.includes("thought") && (
                          <img
                            src={icon_support_reasoning}
                            alt="thought_supported"
                            className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 ml-0.5"
                          />
                        )}
                        {option.input.includes("arcana") && (
                          <img
                            src={icon_support_arcana}
                            alt="books"
                            className="h-[16px] w-[16px] cursor-pointer flex-shrink-0 ml-0.5"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                  No models found matching &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
