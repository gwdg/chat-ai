import { createSlice } from "@reduxjs/toolkit";

const currentConversationSlice = createSlice({
    name: "currentConversation",
    initialState: null,
    reducers: {
        setCurrentConversation: {
            reducer: (state, action) => {
                return action.payload
            }
        }
    }
});

export const { setCurrentConversation } = currentConversationSlice.actions
export default currentConversationSlice.reducer;
    // if (state.conversations.some((conv) => conv.id === conversationId)) {
    //     state.current_conversation = conversationId;
    // } else if (state.conversations.length > 0) {
    //     state.current_conversation = state.conversations[0].id;
    // }