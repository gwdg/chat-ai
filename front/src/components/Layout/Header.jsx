import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef, useMemo } from "react";

// Asset imports for icons and images
import Light from "../../assets/light.svg";
import Dark from "../../assets/dark.svg";
import hamburger_icon from "../../assets/hamburger_icon.svg";
import profile_icon from "../../assets/profile_icon.svg";
import Logo from "../../assets/chatai-logo.svg";
import help from "../../assets/icon_help.svg";
import audio_supported from "../../assets/audio_supported.svg";
import image_supported from "../../assets/image_supported.svg";
import video_icon from "../../assets/video_icon.svg";
import thought_supported from "../../assets/thought_supported.svg";
import books from "../../assets/books.svg";
import HelpModal from "../../modals/HelpModal";
import SessionExpiredModal from "../../modals/SessionExpiredModal";
import DemandStatusIcon from "../Others/DemandStatusIcon";
import { toggleTheme } from "../../Redux/reducers/themeReducer";
import { useTranslation } from "react-i18next";

function Header({
  onMenuClick,
  modelSettings,
  modelList,
  onModelChange,
  setShowSettingsModal,
  userData,
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // Note: Announcement count functionality currently disabled
  // const closeCount = useSelector((state) => state.anncCount);

  // UI state management
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);

  const [isOpen, setIsOpen] = useState(false); // Controls model selection dropdown
  const [searchQuery, setSearchQuery] = useState("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showModalSession, setShowModalSession] = useState(false);
  // Announcement state currently disabled
  // const [showAnnouncement, setShowAnnouncement] = useState(true);

  // Reference for handling dropdown click-outside behavior
  const dropdownRef = useRef(null);

  // Memoized computed properties for performance optimization

  // Find the currently selected model from the model list
  const currentModel = useMemo(
    () => modelList?.find((m) => m.name === modelSettings?.model),
    [modelList, modelSettings?.model]
  );

  // Filter function to search through models
  const filteredModelList = useMemo(() => {
    if (!searchQuery.trim()) {
      return modelList;
    }

    const query = searchQuery.toLowerCase();

    return modelList.filter((model) => {
      // Search by model name
      const nameMatch = model.name.toLowerCase().includes(query);

      // Search by input types (text, image, video, arcana)
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
  }, [modelList, searchQuery]);

  const handleModelSelection = (option) => {
    handleChangeModel(option);
    setSearchQuery("");
    setIsOpen(false);
  };

  // Check if current model supports image input
  const isAudioSupported = useMemo(
    () => currentModel?.input.includes("audio") || false,
    [currentModel]
  );

  // Check if current model supports image input
  const isImageSupported = useMemo(
    () => currentModel?.input.includes("image") || false,
    [currentModel]
  );

  const isVideoSupported = useMemo(
    () => currentModel?.input.includes("video") || false,
    [currentModel]
  );
  // Check if current model supports thought output
  const isThoughtSupported = useMemo(
    () => currentModel?.output.includes("thought") || false,
    [currentModel]
  );

  // Check if current model supports arcana
  const isArcanaSupported = useMemo(
    () => currentModel?.input.includes("arcana") || false,
    [currentModel]
  );

  // Handler for model selection changes
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };

  /**
   * Extracts initials from username for avatar display
   * Handles both dot-separated names (e.g., "john.doe") and regular usernames
   */
  const getInitials = (username) => {
    if (!username) return "";

    if (username.includes(".")) {
      const [first, last] = username.split(".");
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }

    return username.slice(0, 2).toUpperCase();
  };

  // Theme handling effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // Theme toggle handler
  const toggleDarkMode = () => {
    dispatch(toggleTheme());
  };

  // Announcement functionality currently disabled
  // useEffect(() => {
  //   setShowAnnouncement(closeCount < 3);
  // }, []);

  // const handleAnnouncementClose = () => {
  //   setShowAnnouncement(false);
  //   dispatch({
  //     type: "SET_ANNCCOUNT",
  //     payload: closeCount + 1,
  //   });
  // };

  return (
    <>
      {/* Desktop Header - Show above custom breakpoint (1081px) */}
      <nav className="custom:flex hidden top-0 h-14 px-4 items-center justify-between left-0 z-[995] w-full bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu - Only show below desktop (1281px) */}
          <button
            onClick={onMenuClick}
            className="desktop:hidden hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <img className="h-5 w-5" src={hamburger_icon} alt="Menu" />
          </button>

          {/* Theme toggle */}
          <button
            className="h-9 w-9 transition-all hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center justify-center touch-manipulation"
            onClick={toggleDarkMode}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {isDarkMode ? (
              <img className="h-5 w-5" src={Light} alt="Light Mode" />
            ) : (
              <img className="h-5 w-5 -rotate-45" src={Dark} alt="Dark Mode" />
            )}
          </button>

          {/* Logo */}
          <div className="flex items-center border-l border-gray-200 dark:border-gray-700 pl-3">
            <img
              className="h-8 w-auto object-contain"
              src={Logo}
              alt="Chat AI Logo"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Partner logos */}
          <div className="hidden middle:flex desktop:flex items-center gap-3">
            <Link to={"https://kisski.gwdg.de/"} target="_blank">
              <div className="bg-kisski-logo-large h-8 w-28 bg-repeat-round transition-all hover:opacity-80 rounded"></div>
            </Link>
            <Link to={"https://gwdg.de/"} target="_blank">
              <div className="bg-logo-large h-8 w-28 bg-repeat-round transition-all hover:opacity-80 rounded"></div>
            </Link>
          </div>

          {/* User profile */}
          {userData?.username ? (
            <div
              className="cursor-pointer border-l border-gray-200 dark:border-gray-700 pl-3 hover:opacity-80 transition-opacity touch-manipulation"
              onClick={() => setShowSettingsModal(true)}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <div className="user-profile-button w-9 h-9 rounded-lg border-2 border-tertiary flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <span className="text-tertiary font-medium text-sm">
                  {getInitials(userData.username)}
                </span>
              </div>
            </div>
          ) : (
            <button
              className="h-9 w-9 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-lg p-2 touch-manipulation border-l border-gray-200 dark:border-gray-700 ml-3"
              onClick={() => setShowSettingsModal(true)}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img className="h-full w-full" src={profile_icon} alt="Profile" />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Header - Show below custom breakpoint (1081px) */}
      <nav className="custom:hidden flex top-0 left-0 z-[995] w-full h-14 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800">
        <div className="w-full px-4 flex items-center gap-3">
          {/* Left Section */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation w-8 h-8 min-[400px]:w-9 min-[400px]:h-9 min-[500px]:w-10 min-[500px]:h-10 flex items-center justify-center"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img
                className="h-4 w-4 min-[400px]:h-4 min-[400px]:w-4 min-[500px]:h-5 min-[500px]:w-5 flex-shrink-0"
                src={hamburger_icon}
                alt="Menu"
              />
            </button>

            {/* Mobile logo */}
            <div className="flex-shrink-0">
              <img
                className="h-6 min-[400px]:h-7 min-[500px]:h-8 w-auto object-contain"
                src={Logo}
                alt="Chat AI Logo"
              />
            </div>
          </div>

          {/* Center - Model Selection */}
          <div
            className="flex-shrink flex-grow min-w-0 px-2 relative"
            style={{ maxWidth: "calc(100vw - 200px)" }}
            ref={dropdownRef}
            tabIndex={0}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setIsOpen(false);
              }
            }}
          >
            {/* Model selector */}
            <div
              className="flex items-center w-full gap-2 px-3 py-2 rounded-lg 
            bg-gray-50 dark:bg-gray-800
            hover:bg-gray-100 dark:hover:bg-gray-700 
            border border-gray-200 dark:border-gray-700
            text-gray-900 dark:text-gray-100
            transition-colors cursor-pointer touch-manipulation"
              onClick={() => setIsOpen(!isOpen)}
              style={{
                WebkitTapHighlightColor: "transparent",
                minHeight: "40px",
              }}
            >
              <DemandStatusIcon
                status={currentModel?.status}
                demand={currentModel?.demand}
              />
              <div className="flex-1 text-sm truncate font-medium">
                {modelSettings["model-name"]}
              </div>
              {/* Icons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAudioSupported && (
                  <img
                    src={audio_supported}
                    alt="audio_supported"
                    className="h-4 w-4 flex-shrink-0"
                  />
                )}
                {isImageSupported && (
                  <img
                    src={image_supported}
                    alt="image_supported"
                    className="h-4 w-4 flex-shrink-0"
                  />
                )}
                {isVideoSupported && (
                  <img
                    src={video_icon}
                    alt="video_icon"
                    className="h-4 w-4 cursor-pointer flex-shrink-0"
                  />
                )}
                {isThoughtSupported && (
                  <img
                    src={thought_supported}
                    alt="thought_supported"
                    className="h-4 w-4 flex-shrink-0"
                  />
                )}
                {isArcanaSupported && (
                  <img
                    src={books}
                    alt="books"
                    className="h-4 w-4 flex-shrink-0"
                  />
                )}
                {/* Dropdown arrow */}
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {isOpen && (
              <div
                className="fixed z-[999] left-0 right-0 top-14
              bg-white dark:bg-gray-800 
              shadow-xl dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] 
              rounded-none border-t border-gray-200 dark:border-gray-700
              max-h-80 overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                {/* Search Input */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                  <input
                    type="text"
                    placeholder={t("description.placeholder_modelList")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent"
                    onMouseDown={(e) => e.stopPropagation()}
                    autoFocus
                    style={{
                      WebkitTapHighlightColor: "transparent",
                      fontSize: "16px",
                    }}
                  />
                </div>

                {/* Model List Container */}
                <div
                  className="max-h-64 overflow-y-auto overflow-x-hidden"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    overscrollBehavior: "contain",
                  }}
                >
                  {filteredModelList.length > 0 ? (
                    filteredModelList.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-3 px-4 py-4
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      text-gray-900 dark:text-gray-100 
                      border-b border-gray-100 dark:border-gray-700 
                      last:border-0
                      transition-colors cursor-pointer touch-manipulation"
                        onClick={() => handleModelSelection(option)}
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          minHeight: "56px",
                        }}
                      >
                        <DemandStatusIcon
                          status={option?.status}
                          demand={option?.demand}
                        />
                        <div className="flex-1 text-sm min-w-0 mr-2">
                          <div className="truncate font-medium">
                            {option.name}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {option.input.includes("audio") && (
                            <img
                              src={audio_supported}
                              alt="audio_supported"
                              className="h-4 w-4 flex-shrink-0"
                            />
                          )}
                          {option.input.includes("image") && (
                            <img
                              src={image_supported}
                              alt="image_supported"
                              className="h-4 w-4 flex-shrink-0"
                            />
                          )}
                          {option.input.includes("video") && (
                            <img
                              src={video_icon}
                              alt="video_icon"
                              className="h-4 w-4 cursor-pointer flex-shrink-0"
                            />
                          )}
                          {option.output.includes("thought") && (
                            <img
                              src={thought_supported}
                              alt="thought_supported"
                              className="h-4 w-4 cursor-pointer flex-shrink-0"
                            />
                          )}
                          {option.input.includes("arcana") && (
                            <img
                              src={books}
                              alt="books"
                              className="h-4 w-4 cursor-pointer flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-base">
                      No models found matching &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Help icon */}
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation w-10 h-10 flex items-center justify-center"
              onClick={(event) => {
                event.stopPropagation();
                setShowHelpModal(true);
              }}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <img src={help} alt="help" className="h-5 w-5 flex-shrink-0" />
            </button>

            {/* Theme toggle */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation w-10 h-10 flex items-center justify-center"
              onClick={toggleDarkMode}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isDarkMode ? (
                <img
                  className="h-5 w-5 flex-shrink-0"
                  src={Light}
                  alt="Light Mode"
                />
              ) : (
                <img
                  className="h-5 w-5 -rotate-45 flex-shrink-0"
                  src={Dark}
                  alt="Dark Mode"
                />
              )}
            </button>

            {/* User profile */}
            {userData?.username ? (
              <div
                className="cursor-pointer touch-manipulation w-10 h-10 flex items-center justify-center"
                onClick={() => setShowSettingsModal(true)}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="w-9 h-9 rounded-lg border-2 border-tertiary flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <span className="text-tertiary font-medium text-sm">
                    {getInitials(userData.username)}
                  </span>
                </div>
              </div>
            ) : (
              <button
                className="cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation w-10 h-10 flex items-center justify-center"
                onClick={() => setShowSettingsModal(true)}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <img
                  className="h-5 w-5 flex-shrink-0"
                  src={profile_icon}
                  alt="Profile"
                />
              </button>
            )}
          </div>
        </div>
      </nav>

      {showHelpModal && <HelpModal showModal={setShowHelpModal} />}
      {showModalSession && (
        <SessionExpiredModal showModal={setShowModalSession} />
      )}
    </>
  );
}

export default Header;
