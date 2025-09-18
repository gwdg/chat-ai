import { Menu } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { selectShowSettings, selectShowSidebar, toggleSettings, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

export default function HamburgerMenu() {
  const dispatch = useDispatch();
  const showSettings = useSelector(selectShowSettings);
  const showSidebar = useSelector(selectShowSidebar);

  return (
    <button
      onClick={() => {
          if (showSettings) dispatch(toggleSettings());
          dispatch(toggleSidebar());
      }}
      className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation cursor-pointer"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Menu className="h-6 w-6 text-[#009EE0]" alt="Menu" />
    </button>
  );
}
