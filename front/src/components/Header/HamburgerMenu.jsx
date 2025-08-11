import icon_menu from "../../assets/icons/menu.svg";

export default function HamburgerMenu({ isMobile = false, onMenuClick}) {
  return !isMobile ? (
    <button
    onClick={onMenuClick}
    className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation w-8 h-8 min-[400px]:w-9 min-[400px]:h-9 min-[500px]:w-10 min-[500px]:h-10 flex items-center justify-center"
    style={{ WebkitTapHighlightColor: "transparent" }}
    >
        <img
        className="h-4 w-4 min-[400px]:h-4 min-[400px]:w-4 min-[500px]:h-5 min-[500px]:w-5 flex-shrink-0"
        src={icon_menu}
        alt="Menu"
        />
    </button>
  ) : (
    <button
        onClick={onMenuClick} // Show/Hide sidebar
        className="desktop:hidden hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation"
        style={{ WebkitTapHighlightColor: "transparent" }}
        >
        <img className="h-5 w-5" src={icon_menu} alt="Menu" />
    </button>
  );
}