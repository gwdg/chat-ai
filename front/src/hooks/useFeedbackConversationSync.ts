import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import {
  feedbackMessagesFromConversation,
  isChatFeedbackEnabled,
  submitConversationAnalysis,
} from "../apis/feedback";
import { selectFeedbackEnabled } from "../Redux/reducers/userSettingsReducer";

/** Wait for the reply to settle before sending the conversation again. */
const DEBOUNCE_MS = 4000;

const conversationSignature = (messages) =>
  JSON.stringify(feedbackMessagesFromConversation(messages));

/**
 * Sends the open conversation to the deployment's feedback receiver for analysis
 * whenever it changes and the turn has finished.
 *
 * Opening a chat does not send anything: the first signature per conversation is
 * only the baseline. A reply that is still streaming is skipped, and the send is
 * debounced so a whole reply is one message rather than one per token. The Meta
 * chat and chats without user/assistant turns are never sent.
 */
export function useFeedbackConversationSync(localState) {
  const preference = useSelector(selectFeedbackEnabled);
  const enabled = preference && isChatFeedbackEnabled();
  const conversationId = localState?.id ?? null;
  const messages = localState?.messages ?? [];
  const signature = useMemo(
    () => conversationSignature(messages),
    [messages],
  );
  const loading = messages.some((message) => message?.loading);

  // The last signature that must not be sent again: the one a chat was opened
  // with, the one last sent, or the latest while the feature is switched off.
  const baselineRef = useRef({ id: null, signature: "" });
  const timerRef = useRef(null);
  const latestStateRef = useRef(localState);
  latestStateRef.current = localState;

  useEffect(() => {
    if (baselineRef.current.id !== conversationId) {
      baselineRef.current = { id: conversationId, signature };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    if (
      !enabled ||
      !conversationId ||
      conversationId === "meta-chat" ||
      latestStateRef.current?.isMetaChat === true
    ) {
      // Keep the baseline current, so switching the feature on mid-chat does not
      // immediately post everything that was written while it was off.
      baselineRef.current = { id: conversationId, signature };
      return undefined;
    }

    // A streaming reply changes the signature on every token; wait for it to end.
    if (loading) return undefined;
    if (signature === baselineRef.current.signature) return undefined;

    if (timerRef.current) clearTimeout(timerRef.current);
    const pendingSignature = signature;
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      const state = latestStateRef.current;
      try {
        await submitConversationAnalysis({
          conversation: state,
          model: state?.settings?.model,
          route:
            typeof window === "undefined"
              ? ""
              : window.location.pathname + window.location.search,
        });
        // Only a delivered conversation becomes the new baseline; a failure is
        // retried by the next change instead of being re-sent on every render.
        baselineRef.current = { id: conversationId, signature: pendingSignature };
      } catch (error) {
        console.warn("Conversation feedback could not be sent", error);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, conversationId, signature, loading]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
}
