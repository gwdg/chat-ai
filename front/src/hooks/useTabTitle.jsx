// hooks/useTabTitle.js
import { useEffect } from "react";
import { useSelector } from "react-redux";
import {
  selectConversations,
  selectCurrentConversationId,
} from "../Redux/reducers/conversationsSlice";

export const useTabTitle = () => {
  const conversations = useSelector(selectConversations);
  const currentConversationId = useSelector(selectCurrentConversationId);

  useEffect(() => {
    const currentConversation = conversations?.find(
      (conv) => conv.id === currentConversationId
    );

    if (currentConversation) {
      const title = currentConversation.title || "Untitled Conversation";
      document.title = title === "Untitled Conversation" ? "Chat AI" : title;
    } else {
      document.title = "Chat AI";
    }
  }, [currentConversationId, conversations]);
};

// Component version
export const TabTitleManager = () => {
  useTabTitle();
  return null;
};
