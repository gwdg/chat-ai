// store/conversationsSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import { getDefaultSettings } from "../../utils/settingsUtils";

const createDefaultConversation = (customSettings = {}) => {
  const defaultSettings = getDefaultSettings();

  const settings = { ...defaultSettings, ...customSettings };

  return {
    id: uuidv4(),
    title: "Untitled Conversation",
    messages: [
      {
        role: "system",
        content: settings.systemPrompt,
      },
    ],
    responses: [],
    prompt: "",
    settings,
    exportOptions: {
      exportSettings: false,
      exportImage: false,
      exportArcana: false,
    },
    dontShow: {
      dontShowAgain: false,
      dontShowAgainShare: false,
      dontShowAgainMemory: false,
    },
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
};

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
      prepare: (providedId = null, customSettings = {}) => {
        const newConversation = createDefaultConversation(customSettings);

        // If an ID is provided (for syncing), use it instead
        if (providedId) {
          newConversation.id = providedId;
        }

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
        // Skip auto-adding system message if we're updating both conversation and settings
        // (which indicates an import operation)
        const isImportOperation =
          updates.messages && updates.settings?.systemPrompt;

        if (updates.messages && !isImportOperation) {
          // Only auto-add system message for regular updates, not imports
          const hasSystemMessage = updates.messages.some(
            (msg) => msg.role === "system"
          );
          if (!hasSystemMessage) {
            updates.messages = [
              {
                role: "system",
                content: conversation.settings.systemPrompt,
              },
              ...updates.messages,
            ];
          }
        }

        Object.assign(conversation, updates);
        conversation.lastModified = new Date().toISOString();
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
        // If last conversation was deleted, set to null to indicate we need a new one
        state.currentConversationId = null;
      } else if (state.currentConversationId === idToDelete) {
        // If deleted conversation was current, move to the previous conversation
        // (or the next one if deleting the first conversation)
        const newIndex = currentIndex === 0 ? 0 : currentIndex - 1;
        state.currentConversationId = state.conversations[newIndex].id;
      }
      // If deleted conversation wasn't current, currentConversationId stays the same
    },
    setCurrentConversation: (state, action) => {
      const conversationId = action.payload;
      if (state.conversations.some((conv) => conv.id === conversationId)) {
        state.currentConversationId = conversationId;
      } else if (state.conversations.length > 0) {
        state.currentConversationId = state.conversations[0].id;
      }
    },
    resetStore: {
      reducer: (state, action) => {
        const newConversation = action.payload;
        state.conversations = [newConversation];
        state.currentConversationId = newConversation.id;
        state.isResponding = false;
      },
      prepare: (providedId = null, customSettings = {}) => {
        const newId = providedId || uuidv4();
        const defaultSettings = getDefaultSettings();
        const settings = { ...defaultSettings, ...customSettings };

        const newConversation = {
          id: newId,
          title: "Untitled Conversation",
          messages: [
            {
              role: "system",
              content: settings.systemPrompt,
            },
          ],
          responses: [],
          prompt: "",
          settings,
          exportOptions: {
            exportSettings: false,
            exportImage: false,
            exportArcana: false,
          },
          dontShow: {
            dontShowAgain: false,
            dontShowAgainShare: false,
            dontShowAgainMemory: false,
          },
          arcana: {
            id: "",
            key: "",
          },
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        };

        return {
          payload: newConversation,
          meta: { id: newId, sync: true },
        };
      },
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
  state.conversations.currentConversationId
    ? state.conversations.conversations.find(
        (conv) => conv.id === state.conversations.currentConversationId
      )
    : null;
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
