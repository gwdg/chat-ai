import { createSlice } from "@reduxjs/toolkit";

const lastConversationSlice = createSlice({
    name: "lastConversation",
    initialState: null,
    reducers: {
        setLastConversation: {
            reducer: (state, action) => {
                return action.payload
            }
        }
    }
});

export const { setLastConversation } = lastConversationSlice.actions
export default lastConversationSlice.reducer;
export const selectLastConversation = (state) => state?.last_conversation || null;