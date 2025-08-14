import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { 
    updateConversation,
    selectCurrentConversationId,
    selectCurrentConversation
} from "../Redux/reducers/conversationsSlice";

export function useSyncConversation({
  localState,
  setLocalState
}) {
    const dispatch = useDispatch();

    const currentConversationId = useSelector(selectCurrentConversationId);
    const currentConversation = useSelector(selectCurrentConversation);
    // Effect 1: Initializes local state when conversation ID changes
    useEffect(() => {
        // Only proceed if both conversationId and currentConversation exist
        if (currentConversationId && currentConversation) {
        // Initialize local state with all conversation data
        setLocalState(currentConversation);
        }
    }, [currentConversationId]);

    // Listen for tab visibility changes
    const [isActive, setIsActive] = useState(false);
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

    // Effect 2: Debounced auto-save of conversation changes
    const timeoutIds = useRef({}); 
    const delay = 1000;
    useEffect(() => {
        // Only auto-save when tab is active
        if (!isActive) return;
        // Clear any scheduled save for this conversation only
        if (timeoutIds.current[currentConversationId]) {
        clearTimeout(timeoutIds.current[currentConversationId]);
        }
        // Schedule a save after `delay` ms
        timeoutIds.current[currentConversationId] = setTimeout(() => {
        dispatch(
            updateConversation({
            id: currentConversationId,
            updates: { ...localState }
            })
        );
        // Remove the timeout ID after it runs
        delete timeoutIds.current[currentConversationId];
        }, delay);
    }, [localState, isActive, delay, dispatch]); 
}