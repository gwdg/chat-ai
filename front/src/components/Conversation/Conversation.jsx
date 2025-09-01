import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

// Hooks
import { selectShowSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import MessageUser from "./MessageUser/MessageUser";
import UndoButton from "./UndoButton";
import ClearMessagesButton from "./ClearMessagesButton";
import MessageAssistant from "./MessageAssistant/MessageAssistant";
import HallucinationWarning from "./HallucinationWarning";
import ModelSelector from "../Header/ModelSelector";
import Prompt from "../Prompt/Prompt";
import ModelSelectorWrapper from "../Header/ModelSelectorWrapper";
import WarningExternalModel from "../Header/WarningExternalModel";
import EmptyConversation from "./EmptyConversation";
import Motto from "./Motto";

export default function Conversation({
  localState,
  setLocalState,
  modelsData,
  userData,
}) {
  // Hooks
  const showSettings = useSelector(selectShowSettings);
  const [copied, setCopied] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const emptyConversation = Boolean(localState?.messages?.length <= 2);

  // Refs
  const containerRef = useRef(null);
  const previousMessageLength = useRef(0);
  const userHasScrolledUp = useRef(false);
  const autoScrollActive = useRef(false);
  const lastScrollTop = useRef(0);

  // Check if container has actual overflow
  const hasOverflow = useCallback(() => {
    if (!containerRef.current) return false;
    return (
      containerRef.current.scrollHeight > containerRef.current.clientHeight + 5
    ); // 5px tolerance
  }, []);

  // Check if user is at bottom of chat
  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
  }, []);

  // Direct scroll to bottom without animation
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
    userHasScrolledUp.current = false;
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const currentScrollTop = containerRef.current.scrollTop;

    // Detect if user is scrolling up (against auto-scroll)
    if (currentScrollTop < lastScrollTop.current - 5) {
      userHasScrolledUp.current = true;
      autoScrollActive.current = false;
    }

    lastScrollTop.current = currentScrollTop;

    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    // Reset flag if user scrolled back to bottom
    if (atBottom) {
      userHasScrolledUp.current = false;
    }

    // Update button visibility - ONLY show if there's overflow AND not at bottom
    const shouldShowButton = hasOverflow() && !atBottom;
    setShowScrollButton(shouldShowButton);
  }, [checkIfAtBottom, hasOverflow]);

  // Handle scroll button click
  const handleScrollButtonClick = useCallback(() => {
    userHasScrolledUp.current = false;
    autoScrollActive.current = true;
    scrollToBottom();
    setShowScrollButton(false);
  }, [scrollToBottom]);

  // Auto-scroll for new messages
  useEffect(() => {
    if (!localState?.messages || !containerRef.current) return;

    const messages = localState.messages.slice(0, -1);
    const currentLength = JSON.stringify(messages).length;

    if (currentLength !== previousMessageLength.current) {
      // Only auto-scroll if user hasn't scrolled up and there's overflow
      if (!userHasScrolledUp.current && hasOverflow()) {
        autoScrollActive.current = true;
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          if (autoScrollActive.current && !userHasScrolledUp.current) {
            scrollToBottom();
          }
        }, 10);
      }

      previousMessageLength.current = currentLength;
    }
  }, [localState?.messages, hasOverflow, scrollToBottom]);

  // Continuous scroll for streaming responses
  useEffect(() => {
    if (!localState?.messages) return;

    const messages = localState.messages.slice(0, -1);
    const lastMessage = messages[messages.length - 1];

    // Only set up interval for assistant messages
    if (lastMessage?.role === "assistant" && !userHasScrolledUp.current) {
      const interval = setInterval(() => {
        // Stop if user has scrolled up or no overflow
        if (
          userHasScrolledUp.current ||
          !hasOverflow() ||
          !containerRef.current
        ) {
          clearInterval(interval);
          return;
        }

        // Keep scrolling to bottom during streaming
        if (checkIfAtBottom()) {
          autoScrollActive.current = true;
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 50); // Very frequent updates for smooth streaming

      // Cleanup after 30 seconds
      const timeout = setTimeout(() => clearInterval(interval), 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [localState?.messages, checkIfAtBottom, hasOverflow]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add both passive scroll and active wheel listeners
    const scrollHandler = () => handleScroll();
    const wheelHandler = (e) => {
      // Detect manual wheel scroll
      if (e.deltaY < 0) {
        // Scrolling up
        userHasScrolledUp.current = true;
        autoScrollActive.current = false;
      }
      handleScroll();
    };

    container.addEventListener("scroll", scrollHandler, { passive: true });
    container.addEventListener("wheel", wheelHandler, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener("scroll", scrollHandler);
      container.removeEventListener("wheel", wheelHandler);
    };
  }, [handleScroll]);

  // Reset when conversation changes
  useEffect(() => {
    if (localState?.messages?.length <= 2) {
      setIsAtBottom(true);
      setShowScrollButton(false);
      previousMessageLength.current = 0;
      userHasScrolledUp.current = false;
      autoScrollActive.current = false;
      lastScrollTop.current = 0;
    }
  }, [localState?.messages?.length]);

  // Handle copied state
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div
      className={`w-full md:max-w-[85vw] xl:max-w-[1300px]
                  transition-[max-width] duration-300 ease-in-out motion-reduce:transition-none
                  mx-auto flex flex-col gap-2 relative min-h-0 h-full overflow-hidden
                  ${emptyConversation ? "justify-start" : "justify-between"}`}
    >
      {/* Model selector at top, on tablet and desktop */}
      <div className="hidden md:block">
        <ModelSelectorWrapper
          localState={localState}
          setLocalState={setLocalState}
          modelsData={modelsData}
        />
      </div>

      {/* Empty conversation */}
      <div
        className={`flex flex-col space-y-16 md:max-h-[40vh] xl:max-h-[40vh] justify-end
          ${emptyConversation ? "flex-grow" : "absolute pointer-events-none"}`}
      >
        <div
          className={`transition-all duration-500 ease-in-out p-10  
            ${
              emptyConversation
                ? "scale-100 opacity-80"
                : "scale-90 opacity-0 pointer-events-none"
            }`}
        >
          {emptyConversation && (
            <EmptyConversation localState={localState} userData={userData} />
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        className={`flex flex-col relative w-full rounded-xl
          bg-white dark:bg-bg_secondary_dark shadow-md dark:shadow-dark
          transition-opacity duration-500 ease-in-out
          ${
            localState.messages.length <= 2
              ? "max-h-0 opacity-0 scale-0 pointer-events-none overflow-hidden"
              : "scale-100 opacity-100 flex-1 min-h-0"
          }`}
      >
        <div className="flex justify-between">
          <HallucinationWarning />
        </div>

        {/* Scrollable messages container with floating button */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={containerRef}
            className="p-1.5 flex flex-col gap-1.5 h-full overflow-y-auto"
            style={{
              scrollPaddingBottom: "20px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {localState.messages.slice(0, -1)?.map((message, message_index) => (
              <div key={message_index}>
                {/* User message */}
                {message.role === "user" && (
                  <MessageUser
                    localState={localState}
                    setLocalState={setLocalState}
                    message_index={message_index}
                  />
                )}
                {/* Assistant message */}
                {message.role === "assistant" && (
                  <MessageAssistant
                    localState={localState}
                    setLocalState={setLocalState}
                    message_index={message_index}
                  />
                )}
                {/* Render info message */}
                {message.role === "info" && (
                  <div className="flex flex-col gap-1">
                    {message.content && (
                      <div className="text-sm font-bold text-tertiary p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl">
                        {message.content[0]?.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Floating scroll to bottom button - only shows when there's overflow AND not at bottom */}
          {showScrollButton && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <button
                onClick={handleScrollButtonClick}
                aria-label="Scroll to bottom"
                className="cursor-pointer bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                         px-2 py-2 rounded-full shadow-lg hover:shadow-xl dark:shadow-dark
                         flex items-center justify-center gap-2 transition-all duration-200 
                         hover:scale-105 border border-gray-200 dark:border-gray-600
                         backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Messages bottom panel */}
        {localState?.messages?.length >= 4 && (
          <div className="w-full select-none h-fit px-3 py-1.5 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
            <ClearMessagesButton
              localState={localState}
              setLocalState={setLocalState}
            />

            <div className="flex items-baseline gap-4">
              <UndoButton
                localState={localState}
                setLocalState={setLocalState}
              />
            </div>
          </div>
        )}
      </div>

      {/* Prompt area */}
      <Prompt localState={localState} setLocalState={setLocalState} />
      {emptyConversation && <Motto />}
    </div>
  );
}
