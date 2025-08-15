export function setupTabChangeSync(store) {
  // Track if we're currently syncing
  let isSyncing = false;

  // Handle tab becoming visible
  const handleVisibilityChange = () => {
    // Only sync when tab becomes visible
    if (document.visibilityState === "visible") {
      syncFromLocalStorage();
    }
  };

  // Handle before unload event (tab/window closing or navigating away)
  const handleBeforeUnload = (event) => {
    const state = store.getState();
    const lockConversation = state.lock_conversation;

    // If we're currently getting a response, show warning
    if (lockConversation) {
      // Standard way to show confirmation dialog when leaving page
      event.preventDefault();
      event.returnValue =
        "You have an active response loading. Are you sure you want to leave?";
      return event.returnValue;
    }
  };

  // Sync from localStorage when a tab becomes active
  const syncFromLocalStorage = () => {
    // Prevent recursive syncing
    if (isSyncing) return;
    isSyncing = true;

    try {
      // Get current state
      const currentState = store.getState();

      // Check if currently responding - don't sync if we are
      if (currentState.lockConversation) {
        finishSync();
        return;
      }

      // Set isResponding to indicate sync in progress
      store.dispatch({ type: "conversations/setLockConversation", payload: true });

      const currentConversationId = currentState.current_conversation;

      // Get the current prompt so we can preserve it
      const currentConversation = currentState.conversations.find(
        (conv) => conv.id === currentConversationId
      );
      const currentPrompt = currentConversation?.messages[-1].content.data || "";

      // Get persisted data from localStorage
      const persistedData = localStorage.getItem("persist:root");
      if (!persistedData) {
        finishSync();
        return;
      }

      // Parse the root object
      const parsedRoot = JSON.parse(persistedData);
      if (!parsedRoot || !parsedRoot.conversations) {
        finishSync();
        return;
      }

      // Parse the conversations data
      const conversationsData = JSON.parse(parsedRoot.conversations);
      if (!conversationsData || !conversationsData.conversations) {
        finishSync();
        return;
      }

      // Get the persisted conversations array
      const persistedConversations = conversationsData;
      const currentConversations = currentState.conversations;

      // Update the Redux store with merged data
      store.dispatch({
        type: "conversations/syncOnTabChange",
        payload: {
          persistedConversations,
          currentConversations,
          currentConversationId,
          currentPrompt,
        },
      });
    } catch (error) {
      console.error("Error syncing on tab change:", error);
    } finally {
      finishSync();
    }
  };

  // Clean up after sync
  const finishSync = () => {
    setTimeout(() => {
      store.dispatch({ type: "conversations/setLockConversation", payload: false });
      isSyncing = false;
    }, 300);
  };

  // Set up the event listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", handleBeforeUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}
