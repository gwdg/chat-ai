import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import generateConversationSummary from "../apis/generateConversationSummary";
import { getConversationMeta, setConversationSummary } from "../db";
import {
  selectConversationSummaries,
  selectUserSettings,
} from "../Redux/reducers/userSettingsReducer";
import { conversationSummarySignature } from "../utils/conversationSummary";

const MAX_STORED_STATES = 3;

export function useConversationSummaries({ localState, conversationId }) {
  const summariesEnabled = useSelector(selectConversationSummaries);
  const userSettings = useSelector(selectUserSettings);
  const enabledRef = useRef(summariesEnabled);
  const settingsRef = useRef(userSettings);
  const statesRef = useRef(new Map());
  const previousIdRef = useRef(null);
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    enabledRef.current = summariesEnabled;
  }, [summariesEnabled]);

  useEffect(() => {
    settingsRef.current = userSettings;
  }, [userSettings]);

  useEffect(() => {
    if (!localState?.id) return;
    const states = statesRef.current;
    states.delete(localState.id);
    states.set(localState.id, localState);
    while (states.size > MAX_STORED_STATES) {
      const oldest = states.keys().next().value;
      states.delete(oldest);
    }
  }, [localState]);

  useEffect(() => {
    const previousId = previousIdRef.current;
    const nextId = conversationId ?? localState?.id ?? null;
    previousIdRef.current = nextId;

    if (!previousId || previousId === nextId) return;
    if (!enabledRef.current) return;
    if (inFlightRef.current.has(previousId)) return;

    const snapshot = statesRef.current.get(previousId);
    if (!snapshot) return;

    inFlightRef.current.add(previousId);

    void (async () => {
      try {
        const sourceHash = conversationSummarySignature(
          snapshot.messages ?? [],
        );
        if (!sourceHash) return;

        const meta = await getConversationMeta(previousId);
        if (!meta) return;
        if (meta.summary && meta.summarySourceHash === sourceHash) return;
        if (!enabledRef.current) return;

        const summary = await generateConversationSummary({
          localState: snapshot,
          userSettings: settingsRef.current,
        });
        if (!summary || !enabledRef.current) return;

        await setConversationSummary(previousId, summary, sourceHash);
      } catch (error) {
        console.warn("Conversation summary generation failed", error);
      } finally {
        inFlightRef.current.delete(previousId);
      }
    })();
  }, [conversationId]);
}
