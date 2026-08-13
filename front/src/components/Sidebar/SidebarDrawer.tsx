import type { ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectShowSidebar, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

export default function SidebarDrawer({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const showSidebar = useSelector(selectShowSidebar);
  return (
    <>
      {/* Backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-sm bg-black/5 dark:bg-gray/30 transition-opacity"
          onClick={() => dispatch(toggleSidebar())} // clicking backdrop closes drawer
        />
      )}

      {/* Drawer */}
      {/* height is: screenheight-header_size which is h-14 */}
      <div
        id="sidebardrawer"
        className={`fixed top-0 left-0 pt-1 z-40 h-dvh md:h-dvh transition-transform duration-200
          ${showSidebar ? "translate-x-0" : "-translate-x-full"} 
          bg-white dark:bg-bg_secondary_dark shadow-lg`}
      >
        {children}
      </div>
    </>
  );
}
