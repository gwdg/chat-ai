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
        content: settings.system_prompt,
      },
    ],
    responses: [],
    prompt: "",
    settings,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
};

const defaultConversation = createDefaultConversation();

const initialState = [defaultConversation];

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    addConversation: {
      reducer: (state, action) => {
        const newConversation = action.payload;
        state.unshift(newConversation);
        // state.currentConversationId = newConversation.id;
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
      const conversation = state?.find((conv) => conv.id === id);
      if (conversation) {
        // Skip auto-adding system message if we're updating both conversation and settings
        // (which indicates an import operation)
        // const isImportOperation =
        //   updates.messages && updates.settings?.system_prompt;

        // if (updates.messages && !isImportOperation) {
        //   // Only auto-add system message for regular updates, not imports
        //   const hasSystemMessage = updates.messages.some(
        //     (msg) => msg.role === "system"
        //   );
        //   if (!hasSystemMessage) {
        //     updates.messages = [
        //       {
        //         role: "system",
        //         content: "TODO You are a helpful assistant",
        //       },
        //       ...updates.messages, // TODO remove non-system messages
        //     ];
        //   }
        // }
        Object.assign(conversation, updates);
        conversation.lastModified = new Date().toISOString();
      }
    },
    deleteConversation: (state, action) => {
      // Remove the conversation
      return state.filter(
        (conv) => conv.id !== action.payload
      );
    },
    resetStore: {
      reducer: (state, action) => {
        const newConversation = action.payload;
        state = [newConversation];
        // state.current_conversation = newConversation.id;
        // state.lock_conversation = false;
      },
      prepare: (providedId = null, customSettings = {}) => {
        const newId = providedId || uuidv4();
        const defaultSettings = getDefaultSettings();
        const settings = { ...defaultSettings, ...customSettings };

        const newConversation = createDefaultConversation(settings);

        return {
          payload: newConversation,
          meta: { id: newId, sync: true },
        };
      },
    },
    setLockConversation: (state, action) => {
      // TODO reducer for lock conversation
      // state.lock_conversation = action.payload;
    },
  },
});

export const selectConversations = (state) => state.conversations;
export const selectCurrentConversationId = (state) => state.current_conversation;
export const selectCurrentConversation = (state) =>
  state.current_conversation
    ? state.conversations.find(
        (conv) => conv.id === state.current_conversation
      )
    : null;
export const selectLockConversation = (state) => state.lock_conversation;

export const {
  addConversation,
  deleteConversation,
  updateConversation,
  resetStore,
  setLockConversation,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
