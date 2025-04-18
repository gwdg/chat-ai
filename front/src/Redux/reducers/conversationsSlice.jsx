import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const createDefaultConversation = () => ({
  id: uuidv4(),
  title: "Untitled Conversation",
  conversation: [
    {
      role: "system",
      content: "You are a helpful assistant",
    },
  ], // Initialize with system message
  responses: [],
  prompt: "",
  settings: {
    model: "Meta Llama 3.1 8B Instruct",
    model_api: "meta-llama-3.1-8b-instruct",
    temperature: 0.5,
    top_p: 0.5,
    systemPrompt: "You are a helpful assistant",
  },
  exportOptions: {
    exportSettings: false,
    exportImage: false,
    exportArcana: false,
  },
  dontShow: {
    dontShowAgain: false,
    dontShowAgainShare: false,
  },
  arcana: {
    id: "",
    key: "",
  },
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
});

const defaultConversation = createDefaultConversation();

const initialState = {
  conversations: [defaultConversation],
  currentConversationId: defaultConversation.id,
  isResponding: false,
};

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    addConversation: {
      reducer: (state, action) => {
        const newConversation = action.payload;
        state.conversations.unshift(newConversation);
        state.currentConversationId = newConversation.id;
      },
      prepare: () => {
        const newConversation = createDefaultConversation();
        return {
          payload: newConversation,
          meta: { id: newConversation.id },
        };
      },
    },
    updateConversation: (state, action) => {
      const { id, updates } = action.payload;
      const conversation = state.conversations?.find((conv) => conv.id === id);
      if (conversation) {
        // Ensure system message remains at the start when updating conversation array
        if (updates.conversation) {
          const hasSystemMessage = updates.conversation.some(
            (msg) =>
              msg.role === "system" &&
              msg.content === "You are a helpful assistant"
          );

          if (!hasSystemMessage) {
            updates.conversation = [
              {
                role: "system",
                content: "You are a helpful assistant",
              },
              ...updates.conversation,
            ];
          }
        }
        Object.assign(conversation, updates);
      }
    },
    deleteConversation: (state, action) => {
      const idToDelete = action.payload;
      const currentIndex = state.conversations.findIndex(
        (conv) => conv.id === idToDelete
      );

      // If conversation not found, do nothing
      if (currentIndex === -1) return;

      // Remove the conversation
      state.conversations = state.conversations.filter(
        (conv) => conv.id !== idToDelete
      );

      // Handle different cases for currentConversationId
      if (state.conversations.length === 0) {
        // If last conversation was deleted, create a new one
        const newConversation = createDefaultConversation();
        state.conversations.push(newConversation);
        state.currentConversationId = newConversation.id;
      } else if (state.currentConversationId === idToDelete) {
        // If deleted conversation was current, move to the previous conversation
        // (or the next one if deleting the first conversation)
        const newIndex = currentIndex === 0 ? 0 : currentIndex - 1;
        state.currentConversationId = state.conversations[newIndex].id;
      }
      // If deleted conversation wasn't current, currentConversationId stays the same
    },
    syncOnTabChange: (state, action) => {
      const {
        persistedConversations,
        currentConversations,
        currentConversationId,
        currentPrompt,
      } = action.payload;

      // Create a map of current conversations for easy lookup
      const currentConversationsMap = {};
      currentConversations.forEach((conv) => {
        currentConversationsMap[conv.id] = conv;
      });

      // Create a merged array with the persisted conversations as the base
      const mergedConversations = [...persistedConversations];

      // Preserve the current prompt in the active conversation
      const activeConversationIndex = mergedConversations.findIndex(
        (conv) => conv.id === currentConversationId
      );

      if (activeConversationIndex !== -1) {
        // Update the prompt of the active conversation
        mergedConversations[activeConversationIndex] = {
          ...mergedConversations[activeConversationIndex],
          prompt: currentPrompt,
        };
      }

      // Update the state with the merged conversations
      state.conversations = mergedConversations;

      // Make sure the current conversation still exists
      const conversationExists = mergedConversations.some(
        (conv) => conv.id === currentConversationId
      );
      if (conversationExists) {
        state.currentConversationId = currentConversationId;
      } else if (mergedConversations.length > 0) {
        state.currentConversationId = mergedConversations[0].id;
      }
    },
    setCurrentConversation: (state, action) => {
      const conversationId = action.payload;
      if (state.conversations.some((conv) => conv.id === conversationId)) {
        state.currentConversationId = conversationId;
      } else if (state.conversations.length > 0) {
        state.currentConversationId = state.conversations[0].id;
      }
    },
    resetStore: (state) => {
      const newConversation = createDefaultConversation();
      state.conversations = [newConversation];
      state.currentConversationId = newConversation.id;
    },
    setIsResponding: (state, action) => {
      state.isResponding = action.payload;
    },
  },
});

export const selectConversations = (state) => state.conversations.conversations;
export const selectCurrentConversationId = (state) =>
  state.conversations.currentConversationId;
export const selectCurrentConversation = (state) =>
  state?.conversations?.conversations?.find(
    (conv) => conv.id === state.conversations.currentConversationId
  );
export const selectIsResponding = (state) => state.conversations.isResponding;
export const {
  addConversation,
  deleteConversation,
  setCurrentConversation,
  updateConversation,
  resetStore,
  setIsResponding,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
