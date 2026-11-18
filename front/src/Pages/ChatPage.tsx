import { useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getDefaultConversation } from "../utils/conversationUtils";

import { useSyncConversation } from "../hooks/useSyncConversation";
import { useSendMessage } from "../hooks/useSendMessage";
import { usePendingPrompt } from "../hooks/usePendingPrompt";
import { useConversationSummaries } from "../hooks/useConversationSummaries";
import { useAgents } from "../agents/agentStore";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import { useWindowSize } from "../hooks/useWindowSize";
import { useSettingsDeepLink } from "../hooks/useSettingsDeepLink";
import { useFilePreview } from "../context/FilePreviewContext";

import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import Header from "../components/Header/Header";
import Conversation from "../components/Conversation/Conversation";
import ChatAgentSidebar from "../components/Workspace/ChatAgentSidebar";
import AgentFilePreviewPanel from "../components/Agent/AgentFilePreviewPanel";
import ChatFilePreviewPanel from "../components/Conversation/ChatFilePreviewPanel";
import PersonaChatBanner from "../components/Conversation/PersonaChatBanner";
import HallucinationWarning from "../components/Conversation/HallucinationWarning";
import TourManager from "../components/SettingsPanel/TourManager";
import { useEffect, useState } from "react";
import {
  activeMcpServers,
  prefetchMcpServers,
  resolveMcpServers,
} from "../agent/mcp";
import { resetMcpConfirmationSession } from "../agent/mcpConfirmation";
import { isAgentEnabled } from "../apis/agentEndpoints";
import { setLastConversation } from "../Redux/reducers/lastConversationSlice";
import { selectGlobalMcpServers } from "../Redux/reducers/userSettingsReducer";

import { useNavigate } from "react-router";
import AnnouncementBar from "../components/Header/AnnouncementBar";
import { isFeatureEnabled } from "../config/deployment";

export default function ChatPage() {
  const params = useParams();
 
  const { conversationId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isMobile } = useWindowSize();

  const [localState, setLocalState] = useState(() => getDefaultConversation());
  const { preview: chatFilePreview } = useFilePreview();
  const [filePreview, setFilePreview] = useState<{
    agentId: string;
    path: string;
  } | null>(null);
  const agents = useAgents();

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();
  const sendMessage = useSendMessage();
  const globalMcpServers = useSelector(selectGlobalMcpServers);

  useSettingsDeepLink({ localState, userData, modelsData });

  // Sync localState conversation with IndexedDB
  useSyncConversation({
    localState,
    setLocalState,
    conversationId,
  });

  // Connect to the conversation's MCP servers before the first message, so a turn does not
  // wait for it. Debounced, as the list changes with every keystroke while a URL is typed.
  const mcpServers = JSON.stringify(
    isAgentEnabled()
      ? activeMcpServers({
          ...localState?.settings,
          mcp_servers: resolveMcpServers(
            localState?.settings,
            globalMcpServers,
          ),
        })
      : [],
  );
  // The agent loop is a large lazy chunk; fetch it while idle so the first
  // message does not wait for it.
  useEffect(() => {
    if (!isAgentEnabled()) return;
    const load = () => void import("../agent/runAgent").catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 2000);
    return () => window.clearTimeout(id);
  }, []);

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

  useEffect(() => {
    const onPreview = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const agent = agents.find((item) => item.id === detail?.agentId);
      if (!agent || !detail?.path) return;
      event.preventDefault();
      setFilePreview({ agentId: agent.id, path: detail.path });
    };
    window.addEventListener("chatai:preview-agent-file", onPreview);
    return () =>
      window.removeEventListener("chatai:preview-agent-file", onPreview);
  }, [agents]);

  // Save last conversation when current conversation changes
  useEffect(() => {
    if (conversationId) {
      dispatch(setLastConversation(conversationId));
    }
  }, [conversationId]);

  // "Always allow" MCP grants last for one conversation only
  useEffect(() => {
    resetMcpConfirmationSession();
  }, [conversationId]);

  return (
    <div className="flex h-dvh min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header + optional Announcement */}
      <div className="min-w-0 overflow-x-clip">
        {isFeatureEnabled("tutorials") && <TourManager />}
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
          flex-1 min-h-0
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

        <div className="flex min-h-0 min-w-0 flex-1 gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {localState?.persona && (
              <>
                <div className="mx-auto w-full md:max-w-[85vw] xl:max-w-[1300px]">
                  <HallucinationWarning />
                </div>
                <PersonaChatBanner persona={localState.persona} />
              </>
            )}
            <div className="min-h-0 flex-1">
              <Conversation
                localState={localState}
                setLocalState={setLocalState}
                userData={userData}
                modelsData={modelsData}
              />
            </div>
          </div>
          {isFeatureEnabled("workspaces") && !filePreview && !chatFilePreview && (
            <ChatAgentSidebar conversationId={localState?.id} />
          )}
        </div>

        <CollapsibleFooter
          className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3"
        />
      </div>
      </div>
      {filePreview && (
        <AgentFilePreviewPanel
          agent={agents.find((item) => item.id === filePreview.agentId)}
          path={filePreview.path}
          onClose={() => setFilePreview(null)}
        />
      )}
      <ChatFilePreviewPanel />
    </div>
  );
}
