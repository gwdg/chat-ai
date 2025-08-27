import { Menu } from "lucide-react";

export default function HamburgerMenu({ onOpen}: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors p-2 touch-manipulation cursor-pointer"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <Menu className="h-5 w-5 text-[#009EE0]" alt="Menu" />
    </button>
  );
}
