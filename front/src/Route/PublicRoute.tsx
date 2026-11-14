import {
  Route,
  Routes,
} from "react-router";

import NotFoundPage from "../Pages/NotFoundPage";
import LandingPage from "../Pages/LandingPage";
import ChatPage from "../Pages/ChatPage";
import MetaChatPage from "../Pages/MetaChatPage";
import TopicMasterPage from "../Pages/TopicMasterPage";
import WorkspacePage from "../Pages/WorkspacePage";
import AgentPage from "../Pages/AgentPage";
import ToolFormDemoPage from "../Pages/ToolFormDemoPage";
import { isAgentsEnabled } from "../utils/modules";

const PublicRoute = () => {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/notfound" element={<NotFoundPage />} />
      <Route path="/meta" element={<MetaChatPage />} />
      <Route path="/topic/:topicId" element={<TopicMasterPage />} />
      <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
      {isAgentsEnabled() && (
        <Route path="/agent/:agentId" element={<AgentPage />} />
      )}
      {import.meta.env.DEV && (
        <Route path="/dev/tool-form" element={<ToolFormDemoPage />} />
      )}
      <Route path="/chat/:conversationId?" element={<ChatPage />}/>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<ChatPage />} />
      <Route path="/" element={<ChatPage />} />
    </Routes>
  );
}

export default PublicRoute;
