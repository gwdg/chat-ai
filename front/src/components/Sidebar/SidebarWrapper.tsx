import { useDispatch, useSelector } from "react-redux";
import SidebarRail from "./SidebarRail";
import { selectShowSidebar, toggleSidebar, closeSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

import { useWindowSize } from "../../hooks/useWindowSize";

import SidebarPanel from "./SidebarPanel";
import { useEffect } from "react";
import SidebarDrawer from "./SidebarDrawer";
import { createConversation } from "../../db";
import { getDefaultConversation } from "../../utils/conversationUtils";
import { useNavigate } from "react-router";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

export default function SidebarWrapper({ localState, setLocalState, userData, modelsData }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const showSidebar = useSelector(selectShowSidebar);
  const userSettings = useSelector(selectUserSettings);
  const { isMobile, isTablet, isDesktop } = useWindowSize();

  useEffect(() => {
    if (!isDesktop) {
      // on tablet or mobile default sidebar to closed
      dispatch(closeSidebar());
    }
  }, [isDesktop, dispatch]);

  async function handleNewConversation() {
    const newId = await createConversation(getDefaultConversation(userSettings));
    navigate(`/chat/${newId}`);
  };

  return (
    <>
      <div className="hidden md:flex relative min-w-[4rem] min-h-0">
        {/**<div className={`hidden h-full md:flex ${showSidebar && isDesktop && "md:hidden"}`}> */}
        <div className={`h-full absolute
                      transition-all duration-300 ease-in-out
                      ${showSidebar ? "w-[13vw] opacity-0 pointer-events-none" : "w-[4rem] opacity-100"}
        `}>
          <SidebarRail localState={localState} onOpen={() => { dispatch(toggleSidebar()) }} handleNewConversation={handleNewConversation} />
        </div>

        {(isDesktop) && (

          <div className={`h-full
                        transition-all duration-300 ease-in-out overflow-hidden
          ${showSidebar ? "opacity-100 w-[15rem]" : "w-[4rem] opacity-0 pointer-events-none"}`}>
            <SidebarPanel localState={localState} setLocalState={setLocalState} handleNewConversation={handleNewConversation} />
          </div>
        )}
      </div>
      {(!isDesktop) && (
          <SidebarDrawer localState={localState} setLocalState={setLocalState} handleNewConversation={handleNewConversation} />
        )}
    </>
  );
}
