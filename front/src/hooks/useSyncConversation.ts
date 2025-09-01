import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getConversation, updateConversation, listConversationMetas } from "../db";

import {
  selectCurrentConversationId,
} from "../Redux/reducers/conversationsSlice";

import type { ConversationRow } from "../db/dbTypes";

import { setLastConversation, selectLastConversation } from "../Redux/reducers/lastConversationSlice.jsx";

import { getConversationMeta, getLastModifiedConversationMeta, createConversation } from "../db/index";

import { validate as validateUUID, version as versionUUID } from "uuid";
import { useModal } from "../modals/ModalContext";
import { getDefaultConversation } from "../utils/conversationUtils";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import { useImportConversation } from "./useImportConversation";
function validateConversationId(conversationId: string): boolean {
  return validateUUID(conversationId) && versionUUID(conversationId) === 4;
}

async function loadConversation(navigate, conversationId, lastConversationId, userSettings = {}, sharedSettings = null, importURL = null, importConversation = null): Promise<ConversationRow | undefined> {
  if (importURL) {
    try {
        const response = await fetch(importURL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        await importConversation(data);
    } catch (error) {
        console.error("Failed to import from URL:", error);
    }
    return;
  }
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
    console.log("Loading most recent conversation: ", lastConversationMeta?.id);
    if (sharedSettings) {
      navigate(`/chat/${lastConversationMeta?.id}?settings=${sharedSettings}`);
      return undefined;
    }
    navigate(`/chat/${lastConversationMeta?.id}`);
    return undefined
  } else {
    // if above fails create a new conversation
    const newConversationId = await createConversation(getDefaultConversation(userSettings));
    if (sharedSettings) {
      navigate(`/chat/${newConversationId}?settings=${sharedSettings}`);
      return undefined;
    }
    navigate(`/chat/${newConversationId}`);
    return undefined
  }
}

function decodeSettings(base64Settings) {
  let settings;
  try{
    // Step 1: Base64 decode
    const jsonString = atob(base64Settings);
    // Step 2: Parse into object
    settings = JSON.parse(jsonString);
    // Step 3: Recursively URL-decode all string values
    function decodeURIComponentDeep(obj) {
      if (typeof obj === 'string') {
        return decodeURIComponent(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(decodeURIComponentDeep);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj).map(([k, v]) => [k, decodeURIComponentDeep(v)])
        );
      }
      return obj;
    }
    settings = decodeURIComponentDeep(settings);
  } catch (err) {
    console.warn("Failed to read settings", err);
    return {};
  }
  return settings;
}

export function useSyncConversation({
  localState,
  setLocalState,
  conversationId, // this is a valid uuid, validated in ChatPage, from the url
}: {
  localState: any;
  setLocalState: (state: any) => void;
  conversationId: string;
  sharedSettings: string | null,
  importURL: string | null,
}) {
  const navigate = useNavigate();
  const lastConversation = useSelector(selectLastConversation);
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedSettings = searchParams.get("settings");
  const importURL = searchParams.get("import");
  const importConversation = useImportConversation();

  const { openModal } = useModal();

  // State if tab is active or not
  const [isActive, setIsActive] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const userSettings = useSelector(selectUserSettings);

  const timeoutIds = useRef({});
  const lastModified = useRef({});
  const delay = 600;

  // Effect 1: Try to load conversation on mount
  useEffect(() => {
    (async () => {
      const conversation = await loadConversation(navigate, conversationId, lastConversation, userSettings, sharedSettings, importURL, importConversation);
      if (!conversation) return;
      lastModified.current[conversationId] = conversation?.lastModified || 0;
      if (sharedSettings) {
        const decodedSettings = decodeSettings(sharedSettings);
        const system_prompt = decodedSettings?.system_prompt || decodedSettings?.systemPrompt ||
          conversation?.messages?.content[0] || "";
        delete decodedSettings?.system_prompt;
        delete decodedSettings?.systemPrompt;
        const updatedConversation = {
          ...conversation,
          messages: [
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
            ...conversation.messages.slice(1),
          ],
          settings: {...conversation.settings, ...decodedSettings}
        }
        setSearchParams();
        setLocalState( updatedConversation );
        return;
      } 
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
    const flushChanges = localState?.flush || false;
    if (localState?.flush) {
        // console.log("Flushing to DB....")
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
      let ignoreConflict = false;
      if (localState?.ignoreConflict) {
          ignoreConflict = true;
          delete localState.ignoreConflict;
      }
      const newLastModified = await updateConversation(
        currentConversation,
        { ...localState, lastModified: lastModified.current[currentConversation] }
      )
      if (newLastModified === -1) { // Conflict detected
        if (ignoreConflict) return;
        console.log("Conflict for conversation ", currentConversation);
        openModal("conversationConflict", {localState, setLocalState, setUnsavedChanges});
        return;
      }
      console.log("Conversation auto-saved");
      setUnsavedChanges(false);
      lastModified.current[currentConversation] = newLastModified;
      delete timeoutIds.current[currentConversation];
    }, (flushChanges ? 0 : delay));
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
      const lastModifiedDB = (await getConversationMeta(currentConversation)).lastModified;
      if (lastModified.current[currentConversation] === lastModifiedDB) return; // No changes
      // Changes detected, load from DB
      setInitialized(false);
      const conversation = await loadConversation(navigate, conversationId, lastConversation, userSettings);
      if (!conversation) return;
      lastModified.current[currentConversation] = conversation?.lastModified || 0;
      setLocalState(conversation);
      console.log("Loaded updated conversation from browser");
    })();
  }, [isActive]);
}