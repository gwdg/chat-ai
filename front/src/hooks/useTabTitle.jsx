// hooks/useTabTitle.js
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useConversationList } from "../db";
import { selectLastConversation } from "../Redux/reducers/lastConversationSlice";
import { useBrand } from "../config/BrandProvider";

export const useTabTitle = () => {
  const currentConversationId = useSelector(selectLastConversation);
  const conversations = useConversationList();
  const { brand } = useBrand();
  const appName = brand?.name || "Chat AI";

  useEffect(() => {
      const currentConversation = conversations?.find(
        (conv) => conv.id === currentConversationId
      );

      if (currentConversation) {
        const title = currentConversation.title || "Untitled Chat";
        // "Untitled Conversation" is the pre-rename default, still stored on
        // chats created before it changed.
        const untitled =
          title === "Untitled Chat" || title === "Untitled Conversation";
        document.title = untitled ? appName : title + " - " + appName;
      } else {
        document.title = appName;
      }
    }, [currentConversationId, conversations, appName]
  );
};

// Component version
export const TabTitleManager = () => {
  useTabTitle();
  return null;
};
