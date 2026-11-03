import { Menu } from "@carbon/icons-react";
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
      className="hover:bg-base-200 rounded-lg transition-colors p-2 touch-manipulation cursor-pointer"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Menu size={24} className="text-accent" />
    </button>
  );
}
