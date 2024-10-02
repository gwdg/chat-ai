// Importing necessary modules and assets
import { Link, useNavigate, useSearchParams } from "react-router-dom"; // For routing
import { useDispatch, useSelector } from "react-redux"; // For Redux state management
import { useEffect, useState, useRef } from "react"; // For managing component state and side effects
import { ToastContainer, toast } from "react-toastify";

// Assets
import Light from "../assets/light.svg"; // Light mode icon
import Dark from "../assets/dark.svg"; // Dark mode icon
import Logo from "../assets/chatai-logo-v3-preview.png"; // Chat AI logo
import help from "../assets/icon_help.svg";
import { getModels } from "../apis/ModelLIst";
import { setModelApiGlobal } from "../Redux/actions/setModelApi";
import { setModel } from "../Redux/actions/modelAction";
import Help_Model from "../model/Help_Modal";

function Header() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // To find current path
  const model = useSelector((state) => state.model);
  const modelApi = useSelector((state) => state.modelApi);
  const isDarkModeGlobal = useSelector((state) => state.theme.isDarkMode);
  let toastClass = isDarkModeGlobal ? "dark-toast" : "light-toast";
  const [showHelpModel, setShowHelpModel] = useState(false);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(
    useSelector((state) => state.theme.isDarkMode) // Accessing dark mode state from Redux store
  );

  // Select Model logic for mobile
  const [isOpen, setIsOpen] = useState(false);
  const [chooseModel, setChooseModel] = useState(model);
  const [chooseModelApi, setChooseModelApi] = useState(modelApi);
  const [isIOSChrome, setIsIOSChrome] = useState(false);

  const [modelList, setModelList] = useState([]);
  const dropdownRef = useRef(null);

  // Toggle open for dropdown
  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleChangeModel = (option) => {
    setChooseModel(option.name);
    setChooseModelApi(option.id);
    dispatch(setModel(option.name));
    dispatch(setModelApiGlobal(option.id));
    setIsOpen(false);
  };

  // Displays an error notification
  const notifyError = (message) => {
    toast.error(message, {
      className: toastClass,
      autoClose: 1000,
      onClose: () => {},
    });
  };

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
    const encodedSettings = searchParams.get("settings");

    if (encodedSettings) {
      // Decode the Base64 string
      const decodedSettings = atob(encodedSettings);

      // Parse the JSON string back into an object
      const settings = JSON.parse(decodedSettings);

      const { system_prompt, model_name, model, temperature, top_p } = settings;
      if (model_name) {
        setChooseModel(model_name);
      }
      if (model) {
        setChooseModelApi(model);
      }

      // Reset URL to /chat without query parameters
      navigate("/chat", { replace: true });
    }
  }, [searchParams, navigate]);

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

  const dispatch = useDispatch();

  // Function for toggling theme using Redux store function
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode); // Toggle dark mode state
    dispatch({ type: "SET_THEME" }); // Dispatch action to update theme in Redux store
  };

  // Detect iOS Chrome
  useEffect(() => {
    if (navigator.userAgent.match("CriOS")) {
      setIsIOSChrome(true);
    }
  }, []);

  return (
    <>
      {/* Desktop Header */}
      <nav
        className={`top-0 min-h-[60px] px-3 items-center justify-between left-0 hidden md:flex z-[9999] w-full bg-white dark:bg-black shadow-lg`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="flex gap-4 items-center">
          {/* Toggle button for theme */}
          <button
            className="md:border-r-primary md:border-r-2 pr-4 h-[48px] w-[48px]"
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

          {/* Chat AI Logo */}
          <Link to={"/"}>
            <img
              className="cursor-pointer md:h-[40px] md:w-[125px] h-[35px] w-[130px]"
              src={Logo}
              alt="Chat AI Logo"
            />
          </Link>
        </div>

        <div className="flex">
          {/* Kisski logo */}
          <div className="pr-2">
            <Link to={"https://kisski.gwdg.de/"} target="_blank">
              <div className="md:bg-kisski-logo-large bg-kisski-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
            </Link>
          </div>
          {/* GWDG logo */}
          <div className="border-l-2 border-primary pl-2">
            <Link to={"https://gwdg.de/"} target="_blank">
              <div className="md:bg-logo-large bg-logo-small md:h-[45px] md:w-[145px] h-[60px] w-[60px] bg-repeat-round"></div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <nav
        className={`top-0 left-0 md:hidden ${
          isIOSChrome ? "fixed" : ""
        } flex z-[9999] w-full h-[60px] md:h-[90px] bg-white dark:bg-black shadow-lg`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {/* Select input for model mobile */}
        <div
          className={`w-full px-1 justify-between flex sm:hidden gap-4 border-t border-opacity-10 border dark:border-border_dark bg-white dark:bg-black shadow-lg dark:shadow-dark relative`}
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
            className="flex index w-full justify-between"
            ref={dropdownRef}
            tabIndex={0}
            onBlur={() => setIsOpen(false)}
          >
            <div
              className="text-tertiary max-w-[250px] flex items-center text-[16px] w-full py-[10px] px-[5px] appearance-none focus:outline-none cursor-pointer"
              onClick={toggleOpen}
            >
              <p className="text-ellipsis text-xl overflow-hidden whitespace-nowrap">
                {chooseModel}
              </p>
            </div>

            {isOpen && (
              <div
                className={`absolute z-[999] w-full left-0 top-full shadow-lg dark:shadow-dark rounded-2xl border-opacity-10 border dark:border-border_dark bg-white dark:bg-bg_secondary_dark max-h-[250px] overflow-y-scroll`}
              >
                {modelList.map((option, index) => (
                  <div
                    key={index}
                    className="text-tertiary block text-xl w-full p-2 cursor-pointer"
                    onClick={() => handleChangeModel(option)}
                  >
                    {option.name}
                  </div>
                ))}
              </div>
            )}

            <div className="cursor-pointer w-[25px] flex items-center">
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

          {/* Toggle button for theme */}
          <div className="cursor-pointer flex items-center">
            <button className="h-[30px] w-[30px]" onClick={toggleDarkMode}>
              {isDarkMode ? (
                <img className="cursor-pointer h-[30px] w-[30px]" src={Light} />
              ) : (
                <img
                  className="cursor-pointer h-[30px] w-[30px] -rotate-45"
                  src={Dark}
                />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Help model for info on changing model */}
      <>{showHelpModel ? <Help_Model showModal={setShowHelpModel} /> : null}</>
    </>
  );
}

export default Header;
