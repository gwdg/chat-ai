import {
  Navigate,
  Route,
  Routes,
} from "react-router";

import NotFoundPage from "../Pages/NotFoundPage";
import LandingPage from "../Pages/LandingPage";
import ChatPage from "../Pages/ChatPage";

const PublicRoute = () => {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/notfound" element={<NotFoundPage />} />
      <Route path="/chat/:conversationId?" element={<ChatPage />}/>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<ChatPage />} />
      <Route path="/" element={<ChatPage />} />
    </Routes>
  );
}

export default PublicRoute;
