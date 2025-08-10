import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { toggleTheme } from "../../Redux/reducers/themeReducer";
// Asset imports for icons and images
import Light from "../../assets/light.svg";
import Dark from "../../assets/dark.svg";

export default function ThemeToggle () {
    const dispatch = useDispatch();

    // UI state management
    const isDarkMode = useSelector((state) => state.theme.isDarkMode);

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
    );
}