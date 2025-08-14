// store/conversationsSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import { getDefaultConversation } from "../../utils/conversationUtils";
import { setCurrentConversation } from "./currentConversationSlice";
import { useSelector } from "react-redux";

const defaultConversation = getDefaultConversation();
const initialState = [defaultConversation];

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    addConversation: {
      prepare: (customSettings = {}) => {
        const newConversation = getDefaultConversation(customSettings);
        return {
          payload: newConversation,
          meta: { id: newConversation.id },
        };
      },
      reducer: (state, action) => {
        const newConversation = action.payload;
        state.unshift(newConversation);
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
    // resetStore: {
    //   reducer: (state, action) => {
    //     const newConversation = action.payload;
    //     state = [newConversation];
    //     // state.current_conversation = newConversation.id;
    //     // state.lock_conversation = false;
    //   },
    //   prepare: (customSettings = {}) => {
    //     // const newId = providedId || uuidv4();
    //     const defaultSettings = getDefaultSettings();
    //     const settings = { ...defaultSettings, ...customSettings };
    //     const newConversation = getDefaultConversation(settings);
    //     // setCurrentConversation(newConversation.id)
    //     return {
    //       payload: newConversation,
    //       meta: { id: newConversation.id, sync: true },
    //     };
    //   },
    // },
    setLockConversation: (state, action) => {
      // TODO reducer for lock conversation
      // state.lock_conversation = action.payload;
    },
  },
});

export const selectConversations = (state) => state.conversations;
export const selectCurrentConversationId = (state) => state.current_conversation;
// If current_conversation not in conversations, set to next conversation:
// export const selectCurrentConversationId = (state) => {
//   if (!state.conversations.find((conv) => conv.id === state.current_conversation)) {
//     const nextConversation = state.conversations[0];
//     if (nextConversation) {
//       state.current_conversation = nextConversation.id;
//     }
//   }
//   return state.current_conversation;
// };

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
