import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const createDefaultConversation = () => ({
  id: uuidv4(),
  title: "New Chat",
  conversation: [
    {
      role: "system",
      content: "You are a helpful assistant",
    },
  ], // Initialize with system message
  responses: [],
  prompt: "",
  settings: {
    model: "Meta LLaMA 3.1 8B Instruct",
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
      const conversation = state.conversations.find((conv) => conv.id === id);
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
    // ... rest of the reducers remain the same
    deleteConversation: (state, action) => {
      const id = action.payload;
      state.conversations = state.conversations.filter(
        (conv) => conv.id !== id
      );

      if (state.conversations.length === 0) {
        const newConversation = createDefaultConversation();
        state.conversations.push(newConversation);
        state.currentConversationId = newConversation.id;
      } else if (state.currentConversationId === id) {
        state.currentConversationId = state.conversations[0].id;
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
  },
});

export const selectConversations = (state) => state.conversations.conversations;
export const selectCurrentConversationId = (state) =>
  state.conversations.currentConversationId;
export const selectCurrentConversation = (state) =>
  state.conversations.conversations.find(
    (conv) => conv.id === state.conversations.currentConversationId
  );

export const {
  addConversation,
  deleteConversation,
  setCurrentConversation,
  updateConversation,
  resetStore,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
