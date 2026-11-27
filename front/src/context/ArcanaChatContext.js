import { createContext } from "react";

// When provided, useSendMessage delegates to this function instead of the
// normal persisted-conversation sender. Used by the ephemeral Arcana chat,
// which lives on the Arcana page and never writes a conversation row.
export const ArcanaChatSendContext = createContext(null);
