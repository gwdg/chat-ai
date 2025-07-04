import { Trans } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import ContainerModal from "./ContainerModal";
import cross from "../assets/cross.svg";
// Import your icons
import image_supported from "../assets/image_supported.svg";
import video_icon from "../assets/video_icon.svg";
import thought_supported from "../assets/thought_supported.svg";
import books from "../assets/books.svg";
import DemandStatusIcon from "../components/Others/DemandStatusIcon";
import {
  selectDefaultModel,
  setDefaultModel,
} from "../Redux/reducers/defaultModelSlice";
import { selectAllMemories } from "../Redux/reducers/userMemorySlice";
import { setTimeoutTime } from "../Redux/reducers/timeoutReducer";
import { useEffect } from "react";

function SettingsModal(props) {
  const dispatch = useDispatch();
  const currentDefaultModel = useSelector(selectDefaultModel);
  const memories = useSelector(selectAllMemories);
  const timeoutTime = useSelector((state) => state.timeout.timeoutTime);

  const handleLogout = () => {
    window.location.href =
      "https://keycloak.sso.gwdg.de/auth/realms/academiccloud/protocol/openid-connect/logout";
  };

  const handleChangeModel = (selectedModel) => {
    dispatch(
      setDefaultModel({
        name: selectedModel.name,
        id: selectedModel.id,
      })
    );
  };

  useEffect(() => {
    // Initialize timeout if it's not set (first load)
    if (!timeoutTime || timeoutTime === 0) {
      dispatch(setTimeoutTime(300000)); // Default 300 seconds
    }
  }, [timeoutTime, dispatch]);

  // Convert milliseconds to seconds for display, with fallback
  const timeoutInSeconds = timeoutTime ? Math.round(timeoutTime / 1000) : 30;

  const handleTimeoutChange = (event) => {
    const newTimeoutSeconds = parseInt(event.target.value) || 30;
    const newTimeoutMs = newTimeoutSeconds * 1000;
    dispatch(setTimeoutTime(newTimeoutMs));
  };

  return (
    <ContainerModal showModal={props.showModal} isSettingsModel={true}>
      <div className="select-none border dark:border-border_dark rounded-2xl bg-white dark:bg-black w-full">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-4 pt-4">
          <p className="text-xl text-tertiary">
            <Trans i18nKey="description.settings.userProfileSettings" />
          </p>
          <img
            src={cross}
            alt="cross"
            className="h-[30px] w-[30px] cursor-pointer p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            onClick={() => props.showModal(false)}
          />
        </div>

        {/* User Profile Section */}
        <div className="p-4 flex items-center justify-between gap-3 border-b dark:border-border_dark">
          <div className="flex flex-col">
            <span className="font-medium text-lg dark:text-white">
              {(() => {
                const first = props.userData?.firstname ?? "";
                const last = props.userData?.lastname ?? "";
                return first === "" && last === "" ? (
                  <Trans i18nKey="description.common.loading" />
                ) : (
                  `${first} ${last}`.trim()
                );
              })()}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {props.userData?.organization ?? (
                <Trans i18nKey="description.common.loading" />
              )}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-lg dark:text-white">
              {props.userData?.username ?? (
                <Trans i18nKey="description.common.loading" />
              )}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {props.userData?.email ?? (
                <Trans i18nKey="description.common.loading" />
              )}
            </span>
          </div>
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="max-w-[250px] w-full p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <p>
              <Trans i18nKey="description.settings.logout" />
            </p>
          </button>
        </div>

        {/* Settings Content */}
        <div className="p-4 flex flex-col gap-6">
          {/* Default Model Selection Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <p className="text-base font-medium dark:text-white">
                <Trans i18nKey="description.settings.defaultModel" />
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <Trans
                i18nKey="description.settings.defaultModelDescription"
                values={{ currentModel: currentDefaultModel?.name }}
              />
            </p>
            <div className="border dark:border-border_dark rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
              {props.modelList?.map((option, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 text-tertiary text-xl w-full px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    currentDefaultModel?.id === option.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                      : ""
                  }`}
                  onClick={() => handleChangeModel(option)}
                >
                  <DemandStatusIcon
                    status={option?.status}
                    demand={option?.demand}
                  />
                  <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {option.name}
                  </div>
                  {option.input?.includes("image") && (
                    <img
                      src={image_supported}
                      alt="image_supported"
                      className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                    />
                  )}
                  {option.input?.includes("video") && (
                    <img
                      src={video_icon}
                      alt="video_icon"
                      className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                    />
                  )}
                  {option.output?.includes("thought") && (
                    <img
                      src={thought_supported}
                      alt="thought_supported"
                      className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                    />
                  )}
                  {option.input?.includes("arcana") && (
                    <img
                      src={books}
                      alt="books"
                      className="h-[20px] w-[20px] cursor-pointer flex-shrink-0 ml-0.5"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Request Timeout Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏱️</span>
              <p className="text-base font-medium dark:text-white">
                <Trans
                  i18nKey="description.settings_timeout.requestTimeout"
                  defaultValue="Request Timeout"
                />
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <Trans
                i18nKey="description.settings_timeout.requestTimeoutDescription"
                defaultValue="Set how long to wait for AI responses before timing out."
              />
            </p>

            {/* Fixed timeout input */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Trans
                    i18nKey="description.settings_timeout.timeoutSeconds"
                    defaultValue="Timeout (seconds)"
                  />
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="900"
                    step="5"
                    value={timeoutInSeconds}
                    onChange={handleTimeoutChange}
                    className="w-full pl-3 pr-16 py-2 border dark:border-border_dark rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="300"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 pointer-events-none">
                    secs
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <Trans
                    i18nKey="description.settings_timeout.timeoutRange"
                    defaultValue="Range: 5-300 seconds"
                  />
                </p>
              </div>
            </div>
          </div>

          {/* User Memory Management Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-base font-medium dark:text-white">
                <Trans
                  i18nKey="description.settings.userMemory"
                  defaultValue="User Memory"
                />
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <Trans
                i18nKey="description.settings.userMemoryDescription"
                defaultValue="Manage your personal memories that help the AI remember important details about you. You currently have {{count}} memories saved."
                values={{ count: memories.length }}
              />
            </p>
            <div className="w-full flex justify-center">
              <button
                className="max-w-[250px] w-full p-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
                onClick={() => props.setShowMemoryModal(true)}
              >
                <span>🧠</span>
                <Trans
                  i18nKey="description.settings.manageMemory"
                  defaultValue="Manage Memory"
                />
                <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                  {memories.length}
                </span>
              </button>
            </div>
          </div>

          {/* Clear Chats Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="text-base font-medium dark:text-white">
                <Trans i18nKey="description.settings.clearAllChats" />
              </p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              <Trans i18nKey="description.settings.clearAllChatsDescription" />
            </p>
            <div className="w-full flex justify-center">
              <button
                className="max-w-[250px] w-full p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl flex items-center justify-center gap-2 transition-colors"
                onClick={() => props.setShowCacheModal(true)}
              >
                <Trans i18nKey="description.file2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ContainerModal>
  );
}

export default SettingsModal;
