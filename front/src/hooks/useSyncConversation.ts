import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getConversation, updateConversation, listConversationMetas } from "../db";

import {
  selectCurrentConversationId,
} from "../Redux/reducers/conversationsSlice";

import type { ConversationRow } from "../db/dbTypes";

import { setLastConversation, selectLastConversation } from "../Redux/reducers/lastConversationSlice.jsx";

import { getConversationMeta, getLastModifiedConversationMeta, createConversation } from "../db/index";

import { getDefaultConversation } from "../utils/conversationUtils";

import { validate as validateUUID, version as versionUUID } from "uuid";
import { useModal } from "../modals/ModalContext";
function validateConversationId(conversationId: string): boolean {
  return validateUUID(conversationId) && versionUUID(conversationId) === 4;
}

async function loadConversation(navigate, conversationId, lastConversationId): Promise<ConversationRow | undefined> {
  // conversationId in URL, try to use it
  if (conversationId) {
    // Check if Id is valid UUID
    if(!validateConversationId(conversationId)) {
      console.error("Invalid conversation: ", conversationId);
      navigate("/notfound");
      return undefined
    }

    // if conversationId provided try to load from dexie
    try {
      const conversation = await getConversation(conversationId);
      if (!conversation) {
        console.log("Conversation ", conversationId, " not found");
        navigate(`/notfound`);
        return undefined
      }
      console.log("Loaded conversation, ", conversation.id);
      return conversation;
    } catch (error) {
      console.log("Conversation ", conversationId, " could not be loaded: ", error);
    }
  }

  // No conversationId in URL, must determine automatically
  if (lastConversationId) {
    // if lastConversationId exists in redux, try to load from dexie with that
    try {
      const conversation = await getConversation(lastConversationId);
      if (!conversation) {
        console.log("Conversation ", lastConversationId, " not found");
        navigate(`/notfound`);
        return undefined
      }
      console.log("Loaded last conversation, ", conversation.id);
      return conversation;
    } catch (error) {
      // on error try further
    }
  }

  // if the two above failed try to load last modified conversation or create new
  const lastConversationMeta = await getLastModifiedConversationMeta();
  if (lastConversationMeta !== undefined) {
    console.log("Got most recent conversation: ", lastConversationMeta?.id);
    navigate(`/chat/${lastConversationMeta?.id}`);
    return undefined
  } else {
    // if above fails create a new conversation
    console.log("Creating new conversation");
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
  const navigate = useNavigate();
  const lastConversation = useSelector(selectLastConversation);
  const { openModal } = useModal();

  // State if tab is active or not
  const [isActive, setIsActive] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const timeoutIds = useRef({});
  const delay = 1000;

  // Effect 1: Try to load conversation on mount
  useEffect(() => {
    (async () => {
      console.log("Setting initializd to false")
      setInitialized(false);
      const conversation = await loadConversation(navigate, conversationId, lastConversation);
      if (!conversation) return;
      setLocalState(conversation);
    })();
  }, [conversationId]);

  // Effect 2: Debounced auto-save into IndexedDB
  useEffect(() => {
    if(!initialized) {
      if (localState?.id === conversationId) {
        setInitialized(true); // Initialized for next change
      }
      return;
    }
    const currentConversation = localState?.id;
    // Check if want to write immediately
    const saveImmediately = localState?.flush || false;
    if (localState?.flush) {
        console.log("Flushing to DB....")
        delete localState.flush
    }
    if (!isActive) return; // Only auto-save when tab active
    if (!currentConversation) return;
    setUnsavedChanges(true);
    // Clear any scheduled save for this conversation only
    if (timeoutIds.current[currentConversation]) {
      clearTimeout(timeoutIds.current[currentConversation]);
    }
    // Schedule a save after `delay` ms
    timeoutIds.current[currentConversation] = setTimeout(async () => {
      const lastModified = await updateConversation(
        currentConversation,
        localState
      )
      if (lastModified === -1) { // Conflict detected
        console.log("Conflict detected")
        openModal("conversationConflict", {localState, setLocalState, setUnsavedChanges});
        return;
      }
      console.log("Conversation auto-saved");
      setUnsavedChanges(false);
      localState.lastModified = lastModified;
      delete timeoutIds.current[currentConversation];
    }, (saveImmediately ? 0 : delay));
  }, [localState, delay]);

  // Effect 3: Listen for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
      if (document.hidden) return;
    };
    // Initial state
    setIsActive(!document.hidden);
    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Effect 4: Update conversation when tab is activated
  useEffect(() => {
    if (!isActive) return;
    // Tab is now active, check for updates to conversation
    (async () => {
      if (!initialized) return;
      if (unsavedChanges) return; // Wait for user decision
      // Check if any changes were made while inactive
      const currentConversation = localState?.id;
      const lastModified = (await getConversationMeta(currentConversation)).lastModified;
      if (lastModified === localState.lastModified) return; // No changes
      // Changes detected, load from DB
      setInitialized(false);
      const conversation = await loadConversation(navigate, conversationId, lastConversation);
      if (!conversation) return;
      setLocalState(conversation);
      console.log("Loaded updated conversation from browser");
    })();
  }, [isActive]);
}