import { useEffect } from "react";
import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { useModal } from "../ModalContext"; 
import BaseModal from "../BaseModal";

import audio_supported from "../../assets/audio_supported.svg";
import image_supported from "../../assets/image_supported.svg";
import video_icon from "../../assets/video_icon.svg";
import thought_supported from "../../assets/thought_supported.svg";
import books from "../../assets/books.svg";
import DemandStatusIcon from "../../components/Others/DemandStatusIcon";

import {
  selectDefaultModel,
  setDefaultModel,
} from "../../Redux/reducers/defaultModelSlice";
import { selectAllMemories } from "../../Redux/reducers/userMemorySlice";
import { setTimeoutTime } from "../../Redux/reducers/timeoutReducer";

export default function UserSettingsModal({
  isOpen,
  onClose,
  userData,
  modelsData,
  localState,
}) {
  const { openModal } = useModal();
  const dispatch = useDispatch();
  
  const currentDefaultModel = useSelector(selectDefaultModel);
  const memories = useSelector(selectAllMemories);
  const timeoutTime = useSelector((state) => state.timeout.timeoutTime);

  const handleLogout = () => {
    window.location.href =
      "https://keycloak.sso.gwdg.de/auth/realms/academiccloud/protocol/openid-connect/logout";
  };

  const handleChangeModel = (selectedModel) => {
    dispatch(setDefaultModel({
      name: selectedModel.name,
      id: selectedModel.id,
    }));
  };

  useEffect(() => {
    if (!timeoutTime || timeoutTime === 0) {
      dispatch(setTimeoutTime(300000)); // default 300 seconds
    }
  }, [timeoutTime, dispatch]);

  const timeoutInSeconds = timeoutTime ? Math.round(timeoutTime / 1000) : 30;

  const handleTimeoutChange = (event) => {
    const newTimeoutSeconds = parseInt(event.target.value) || 30;
    dispatch(setTimeoutTime(newTimeoutSeconds * 1000));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="description.settings.userProfileSettings"
      maxWidth="max-w-3xl"
    >
      {/* USER PROFILE SECTION */}
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b dark:border-border_dark flex-shrink-0">
        <div className="flex flex-col">
          <span className="font-medium text-sm dark:text-white">
            {(() => {
              const first = userData?.firstname ?? "";
              const last = userData?.lastname ?? "";
              return first === "" && last === "" ? (
                <Trans i18nKey="description.common.loading" />
              ) : (
                `${first} ${last}`.trim()
              );
            })()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {userData?.organization ?? <Trans i18nKey="description.common.loading" />}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-sm dark:text-white">
            {userData?.username ?? <Trans i18nKey="description.common.loading" />}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {userData?.email ?? <Trans i18nKey="description.common.loading" />}
          </span>
        </div>
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full sm:max-w-[200px] p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <p className="text-sm">
            <Trans i18nKey="description.settings.logout" />
          </p>
        </button>
      </div>

      {/* MAIN SETTINGS CONTENT */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
        
        {/* Default Model Selection */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings.defaultModel" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans
              i18nKey="description.settings.defaultModelDescription"
              values={{ currentModel: currentDefaultModel?.name }}
            />
          </p>
          <div className="border dark:border-border_dark rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
            {modelsData?.map((option, index) => (
              <div
                key={index}
                onClick={() => handleChangeModel(option)}
                className={`flex items-center gap-2 text-tertiary text-sm w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  currentDefaultModel?.id === option.id
                    ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                    : ""
                }`}
              >
                <DemandStatusIcon status={option?.status} demand={option?.demand} />
                <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {option.name}
                </div>
                {option.input?.includes("audio") && (
                  <img src={audio_supported} alt="audio" className="h-[16px] w-[16px]" />
                )}
                {option.input?.includes("image") && (
                  <img src={image_supported} alt="image" className="h-[16px] w-[16px]" />
                )}
                {option.input?.includes("video") && (
                  <img src={video_icon} alt="video" className="h-[16px] w-[16px]" />
                )}
                {option.output?.includes("thought") && (
                  <img src={thought_supported} alt="thought" className="h-[16px] w-[16px]" />
                )}
                {option.input?.includes("arcana") && (
                  <img src={books} alt="books" className="h-[16px] w-[16px]" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Request Timeout */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">⏱️</span>
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings_timeout.requestTimeout" defaultValue="Request Timeout" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans
              i18nKey="description.settings_timeout.requestTimeoutDescription"
              defaultValue="Set how long to wait for AI responses before timing out."
            />
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Trans i18nKey="description.settings_timeout.timeoutSeconds" defaultValue="Timeout (seconds)" />
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="900"
                  step="5"
                  value={timeoutInSeconds}
                  onChange={handleTimeoutChange}
                  className="w-full pl-3 pr-16 py-2 border dark:border-border_dark rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                  secs
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                <Trans i18nKey="description.settings_timeout.timeoutRange" defaultValue="Range: 5-300 seconds" />
              </p>
            </div>
          </div>
        </div>

        {/* User Memory Management */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings.userMemory" defaultValue="User Memory" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans
              i18nKey="description.settings.userMemoryDescription"
              defaultValue="Manage your personal memories..."
              values={{ count: memories.length }}
            />
          </p>
          <div className="w-full flex justify-center">
            <button
              className="w-full sm:max-w-[200px] p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
              onClick={() => openModal("userMemory", { localState })}
            >
              <span className="text-sm">🧠</span>
              <span className="text-sm">
                <Trans i18nKey="description.settings.manageMemory" defaultValue="Manage Memory" />
              </span>
              <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                {memories.length}
              </span>
            </button>
          </div>
        </div>

        {/* Clear Chats */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium dark:text-white">
              <Trans i18nKey="description.settings.clearAllChats" />
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            <Trans i18nKey="description.settings.clearAllChatsDescription" />
          </p>
          <div className="w-full flex justify-center">
            <button
              className="w-full sm:max-w-[200px] p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-2 transition-colors text-sm"
              onClick={() => openModal("clearCache")}
            >
              <Trans i18nKey="description.file2" />
            </button>
          </div>
        </div>

      </div>
    </BaseModal>
  );
}