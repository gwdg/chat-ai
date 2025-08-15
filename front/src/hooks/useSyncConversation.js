import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getConversation, createConversation, updateConversation, listConversationMetas} from "../db";
import { getDefaultConversation } from "../utils/conversationUtils";

import {
    selectCurrentConversationId,
} from "../Redux/reducers/conversationsSlice";

export function useSyncConversation({
  localState,
  setLocalState,
  conversationId,
}) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const currentConversationId = useSelector(selectCurrentConversationId);

    // State if tab is active or not
    const [isActive, setIsActive] = useState(false);

    // Navigate to saved conversation ID if not provided in URL
    if (!conversationId) {
        navigate(`/chat/${currentConversationId}`);
    }

    // Effect 0: Reset means we need to find any valid conversation
    useEffect(() => {
        if (conversationId === 'reset') {
            // Find another conversation if coming from NotFound
            async function fallbackConversation() {
                const conversationMetas = await listConversationMetas();
                if (conversationMetas.length === 0) {
                    const id = await createConversation(getDefaultConversation());
                    navigate(`/chat/${id}`);
                    return;
                }
                navigate(`/chat/${conversationMetas[0].id}`);
            }
            fallbackConversation();
        }
    }, [navigate]);

    // Effect 1: Loads conversation from DB into localState when currentConversationId changes
    useEffect(() => {
        // If not valid uuid4
        const isValidUUIDv4 = (id) => {
            return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id
            );
        };
        if (!isValidUUIDv4(currentConversationId)) return;
        async function loadConversation() {
            try {

                const currentConversation = await getConversation(currentConversationId);
                console.log("Loaded conversation, ", currentConversation.id);
                // assert conversation exists throw error
                if (!currentConversation) {
                    throw new Error("Conversation not found");
                }
                setLocalState(currentConversation);
            } catch (error) {
                console.error("Error loading conversation: ", error);
                navigate(`/notfound`);
            }
        }
        loadConversation();
    }, [currentConversationId]);

    // Effect 2: Debounced auto-save of conversation changes into DB
    const timeoutIds = useRef({});
    const delay = 1000;
    useEffect(() =>  {
        // Only auto-save when tab is active
        if (!isActive) return;
        // Clear any scheduled save for this conversation only
        if (timeoutIds.current[currentConversationId]) {
        clearTimeout(timeoutIds.current[currentConversationId]);
        }
        // Schedule a save after `delay` ms
        timeoutIds.current[currentConversationId] = setTimeout(() => {
            updateConversation(
                currentConversationId,
                localState
            )
            delete timeoutIds.current[currentConversationId];
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