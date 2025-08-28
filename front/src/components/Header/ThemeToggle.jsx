import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { toggleTheme } from "../../Redux/reducers/interfaceSettingsSlice";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const dispatch = useDispatch();

  // UI state management
  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);

  // Theme handling effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // Theme toggle handler
  const toggleDarkMode = () => {
    dispatch(toggleTheme());
  };

  return (
    <button
      className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation w-7 h-7 pl-6 pr-6 flex items-center justify-center cursor-pointer"
      onClick={toggleDarkMode}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {isDarkMode ? (
        <Sun
          className="h-5 w-5 flex-shrink-0 text-tertiary"
          alt="Light Mode"
        />
      ) : (
        <Moon
          className="h-5 w-5 flex-shrink-0 text-tertiary"
          alt="Dark Mode"
        />
      )}
    </button>
  );
}
