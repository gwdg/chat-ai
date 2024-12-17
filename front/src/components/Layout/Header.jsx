import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef, useMemo } from "react";

// Assets
import Light from "../../assets/light.svg";
import Dark from "../../assets/dark.svg";
import hamburger_icon from "../../assets/hamburger_icon.svg";
import profile_icon from "../../assets/profile_icon.svg";
import Logo from "../../assets/chatai-logo-v3-preview.png";
import help from "../../assets/icon_help.svg";
import image_supported from "../../assets/image_supported.svg";
import Help_Model from "../../model/Help_Model";
import Session_Expired from "../../model/Session_Expired";
import AnnouncementBar from "../Others/AnnouncementBar";

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

function Header({
  onMenuClick,
  modelSettings,
  modelList,
  onModelChange,
  setShowSettingsModel,
  userData,
}) {
  const dispatch = useDispatch();
  const closeCount = useSelector((state) => state.anncCount);

  // UI States
  const [isDarkMode, setIsDarkMode] = useState(
    useSelector((state) => state.theme.isDarkMode)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isIOSChrome, setIsIOSChrome] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [showModelSession, setShowModelSession] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const dropdownRef = useRef(null);

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

  // Handle model change
  const handleChangeModel = (option) => {
    onModelChange(option.name, option.id);
    setIsOpen(false);
  };

  const getInitials = (username) => {
    if (!username) return "";

    if (username.includes(".")) {
      const [first, last] = username.split(".");
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }

    return username.slice(0, 2).toUpperCase();
  };
  // Theme handling
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    dispatch({ type: "SET_THEME" });
  };

  // Detect iOS Chrome
  useEffect(() => {
    setIsIOSChrome(!!navigator.userAgent.match("CriOS"));
  }, []);

  useEffect(() => {
    setShowAnnouncement(closeCount < 3);
  }, []);

  const handleAnnouncementClose = () => {
    // Immediately hide the announcement
    setShowAnnouncement(false);

    // Update the Redux store with the new count
    dispatch({
      type: "SET_ANNCCOUNT",
      payload: closeCount + 1,
    });
  };

  return (
    <>
      {showAnnouncement && closeCount < 3 && (
        <AnnouncementBar onClose={handleAnnouncementClose} />
      )}
      {/* Desktop Header */}
      <nav
        className="top-0 min-h-[60px] px-2 sm:px-4 items-center justify-between left-0 mobile:hidden flex z-[995] w-full bg-white dark:bg-black shadow-lg"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Hamburger Menu */}
          <button
            onClick={onMenuClick}
            className="custom:hidden hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <img
              className="h-[32px] w-[32px] sm:h-[40px] sm:w-[40px]"
              src={hamburger_icon}
              alt="Menu"
            />
          </button>

          <button
            className="border-r border-primary pr-2 sm:pr-4 h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] transition-all"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? (
              <img className="h-full w-full p-1" src={Light} alt="Light Mode" />
            ) : (
              <img
                className="h-full w-full p-1 -rotate-45"
                src={Dark}
                alt="Dark Mode"
              />
            )}
          </button>

          <Link to={"/"} className="flex items-center">
            <img
              className="h-[30px] w-[100px] sm:h-[40px] sm:w-[125px] object-contain"
              src={Logo}
              alt="Chat AI Logo"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block">
            <Link to={"https://kisski.gwdg.de/"} target="_blank">
              <div className="bg-kisski-logo-small sm:bg-kisski-logo-large h-[45px] w-[145px] bg-repeat-round transition-all"></div>
            </Link>
          </div>
          <div className="hidden sm:block border-l border-primary px-2 sm:px-4">
            <Link to={"https://gwdg.de/"} target="_blank">
              <div className="bg-logo-small sm:bg-logo-large h-[45px] w-[145px] bg-repeat-round transition-all"></div>
            </Link>
          </div>
          {userData?.username ? (
            <div
              className="cursor-pointer border-l border-primary pl-2 sm:pl-4"
              onClick={() => setShowSettingsModel(true)}
            >
              <div className="w-[32px] h-[32px] rounded-full border-[3px] border-tertiary flex items-center justify-center">
                <span className="text-tertiary font-medium">
                  {getInitials(userData.username)}
                </span>
              </div>
            </div>
          ) : (
            <img
              className="h-[32px] w-[32px]"
              src={profile_icon}
              alt="Profile"
              onClick={() => setShowSettingsModel(true)}
            />
          )}
        </div>
      </nav>

      {/* Mobile Header */}
      <nav
        className={`top-0 left-0 hidden ${
          isIOSChrome ? "fixed" : ""
        } mobile:flex z-[995] w-full h-[60px] bg-white dark:bg-black shadow-lg`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="w-full px-2 flex items-center justify-between gap-2 border-t border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark relative">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <button
              onClick={onMenuClick}
              className=" hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <img
                className="h-[32px] w-[32px] "
                src={hamburger_icon}
                alt="Menu"
              />
            </button>

            <Link to={"/"}>
              <img
                className="h-[35px] w-[100px] object-contain"
                src={Logo}
                alt="Chat AI Logo"
              />
            </Link>
          </div>

          {/* Full Width Model Selection */}
          <div
            className="flex-1 px-2"
            ref={dropdownRef}
            tabIndex={0}
            onBlur={() => setIsOpen(false)}
          >
            <div
              className="flex items-center w-full gap-2 px-3 py-1.5 rounded-lg 
          bg-gray-50 dark:bg-gray-800
          hover:bg-gray-100 dark:hover:bg-gray-700 
          border border-gray-200 dark:border-gray-700
          text-gray-900 dark:text-gray-100
          transition-colors cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <div
                className="h-[8px] w-[8px] flex-shrink-0 rounded-full"
                style={{ backgroundColor: modelStatus.color }}
              ></div>
              <div className="flex-1 text-sm truncate">
                {modelSettings.model}
              </div>
              {isImageSupported && (
                <img
                  src={image_supported}
                  alt="image_supported"
                  className="h-[18px] w-[18px] flex-shrink-0 "
                />
              )}
            </div>

            {isOpen && (
              <div
                className="absolute z-[999] w-[calc(100%-1rem)] left-2 right-2 top-[calc(100%-0.5rem)] 
          bg-white dark:bg-gray-800 
          shadow-lg dark:shadow-[0_4px_12px_rgba(0,0,0,0.5)] 
          rounded-lg 
          border border-gray-200 dark:border-gray-700
          max-h-[250px] overflow-y-auto"
              >
                {modelList.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center gap-2 px-3 py-2 
                hover:bg-gray-50 dark:hover:bg-gray-700
                text-gray-900 dark:text-gray-100 
                border-b border-gray-100 dark:border-gray-700 
                last:border-0
                transition-colors cursor-pointer"
                    onClick={() => handleChangeModel(option)}
                  >
                    <div
                      className="h-[8px] w-[8px] flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: getStatusColor(option.status),
                      }}
                    ></div>
                    <div className="flex-1 text-sm">{option.name}</div>
                    {option.input.includes("image") && (
                      <img
                        src={image_supported}
                        alt="image_supported"
                        className="h-[18px] w-[18px] flex-shrink-0 "
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            <img
              src={help}
              alt="help"
              className="h-[24px] w-[24px] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(event) => {
                event.stopPropagation();
                setShowHelpModel(true);
              }}
            />

            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              onClick={toggleDarkMode}
            >
              {isDarkMode ? (
                <img
                  className="h-[32px] w-[32px]"
                  src={Light}
                  alt="Light Mode"
                />
              ) : (
                <img
                  className="h-[32px] w-[32px] -rotate-45"
                  src={Dark}
                  alt="Dark Mode"
                />
              )}
            </button>

            {userData?.username ? (
              <div
                className="cursor-pointer border-l border-primary pl-2 sm:pl-4"
                onClick={() => setShowSettingsModel(true)}
              >
                <div className="w-[32px] h-[32px] rounded-full border-[3px] border-tertiary flex items-center justify-center">
                  <span className="text-tertiary font-medium">
                    {getInitials(userData.username)}
                  </span>
                </div>
              </div>
            ) : (
              <img
                className="h-[32px] w-[32px]"
                src={profile_icon}
                alt="Profile"
                onClick={() => setShowSettingsModel(true)}
              />
            )}
          </div>
        </div>
      </nav>

      {showHelpModel && <Help_Model showModel={setShowHelpModel} />}
      {showModelSession && <Session_Expired showModel={setShowModelSession} />}
    </>
  );
}

export default Header;
