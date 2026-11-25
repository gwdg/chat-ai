import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import {
  feedbackMessagesFromConversation,
  isChatFeedbackEnabled,
  submitConversationAnalysis,
} from "../apis/feedback";
import {
  selectFeedbackEnabled,
  selectFeedbackFullTranscript,
} from "../Redux/reducers/userSettingsReducer";
import {
  clearFeedbackCursor,
  feedbackDelta,
  readFeedbackCursor,
  transcriptHash,
  writeFeedbackCursor,
} from "../utils/feedbackCursor";

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
 *
 * With "whole transcripts" switched off the send is a delta: the receiver keeps
 * one row per chat and the app sends only the turns after the cursor it stored
 * for the last delivered submission. A cursor that no longer matches (the chat
 * was edited or trimmed) or a `409` from the receiver falls back to the whole
 * transcript, so a merge can never stitch together two different beginnings.
 */
export function useFeedbackConversationSync(localState) {
  const preference = useSelector(selectFeedbackEnabled);
  const wholeTranscript = useSelector(selectFeedbackFullTranscript);
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

  // Read at send time, so switching the transcript mode mid-chat takes effect
  // on the next change without restarting the debounce.
  const wholeTranscriptRef = useRef(wholeTranscript);
  wholeTranscriptRef.current = wholeTranscript;

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
        const transcripts = feedbackMessagesFromConversation(state?.messages);
        if (!transcripts.length) return;
        const whole = wholeTranscriptRef.current;
        const delta = whole
          ? null
          : feedbackDelta(transcripts, readFeedbackCursor(conversationId));
        const sendOnce = (outgoing, mode, offset) =>
          submitConversationAnalysis({
            conversation: state,
            messages: outgoing,
            mode,
            offset,
            model: state?.settings?.model,
            route:
              typeof window === "undefined"
                ? ""
                : window.location.pathname + window.location.search,
          });

        const nothingNew = !whole && delta && !delta.length;
        if (!nothingNew) {
          try {
            await sendOnce(
              whole || !delta ? transcripts : delta,
              whole ? "full" : "delta",
              // A diverged prefix (`delta === null`) is replaced from the
              // start, never appended to what the receiver already holds.
              delta ? transcripts.length - delta.length : 0,
            );
          } catch (error) {
            if (whole || error?.code !== "conflict") throw error;
            // The receiver's stored transcript is not the prefix we assumed.
            // Forget the cursor and send the whole thing as a delta from 0.
            clearFeedbackCursor(conversationId);
            await sendOnce(transcripts, "delta", 0);
          }
        }
        // Whatever was delivered, the receiver now holds this transcript; the
        // next change sends only what follows it.
        writeFeedbackCursor(conversationId, {
          count: transcripts.length,
          hash: transcriptHash(transcripts),
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
