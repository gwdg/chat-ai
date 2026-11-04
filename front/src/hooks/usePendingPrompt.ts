import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

type PendingPromptLocationState = {
  pendingPrompt?: unknown;
  pendingAttachments?: unknown;
} | null;

/**
 * Sends the first prompt of a chat created from the topic master view.
 *
 * The master view cannot send directly: the conversation only becomes a
 * normal chat after it is persisted and ChatPage has hydrated it. So it
 * creates the row, navigates here with `state.pendingPrompt`, and this hook
 * fills the empty draft message and starts the regular send pipeline.
 */
export function usePendingPrompt({
  conversationId,
  localState,
  setLocalState,
  sendMessage,
}: {
  conversationId?: string;
  localState: any;
  setLocalState: (state: any) => void;
  sendMessage: (args: { localState: any; setLocalState: any }) => Promise<void>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const consumedForConversation = useRef<string | null>(null);

  useEffect(() => {
    const state = location.state as PendingPromptLocationState;
    const pendingPrompt =
      typeof state?.pendingPrompt === "string" ? state.pendingPrompt : "";
    const pendingAttachments = Array.isArray(state?.pendingAttachments)
      ? state.pendingAttachments
      : [];

    if (!pendingPrompt.trim() && pendingAttachments.length === 0) return;
    if (!conversationId || localState?.id !== conversationId) return;
    if (consumedForConversation.current === conversationId) return;

    const messages = localState?.messages;
    if (!Array.isArray(messages) || messages.length === 0) return;

    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    if (lastMessage?.role !== "user") return;

    consumedForConversation.current = conversationId;
    // Drop the router state before sending, so a reload cannot resend it.
    navigate(location.pathname, { replace: true, state: null });

    const nextState = {
      ...localState,
      messages: messages.map((message: any, index: number) =>
        index === lastIndex
          ? {
              ...message,
              content: [
                { type: "text", text: pendingPrompt },
                ...pendingAttachments,
              ],
            }
          : message,
      ),
    };

    setLocalState(nextState);
    void sendMessage({ localState: nextState, setLocalState });
  }, [
    conversationId,
    localState,
    location.pathname,
    location.state,
    navigate,
    sendMessage,
    setLocalState,
  ]);
}
