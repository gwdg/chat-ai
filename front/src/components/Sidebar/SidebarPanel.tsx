import { useDispatch, useSelector } from "react-redux";
import SidebarContent from "./SidebarContent";
import { selectShowSidebar, toggleSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

export default function SidebarPanel({ localState, setLocalState, handleNewConversation }: { localState: any, setLocalState: (state: any) => void, handleNewConversation: (folderId?: string | null) => Promise<void> }) {
  /*
  Small Container for the Desktop Extended Sidebar
  */
  const showSidebar = useSelector(selectShowSidebar);
  const dispatch = useDispatch();
  return (
    <div
      className={`h-full bg-white dark:bg-bg_secondary_dark
              rounded-xl shadow-md
              overflow-hidden`}

    >
      <SidebarContent localState={localState} setLocalState={setLocalState} handleNewConversation={handleNewConversation} />
    </div>
  );
}
