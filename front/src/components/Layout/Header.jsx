import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef, useMemo } from "react";

// Assets
import Light from "../../assets/light.svg";
import Dark from "../../assets/dark.svg";
import Logo from "../../assets/chatai-logo-v3-preview.png";
import help from "../../assets/icon_help.svg";
import image_supported from "../../assets/image_supported.svg";
import Help_Model from "../../model/Help_Modal";
import Session_Expired from "../../model/Session_Expired";

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

function Header({ modelSettings, modelList, onModelChange }) {
  const dispatch = useDispatch();

  // UI States
  const [isDarkMode, setIsDarkMode] = useState(
    useSelector((state) => state.theme.isDarkMode)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isIOSChrome, setIsIOSChrome] = useState(false);
  const [showHelpModel, setShowHelpModel] = useState(false);
  const [showModelSession, setShowModelSession] = useState(false);
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

  return (
    <>
      {/* Desktop Header */}
      <nav
        className={`top-0 min-h-[60px] px-3 items-center justify-between left-0 mobile:hidden flex z-[999] w-full bg-white dark:bg-black shadow-lg`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex gap-4 items-center">
          <button
            className="sm:border-r-primary sm:border-r-2 pr-4 h-[48px] w-[48px]"
            onClick={toggleDarkMode}
          >
            {isDarkMode ? (
              <img
                className="cursor-pointer h-[48px] w-[48px]"
                src={Light}
                alt="Light Mode"
              />
            ) : (
              <img
                className="cursor-pointer h-[48px] w-[48px] -rotate-45"
                src={Dark}
                alt="Dark Mode"
              />
            )}
          </button>

          <Link to={"/"}>
            <img
              className="cursor-pointer sm:h-[40px] sm:w-[125px] h-[35px] w-[130px]"
              src={Logo}
              alt="Chat AI Logo"
            />
          </Link>
        </div>

        <div className="flex">
          <div className="pr-2">
            <Link to={"https://kisski.gwdg.de/"} target="_blank">
              <div className="sm:bg-kisski-logo-large bg-kisski-logo-small sm:h-[45px] sm:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
            </Link>
          </div>
          <div className="border-l-2 border-primary pl-2">
            <Link to={"https://gwdg.de/"} target="_blank">
              <div className="sm:bg-logo-large bg-logo-small sm:h-[45px] sm:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <nav
        className={`top-0 left-0 hidden ${
          isIOSChrome ? "fixed" : ""
        } mobile:flex z-[9999] w-full h-[60px] bg-white dark:bg-black shadow-lg`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div
          className={`w-full px-1 justify-between flex gap-4 border-t border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark relative`}
        >
          <div className="flex items-center min-w-[100px]">
            <Link to={"/"}>
              <img
                className="cursor-pointer h-[40px] object-contain"
                src={Logo}
                alt="Chat AI Logo"
              />
            </Link>
          </div>

          <div
            className="flex index w-full justify-between"
            ref={dropdownRef}
            tabIndex={0}
            onBlur={() => setIsOpen(false)}
          >
            <div
              className="text-tertiary sm:max-w-none flex-grow flex items-center text-[16px] w-full py-[10px] px-[5px] appearance-none focus:outline-none cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="flex gap-2 items-center">
                <div
                  className={`h-[8px] w-[8px] rounded-full`}
                  style={{ backgroundColor: modelStatus.color }}
                ></div>
                <div className="text-ellipsis max-w-[200px] text-xl overflow-hidden whitespace-nowrap">
                  {modelSettings.model}
                </div>
                {isImageSupported && (
                  <img
                    src={image_supported}
                    alt="image_supported"
                    className="h-[20px] w-[20px] cursor-pointer ml-auto"
                  />
                )}
              </div>
            </div>

            {isOpen && (
              <div
                className={`absolute z-[999] w-full left-0 top-full shadow-lg dark:shadow-dark rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-bg_secondary_dark max-h-[250px] overflow-y-auto`}
              >
                {modelList.map((option) => (
                  <div
                    key={option.id}
                    className="text-tertiary flex gap-2 items-center text-xl w-full p-2 cursor-pointer"
                    onClick={() => handleChangeModel(option)}
                  >
                    <div
                      className={`h-[8px] w-[8px] rounded-full`}
                      style={{
                        backgroundColor: getStatusColor(option.status),
                      }}
                    ></div>
                    <div className="flex-grow text-left pl-2">
                      {option.name}
                    </div>
                    {option.input.includes("image") && (
                      <img
                        src={image_supported}
                        alt="image_supported"
                        className="h-[20px] w-[20px] cursor-pointer"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="cursor-pointer flex-shrink-0 w-[25px] flex items-center">
              <img
                src={help}
                alt="help"
                className="h-[25px] w-[25px] cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowHelpModel(true);
                }}
              />
            </div>
          </div>

          <div className="cursor-pointer flex items-center">
            <button className="h-[30px] w-[30px]" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <img
                  className="cursor-pointer h-[30px] w-[30px]"
                  src={Light}
                  alt="Light Mode"
                />
              ) : (
                <img
                  className="cursor-pointer h-[30px] w-[30px] -rotate-45"
                  src={Dark}
                  alt="Dark Mode"
                />
              )}
            </button>
          </div>
        </div>
      </nav>

      {showHelpModel && <Help_Model showModal={setShowHelpModel} />}
      {showModelSession && <Session_Expired showModal={setShowModelSession} />}
    </>
  );
}

export default Header;
