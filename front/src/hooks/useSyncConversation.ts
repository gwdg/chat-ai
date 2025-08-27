import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getConversation, updateConversation, listConversationMetas } from "../db";

import {
  selectCurrentConversationId,
} from "../Redux/reducers/conversationsSlice";

import type { ConversationRow } from "../db/dbTypes";

import { setCurrentConversation } from "../Redux/reducers/currentConversationSlice.jsx";
import conversationsSlice from "../Redux/reducers/conversationsSlice.jsx";
import { selectCurrentConversation } from "../Redux/reducers/currentConversationSlice.jsx";

import { setLastConversationId, selectLastConversationId } from "../Redux/reducers/lastConversationSlice.jsx";

import { getConversationMeta, getLastModifiedConversationMeta, createConversation } from "../db/index";

import { getDefaultConversation } from "../utils/conversationUtils";

import { validate as validateUUID, version as versionUUID } from "uuid";
import { current } from "@reduxjs/toolkit";

async function loadConversation(navigate, conversationId, lastConversationId): Promise<ConversationRow | undefined> {
  console.log("loadConversation: called with conversationId:", conversationId);

  if (conversationId) {
    // if conversationId provided try to load from dexie
    try {
      const conversation = await getConversation(conversationId);
      console.log("Loaded conversation, ", conversation.id);
      if (!conversation) {
        navigate(`/notfound`);
        return undefined
      }
      return conversation;
    } catch (error) {
      // on error try further
    }
  }

  if (lastConversationId) {
    // if lastConversationId exists in redux, try to load from dexie with that
    try {
      const conversation = await getConversation(lastConversationId);
      console.log("Loaded last conversation, ", conversation.id);
      if (!conversation) {
        navigate(`/notfound`);
        return undefined
      }
      return conversation;
    } catch (error) {
      // on error try further
    }
  }
  // if the two above failed try to load last modified conversation or create new
  
  const lastConversationMeta = await getLastModifiedConversationMeta();
  if (lastConversationMeta !== undefined) {
    console.log("found last modified conversation, navigating to ", lastConversationMeta.id);
    navigate(`/chat/${lastConversationMeta.id}`);
    return undefined
  } else {
    // if above fails create a new conversation
    console.log("creating new conversation");
    const newConversationId = await createConversation(getDefaultConversation());
    navigate(`/chat/${newConversationId}`);
    return undefined
  }
}

export function useSyncConversation({
  localState,
  setLocalState,
  conversationId, // this is a valid uuid, validated in ChatPage, from the url
}: {
  localState: any;
  setLocalState: (state: any) => void;
  conversationId: string;
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const lastConversationId = useSelector(selectCurrentConversationId);

  // State if tab is active or not
  const [isActive, setIsActive] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Effect 2: Debounced auto-save of conversation changes into DB
  const timeoutIds = useRef({});
  const delay = 1000;

  // try to load conversation on mount
  useEffect(() => {
    (async () => {
      const conversation = await loadConversation(navigate, conversationId, lastConversationId);
      if (!conversation) return;
      setLocalState(conversation);
      setInitialized(true);
    })();
  }, [conversationId]);

  useEffect(() => {
    if(!initialized) return;
    const currentConversation = localState?.id;
    // Only auto-save when tab is active
    if (!isActive) return;
    // Clear any scheduled save for this conversation only
    if (!currentConversation) return;
    if (timeoutIds.current[currentConversation]) {
      clearTimeout(timeoutIds.current[currentConversation]);
    }
    // Schedule a save after `delay` ms

    timeoutIds.current[currentConversation] = setTimeout(() => {
      console.log("Auto-saving conversation to Dexie");
      updateConversation(
        currentConversation,
        localState
      )
      delete timeoutIds.current[currentConversation];
    }, delay);
  }, [localState, isActive, delay, dispatch]);

  // Effect 3: Listen for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };
    // Initial state
    setIsActive(!document.hidden);
    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}