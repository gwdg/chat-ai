import { Menu } from "lucide-react";
import { useDispatch } from "react-redux";
import { toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

export default function HamburgerMenu() {
  const dispatch = useDispatch();

  const isDesktop = window.innerWidth >= 1281;

  return !isDesktop ? (
    <button
      onClick={() => {
        dispatch(toggleSidebar());
      }}
      className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation cursor-pointer"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Menu className="h-5 w-5 text-[#009EE0]" alt="Menu" />
    </button>
  ) : null;
}
