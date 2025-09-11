import { useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { getDefaultConversation } from "../utils/conversationUtils";

import { useSyncConversation } from "../hooks/useSyncConversation";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useWindowSize } from "../hooks/useWindowSize";

import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import ModelSelectorWrapper from "../components/Header/ModelSelectorWrapper";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import Header from "../components/Header/Header";
import SettingsWrapper from "../components/SettingsPanel/SettingsWrapper";
import Conversation from "../components/Conversation/Conversation";
import { useEffect, useState } from "react";
import { setLastConversation } from "../Redux/reducers/lastConversationSlice";

import { Navigate, useNavigate } from "react-router";
import AnnouncementBar from "../components/Header/AnnouncementBar";

export default function ChatPage() {
  const params = useParams();
 
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isMobile } = useWindowSize();

  const [localState, setLocalState] = useState(() => getDefaultConversation());

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();

  // Sync localState conversation with IndexedDB
  useSyncConversation({
    localState,
    setLocalState,
    conversationId,
  });

  // Save last conversation when current conversation changes
  useEffect(() => {
    if (conversationId) {
      dispatch(setLastConversation(conversationId));
    }
  }, [conversationId]);

  return (
    <div className="h-dvh grid grid-rows-[auto_1fr]">
      {/* Header + optional Announcement */}
      <div className="min-w-0 overflow-hidden">
        <AnnouncementBar />
        <Header
          className="md:hidden"
          localState={localState}
          setLocalState={setLocalState}
          modelsData={modelsData}
          userData={userData}
        />
      </div>

      {/* Middle content exactly fills leftover space */}
      <div
        className="
          grid
          grid-cols-1 grid-rows-[1fr_auto]
          md:grid-cols-[auto_1fr_auto] md:grid-rows-[1fr_auto]
          md:gap-x-2 gap-y-1 md:pt-1
          bg-gray-100 dark:bg-bg_dark
          overflow-hidden
        "
      >
        <SidebarWrapper
          localState={localState}
          setLocalState={setLocalState}
          userData={userData}
          modelsData={modelsData}
        />

        <Conversation
          localState={localState}
          setLocalState={setLocalState}
          userData={userData}
          modelsData={modelsData}
        />

        <SettingsWrapper
          localState={localState}
          setLocalState={setLocalState}
          userData={userData}
          modelsData={modelsData}
        />

        <CollapsibleFooter
          className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-4"
        />
      </div>
    </div>
  );
}
