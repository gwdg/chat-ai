import { createContext } from "react";

// When provided, useSendMessage delegates to this function instead of the
// normal persisted-conversation sender. Used by the ephemeral Meta chat.
export const MetaChatSendContext = createContext(null);
