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
import WorkspaceFilesPage from "../Pages/WorkspaceFilesPage";
import AgentPage from "../Pages/AgentPage";
import ToolFormDemoPage from "../Pages/ToolFormDemoPage";
import BrandPage from "../Pages/BrandPage";
import SitemapPage from "../Pages/SitemapPage";
import CoursePage from "../Pages/CoursePage";
import { isAgentsEnabled } from "../utils/modules";
import { isFeatureEnabled } from "../config/deployment";

const PublicRoute = () => {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/notfound" element={<NotFoundPage />} />
      <Route path="/about" element={<BrandPage page="about" titleKey="about.title" />} />
      <Route
        path="/accessibility"
        element={<BrandPage page="accessibility" titleKey="accessibility.title" />}
      />
      <Route path="/sitemap" element={<SitemapPage />} />
      <Route path="/course/:courseId" element={<CoursePage />} />
      {isFeatureEnabled("meta_chat") && (
        <Route path="/meta" element={<MetaChatPage />} />
      )}
      <Route path="/topic/:topicId" element={<TopicMasterPage />} />
      {isFeatureEnabled("workspaces") && (
        <>
          <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
          <Route
            path="/workspace/:workspaceId/files"
            element={<WorkspaceFilesPage />}
          />
        </>
      )}
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
