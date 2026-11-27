import { useDispatch, useSelector } from "react-redux";
import SidebarRail from "./SidebarRail";
import { selectShowSidebar, toggleSidebar, closeSidebar } from "../../Redux/reducers/interfaceSettingsSlice";

import { useWindowSize } from "../../hooks/useWindowSize";

import SidebarPanel from "./SidebarPanel";
import SidebarContent from "./SidebarContent";
import { useCallback, useEffect } from "react";
import SidebarDrawer from "./SidebarDrawer";
import { createNewChatConversation } from "../../workspace/newChat";
import { getDefaultConversation } from "../../utils/conversationUtils";
import { useNavigate } from "react-router";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import { useActiveWorkspaceId } from "../../hooks/useActiveWorkspaceId";

export default function SidebarWrapper({ 
  localState, 
  setLocalState, 
  userData, 
  modelsData 
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const showSidebar = useSelector(selectShowSidebar);
  const userSettings = useSelector(selectUserSettings);
  // A new chat belongs to the workspace the user is in, just as it inherits the
  // open chat's topic. Without a selected workspace nothing changes.
  const activeWorkspaceId = useActiveWorkspaceId(localState?.id);
  const { isMobile, isTablet, isDesktop } = useWindowSize();

  useEffect(() => {
    if (!isDesktop) {
      // on tablet or mobile default sidebar to closed
      dispatch(closeSidebar());
    }
  }, [isDesktop, dispatch]);

  const focusPromptInput = useCallback(() => {
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>("textarea[name='prompt']");
      if (textarea) {
        textarea.focus();
        const valueLength = textarea.value.length;
        textarea.setSelectionRange(valueLength, valueLength);
      }
    });
  }, []);

  const handleNewConversation = useCallback(async (folderId: string | null = null) => {
    const newConversation = getDefaultConversation(userSettings, folderId ?? null);
    const { id, attached } = await createNewChatConversation(
      activeWorkspaceId,
      newConversation,
    );
    // A chat created in a workspace opens its Files panel, like the workspace
    // row's "+" does.
    navigate(`/chat/${id}`, attached ? { state: { openWorkspacePanel: true } } : undefined);
    focusPromptInput();
  }, [userSettings, navigate, focusPromptInput, activeWorkspaceId]);

  useEffect(() => {
    let shortcutLocked = false;
    let unlockTimer: ReturnType<typeof setTimeout> | null = null;

    const startCooldown = () => {
      shortcutLocked = true;
      if (unlockTimer) {
        clearTimeout(unlockTimer);
      }
      unlockTimer = setTimeout(() => {
        shortcutLocked = false;
        unlockTimer = null;
      }, 800);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) {
        return;
      }

      if (event.key.toLowerCase() !== "o") {
        return;
      }

      if (event.repeat || shortcutLocked) {
        return;
      }

      event.preventDefault();
      startCooldown();

      handleNewConversation().catch((error) => {
        console.error("Failed to start new conversation from shortcut", error);
      });
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unlockTimer) {
        clearTimeout(unlockTimer);
      }
    };
  }, [handleNewConversation]);

  const sidebarContent = (
    <SidebarContent
      localState={localState}
      setLocalState={setLocalState}
      handleNewConversation={handleNewConversation}
      activeWorkspaceId={activeWorkspaceId}
      userData={userData}
      modelsData={modelsData}
    />
  );

  return (
    <>
      <div className="hidden md:flex relative min-w-[4rem] min-h-0">
        {/**<div className={`hidden h-full md:flex ${showSidebar && isDesktop && "md:hidden"}`}> */}
        <div className={`h-full absolute
                      transition-all duration-300 ease-in-out
                      ${showSidebar && isDesktop ? "w-[13vw] opacity-0 pointer-events-none" : "w-[4rem] opacity-100"}
        `}>
          <SidebarRail 
            localState={localState}
            setLocalState={setLocalState}
            userData={userData}
            modelsData={modelsData}
            activeWorkspaceId={activeWorkspaceId}
            onOpen={() => { dispatch(toggleSidebar()) }}
            handleNewConversation={handleNewConversation} />
        </div>

        {(isDesktop) && (

          <div className={`h-full
                        transition-all duration-300 ease-in-out overflow-hidden
          ${showSidebar ? "opacity-100 w-[15rem]" : "w-[4rem] opacity-0 pointer-events-none"}`}>
            <SidebarPanel>{sidebarContent}</SidebarPanel>
          </div>
        )}
      </div>
      {(!isDesktop) && (
          <SidebarDrawer>{sidebarContent}</SidebarDrawer>
        )}
    </>
  );
}
