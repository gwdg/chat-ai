import {
  Navigate,
  Route,
  Routes,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { useSelector } from "react-redux";
import Home from "../Pages/Home";
import NotFoundPage from "../Pages/NotFoundPage";
import ZoomWrapper from "../components/Layout/ZoomWrapper";

// Separate route components
const RootRoute = ({ currentConversationId }) => (
  <Navigate to={`/chat/${currentConversationId}`} replace />
);

const ChatRoute = ({
  currentConversationId,
  hasSettings,
  hasImport,
  hasArcana,
  hasArcanaKey,
}) => {
  if (hasSettings || hasImport || (hasArcana && hasArcanaKey)) {
    return <Home />;
  }
  return <Navigate to={`/chat/${currentConversationId}`} replace />;
};

const ConversationRoute = ({ currentConversationId, conversations }) => {
  const { conversationId } = useParams();

  const isValidUUIDv4 = (id) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    );
  };

  // If invalid UUID, redirect to current
  if (!isValidUUIDv4(conversationId)) {
    return <Navigate to={`/chat/${currentConversationId}`} replace />;
  }

  // If conversation doesn't exist, show not found
  const conversationExists = conversations.some(
    (conv) => conv.id === conversationId
  );
  if (!conversationExists) {
    return <NotFoundPage />;
  }

  // Otherwise, render Home
  return <Home />;
};

const PublicRoute = () => {
  const isDarkMode = useSelector((state) => state.theme.isDarkMode);
  const currentConversationId = useSelector(
    (state) => state.conversations.currentConversationId
  );
  const conversations = useSelector(
    (state) => state.conversations.conversations
  );
  const [searchParams] = useSearchParams();

  // Extract URL parameters
  const hasSettings = searchParams.get("settings");
  const hasImport = searchParams.get("import");
  const hasArcana = searchParams.get("arcana");
  const hasArcanaKey = searchParams.get("arcana_key");

  return (
    <ZoomWrapper>
      <div
        className={`h-full ${isDarkMode ? "darkScrollbar" : "lightScrollbar"}`}
      >
        <Routes>
          <Route
            path="/"
            element={
              <RootRoute currentConversationId={currentConversationId} />
            }
          />
          <Route
            path="/chat"
            element={
              <ChatRoute
                currentConversationId={currentConversationId}
                hasSettings={hasSettings}
                hasImport={hasImport}
                hasArcana={hasArcana}
                hasArcanaKey={hasArcanaKey}
              />
            }
          />
          <Route
            path="/chat/:conversationId"
            element={
              <ConversationRoute
                currentConversationId={currentConversationId}
                conversations={conversations}
              />
            }
          />
          <Route
            path="*"
            element={
              <RootRoute currentConversationId={currentConversationId} />
            }
          />
        </Routes>
      </div>
    </ZoomWrapper>
  );
};

export default PublicRoute;
