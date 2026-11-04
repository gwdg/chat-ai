import { useParams } from "react-router-dom";
import DocumentPanelLayout from "../components/DocumentPanel/DocumentPanelLayout";
import { useDispatch } from "react-redux";
import { getDefaultConversation } from "../utils/conversationUtils";

import { useSyncConversation } from "../hooks/useSyncConversation";
import { useSendMessage } from "../hooks/useSendMessage";
import { usePendingPrompt } from "../hooks/usePendingPrompt";
import { useConversationSummaries } from "../hooks/useConversationSummaries";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useWindowSize } from "../hooks/useWindowSize";
import { useSettingsDeepLink } from "../hooks/useSettingsDeepLink";

import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import Header from "../components/Header/Header";
import Conversation from "../components/Conversation/Conversation";
import PersonaChatBanner from "../components/Conversation/PersonaChatBanner";
import TourManager from "../components/SettingsPanel/TourManager";
import { useEffect, useState } from "react";
import { activeMcpServers, prefetchMcpServers } from "../agent/mcp";
import { isAgentEnabled } from "../apis/agentEndpoints";
import { setLastConversation } from "../Redux/reducers/lastConversationSlice";

import { useNavigate } from "react-router";
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
  const sendMessage = useSendMessage();

  useSettingsDeepLink({ localState, userData, modelsData });

  // Sync localState conversation with IndexedDB
  useSyncConversation({
    localState,
    setLocalState,
    conversationId,
  });

  // Connect to the conversation's MCP servers before the first message, so a turn does not
  // wait for it. Debounced, as the list changes with every keystroke while a URL is typed.
  const mcpServers = JSON.stringify(isAgentEnabled() ? activeMcpServers(localState?.settings) : []);
  useEffect(() => {
    const timer = setTimeout(() => prefetchMcpServers(JSON.parse(mcpServers)), 500);
    return () => clearTimeout(timer);
  }, [mcpServers]);

  // A chat started from the topic master view arrives with its first prompt
  // in router state; send it once the conversation has been hydrated.
  usePendingPrompt({
    conversationId,
    localState,
    setLocalState,
    sendMessage,
  });

  useConversationSummaries({ localState, conversationId });

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
        <TourManager />
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
          md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto]
          md:gap-x-2 gap-y-1 md:pt-1
          bg-base-200
          overflow-hidden
        "
      >
        <SidebarWrapper
          localState={localState}
          setLocalState={setLocalState}
          userData={userData}
          modelsData={modelsData}
        />

        <DocumentPanelLayout conversationId={localState?.id} messages={localState?.messages}>
          {localState?.persona && (
            <PersonaChatBanner persona={localState.persona} />
          )}
          <div className="min-h-0 flex-1">
            <Conversation
              localState={localState}
              setLocalState={setLocalState}
              userData={userData}
              modelsData={modelsData}
            />
          </div>
        </DocumentPanelLayout>

        <CollapsibleFooter
          className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3"
        />
      </div>
    </div>
  );
}
