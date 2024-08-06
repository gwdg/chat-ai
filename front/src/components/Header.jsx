// Importing necessary modules and assets
import { Link } from "react-router-dom"; // For routing
import { useDispatch, useSelector } from "react-redux"; // For Redux state management
import { useEffect, useState } from "react"; // For managing component state and side effects
import { useLocation } from "react-router-dom"; // For accessing current location

// Assets
import Light from "../assets/light.svg"; // Light mode icon
import Dark from "../assets/dark.svg"; // Dark mode icon
import Logo from "../assets/chatai-logo-v3-preview.png"; // Chat AI logo

function Header() {
  // To find current path
  const location = useLocation();

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(
    useSelector((state) => state.theme.isDarkMode) // Accessing dark mode state from Redux store
  );

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

  return (
    // Header
    <nav
      // Conditional CSS classes based on location and dark mode state
      className={`top-0 md:p-2 pl-2 md:flex ${
        location.pathname === "/chat" ? "hidden" : "flex"
      } justify-between items-center select-none w-full md:fixed z-[990] bg-white dark:bg-black md:max-h-max max-h-[90px] shadow-lg dark:shadow-dark`}
    >
      <div className="flex gap-4 items-center">
        {/* Toggle button for theme */}
        <button
          className="md:border-r-primary md:border-r-2 pr-4 h-[48px] w-[48px]"
          onClick={toggleDarkMode} // Click handler to toggle dark mode
        >
          {/* Display light or dark mode icon based on dark mode state */}
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

      <div className="md:flex hidden">
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
  );
}

export default Header;
