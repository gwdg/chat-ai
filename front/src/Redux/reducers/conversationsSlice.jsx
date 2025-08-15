// store/conversationsSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { getDefaultConversation } from "../../utils/conversationUtils";
const defaultConversation = getDefaultConversation();
const initialState = [defaultConversation];

const conversationsSlice = createSlice({
  name: "conversations",
  initialState,
  reducers: {
    setConversations: {
      reducer: (state, action) => {
        return action.payload;
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
    ? state.conversations?.find(
        (conv) => conv.id === state.current_conversation
      )
    : null;
export const selectLockConversation = (state) => state.lock_conversation;

export const {
  setConversations,
  setLockConversation,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;
