import { useDispatch, useSelector } from "react-redux";
import SidebarContent from "./SidebarContent";
import { selectShowSidebar, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

export default function SidebarDrawer({ localState, setLocalState, handleNewConversation }: { localState: any, setLocalState: (state: any) => void, handleNewConversation: () => void }) {

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
        className={`fixed top-[3.5rem] md:top-0 left-0 pt-4 z-40 h-[calc(100dvh-3.5rem)] md:h-dvh transition-transform duration-200
          ${showSidebar ? "translate-x-0" : "-translate-x-full"} 
          bg-white dark:bg-bg_secondary_dark shadow-lg`}
      >
        <SidebarContent localState={localState} setLocalState={setLocalState} handleNewConversation={handleNewConversation} />
      </div>
    </>
  );
}
