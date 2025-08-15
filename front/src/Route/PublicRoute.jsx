import {
  Navigate,
  Route,
  Routes,
  useSearchParams,
  useParams,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useRef } from "react";
import ChatPage from "../Pages/ChatPage.jsx";
import NotFoundPage from "../Pages/NotFoundPage";
import LandingPage from "../Pages/LandingPage";
import { setCurrentConversation } from "../Redux/reducers/currentConversationSlice.jsx";
import conversationsSlice from "../Redux/reducers/conversationsSlice.jsx";

// Separate route components
const RootRoute = () => {
  // const conversations = useSelector((state) => state.conversations);
  // Get it from state one time without rerendering as a selector
  console.log("Root navigation")
  return <Navigate to={`/chat`} replace />;
};

// for import??
// const ChatRoute = ({
//   hasSettings,
//   hasImport,
//   hasArcana,
//   hasModelArcana,
// }) => {
//   const conversations = // useSelector((state) => state.conversations);
//   // const currentConversationId = useRef((state) => state.current_conversation || conversations[0].id);
//   // Modified condition to make arcanaKey optional when arcana and model are present
//   if (
//     hasSettings ||
//     hasImport ||
//     (hasArcana && hasModelArcana) // removed hasArcanaKey requirement
//   ) {
//     return <ChatPage />;
//   }
//   console.log("Root navigation")
//   console.log(currentConversationId)
//   return <Navigate to={`/chat/${currentConversationId}`} replace />;
// };

const ConversationRoute = ({ conversationId }) => {
  // const currentConversationId = useRef((state) => state.current_conversation) || conversations[0].id;
  // const conversations = useSelector((state) => state.conversations);
  const isValidUUIDv4 = (id) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    );
  };
  // If invalid UUID, redirect to current
  if (!(isValidUUIDv4(conversationId) || conversationId === 'reset')) {
    //return <Navigate to={`/chat/${currentConversationId}`} replace />;
    // Let ChatPage handle navigation
    return <ChatPage />;
  }
  // If conversation doesn't exist, show not found
  // const conversationExists = conversations.some(
  //   (conv) => conv.id === conversationId
  // );
  // console.log(currentConversation)
  // if (!currentConversation) {
  //   console.log("Not found: ", conversationId);
  //   return <NotFoundPage />;
  // }

  // Otherwise, setCurrentConversation from URL
  const dispatch = useDispatch();
  dispatch(setCurrentConversation(conversationId));
  return <ChatPage conversationId={conversationId} />;
};

const PublicRoute = () => {
  const isDarkMode = useSelector((state) => state.interface_settings.dark_mode);
  const [searchParams] = useSearchParams();
  // Extract URL parameters
  const hasSettings = searchParams.get("settings");
  const hasImport = searchParams.get("import");
  const hasArcana = searchParams.get("arcana");
  const hasArcanaKey = searchParams.get("arcana_key");
  const hasModelArcana = searchParams.get("model");
  const conversationId = window.location.href.split("/chat/")[1];
  return (
    <div
      className={`h-full ${isDarkMode ? "darkScrollbar" : "lightScrollbar"}`}
    >
      <Routes>
        <Route
          path="/"
          element={<RootRoute />}
        />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/notfound" element={<NotFoundPage />} />
        <Route
          path="/chat"
          element={
            // <ChatRoute
            //   hasSettings={hasSettings}
            //   hasImport={hasImport}
            //   hasArcana={hasArcana}
            //   hasArcanaKey={hasArcanaKey}
            //   hasModelArcana={hasModelArcana}
            // />
            <ConversationRoute
            />
          }
        />
        <Route
          path="/chat/:conversationId"
          element={
            <ConversationRoute
              conversationId={conversationId}
            />
          }
        />
        <Route
          path="*"
          element={<RootRoute />}
        />
      </Routes>
    </div>
  );
};

export default PublicRoute;
