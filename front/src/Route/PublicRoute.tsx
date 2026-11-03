import { lazy, Suspense } from "react";
import {
  Route,
  Routes,
} from "react-router";

import NotFoundPage from "../Pages/NotFoundPage";
import LandingPage from "../Pages/LandingPage";
import ChatPage from "../Pages/ChatPage";
import MetaChatPage from "../Pages/MetaChatPage";
import TopicMasterPage from "../Pages/TopicMasterPage";

const WorkspacePage = lazy(() => import("../Pages/WorkspacePage"));

const PublicRoute = () => {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/notfound" element={<NotFoundPage />} />
      <Route path="/meta" element={<MetaChatPage />} />
      <Route path="/topic/:topicId" element={<TopicMasterPage />} />
      <Route
        path="/workspace/:workspaceId"
        element={
          <Suspense
            fallback={
              <div className="grid h-dvh place-items-center bg-base-200">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            }
          >
            <WorkspacePage />
          </Suspense>
        }
      />
      <Route path="/chat/:conversationId?" element={<ChatPage />}/>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<ChatPage />} />
      <Route path="/" element={<ChatPage />} />
    </Routes>
  );
}

export default PublicRoute;
