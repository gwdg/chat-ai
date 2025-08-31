// hooks/useTabTitle.js
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useConversationList } from "../db";
import { selectLastConversation } from "../Redux/reducers/lastConversationSlice";

export const useTabTitle = () => {
  const currentConversationId = useSelector(selectLastConversation);
  const conversations = useConversationList();

  useEffect(() => {
      const currentConversation = conversations?.find(
        (conv) => conv.id === currentConversationId
      );

      if (currentConversation) {
        const title = currentConversation.title || "Untitled Conversation";
        document.title =
          title === "Untitled Conversation" ? "Chat AI" : title + " - Chat AI";
      } else {
        document.title = "Chat AI";
      }
    }, [currentConversationId, conversations]
  );
};

// Component version
export const TabTitleManager = () => {
  useTabTitle();
  return null;
};
