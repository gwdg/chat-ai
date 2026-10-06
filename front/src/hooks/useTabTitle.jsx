// hooks/useTabTitle.js
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { useConversationList } from "../db";
import { selectLastConversation } from "../Redux/reducers/lastConversationSlice";
import branding, { localize } from "../branding";

export const useTabTitle = () => {
  const currentConversationId = useSelector(selectLastConversation);
  const conversations = useConversationList();
  const { i18n } = useTranslation();
  // Branding override: app name in the tab title (see front/branding/)
  const appName = localize(branding.browserTab?.title, i18n.language) || "Chat AI";

  useEffect(() => {
      const currentConversation = conversations?.find(
        (conv) => conv.id === currentConversationId
      );

      if (currentConversation) {
        const title = currentConversation.title || "Untitled Conversation";
        document.title =
          title === "Untitled Conversation" ? appName : title + " - " + appName;
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
