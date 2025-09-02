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
  const userHasScrolledUp = useRef(false);
  const isAutoScrolling = useRef(false);
  const lastContentHeight = useRef(0);
  const scrollAnimationFrame = useRef(null);
  const contentObserver = useRef(null);
  const resizeObserver = useRef(null);

  // Check if container has actual overflow
  const hasOverflow = useCallback(() => {
    if (!containerRef.current) return false;
    const { scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight > clientHeight + 10; // 10px tolerance for rounding
  }, []);

  // Check if user is at bottom of chat
  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const threshold = 50; // Reasonable threshold for detection
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Update scroll button visibility
  const updateScrollButtonVisibility = useCallback(() => {
    const shouldShow = hasOverflow() && !checkIfAtBottom();
    setShowScrollButton(shouldShow);
    setIsAtBottom(checkIfAtBottom());
  }, [hasOverflow, checkIfAtBottom]);

  // Smooth auto-scroll with animation frame
  const performAutoScroll = useCallback(() => {
    if (!containerRef.current || userHasScrolledUp.current) return;

    const container = containerRef.current;
    const targetScroll = container.scrollHeight - container.clientHeight;
    const currentScroll = container.scrollTop;
    const distance = targetScroll - currentScroll;

    // If distance is small, just snap to bottom
    if (Math.abs(distance) < 5) {
      container.scrollTop = container.scrollHeight;
      isAutoScrolling.current = false;
      setShowScrollButton(false);
      return;
    }

    // Smooth scroll using animation frame
    const smoothScroll = () => {
      if (!containerRef.current || userHasScrolledUp.current) return;

      const current = containerRef.current.scrollTop;
      const target =
        containerRef.current.scrollHeight - containerRef.current.clientHeight;
      const diff = target - current;

      if (Math.abs(diff) > 1) {
        // Ease-out animation - slightly faster
        containerRef.current.scrollTop = current + diff * 0.15;
        scrollAnimationFrame.current = requestAnimationFrame(smoothScroll);
      } else {
        // Ensure we're absolutely at the bottom
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        isAutoScrolling.current = false;
        setShowScrollButton(false);
      }
    };

    isAutoScrolling.current = true;
    if (scrollAnimationFrame.current) {
      cancelAnimationFrame(scrollAnimationFrame.current);
    }
    smoothScroll();
  }, []);

  // Handle manual scroll to bottom button click
  const handleScrollButtonClick = useCallback(() => {
    if (!containerRef.current) return;

    // Reset flags immediately
    userHasScrolledUp.current = false;
    isAutoScrolling.current = true;

    // Directly set scroll to absolute bottom first
    containerRef.current.scrollTop = containerRef.current.scrollHeight;

    // Then apply smooth animation for visual feedback
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        isAutoScrolling.current = false;
        setShowScrollButton(false); // Immediately hide button
        updateScrollButtonVisibility();
      }
    }, 50);
  }, [updateScrollButtonVisibility]);

  // Handle user scroll events
  const handleScroll = useCallback(
    (e) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const isNearBottom = checkIfAtBottom();

      // Detect user scroll up (not during auto-scroll)
      if (!isAutoScrolling.current) {
        if (!isNearBottom && hasOverflow()) {
          userHasScrolledUp.current = true;
        } else if (isNearBottom) {
          userHasScrolledUp.current = false;
        }
      }

      updateScrollButtonVisibility();
    },
    [checkIfAtBottom, hasOverflow, updateScrollButtonVisibility]
  );

  // Handle wheel events for better scroll detection
  const handleWheel = useCallback(
    (e) => {
      if (!containerRef.current) return;

      // Cancel any ongoing auto-scroll animation
      if (scrollAnimationFrame.current) {
        cancelAnimationFrame(scrollAnimationFrame.current);
        scrollAnimationFrame.current = null;
      }

      // User is scrolling up
      if (e.deltaY < 0 && hasOverflow()) {
        userHasScrolledUp.current = true;
        isAutoScrolling.current = false;
      }
      // User is scrolling down to bottom
      else if (e.deltaY > 0) {
        const isNearBottom = checkIfAtBottom();
        if (isNearBottom) {
          userHasScrolledUp.current = false;
        }
      }

      // Update button visibility after a short delay
      setTimeout(updateScrollButtonVisibility, 100);
    },
    [hasOverflow, checkIfAtBottom, updateScrollButtonVisibility]
  );

  // Set up MutationObserver to watch for content changes
  useEffect(() => {
    if (!containerRef.current) return;

    // Disconnect previous observer
    if (contentObserver.current) {
      contentObserver.current.disconnect();
    }

    // Create new observer for content changes
    contentObserver.current = new MutationObserver((mutations) => {
      const container = containerRef.current;
      if (!container) return;

      const currentHeight = container.scrollHeight;

      // Check if content actually changed (increased or decreased)
      if (currentHeight !== lastContentHeight.current) {
        // Check if we were at bottom before the content change
        const wasAtBottom = checkIfAtBottom();

        // Auto-scroll if user hasn't scrolled up OR if we were already at bottom
        if (!userHasScrolledUp.current || wasAtBottom) {
          // If we were at bottom, ensure we stay at bottom (like when sending a new message)
          if (wasAtBottom) {
            userHasScrolledUp.current = false;
          }
          // Small delay to ensure DOM is fully updated
          requestAnimationFrame(() => {
            performAutoScroll();
          });
        }
        lastContentHeight.current = currentHeight;
      }

      // Update button visibility after DOM settles
      requestAnimationFrame(() => {
        updateScrollButtonVisibility();
      });
    });

    // Observe the container for changes
    contentObserver.current.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false,
    });

    return () => {
      if (contentObserver.current) {
        contentObserver.current.disconnect();
      }
      if (scrollAnimationFrame.current) {
        cancelAnimationFrame(scrollAnimationFrame.current);
      }
    };
  }, [performAutoScroll, updateScrollButtonVisibility]);

  // Set up ResizeObserver to handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
    }

    resizeObserver.current = new ResizeObserver(() => {
      updateScrollButtonVisibility();

      // If at bottom and container resized, maintain bottom position
      if (!userHasScrolledUp.current && containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });

    resizeObserver.current.observe(containerRef.current);

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, [updateScrollButtonVisibility]);

  // Set up scroll and wheel event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive listeners for better performance
    const options = { passive: true };

    container.addEventListener("scroll", handleScroll, options);
    container.addEventListener("wheel", handleWheel, options);

    // Initial check
    updateScrollButtonVisibility();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleScroll, handleWheel, updateScrollButtonVisibility]);

  // Reset state when conversation becomes empty
  useEffect(() => {
    if (emptyConversation) {
      setIsAtBottom(true);
      setShowScrollButton(false);
      userHasScrolledUp.current = false;
      isAutoScrolling.current = false;
      lastContentHeight.current = 0;

      if (scrollAnimationFrame.current) {
        cancelAnimationFrame(scrollAnimationFrame.current);
        scrollAnimationFrame.current = null;
      }
    }
  }, [emptyConversation]);

  // Handle copied state
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Handle new messages and maintain scroll position
  useEffect(() => {
    if (!localState?.messages || localState.messages.length <= 2) return;

    const messages = localState.messages.slice(0, -1);
    const lastMessage = messages[messages.length - 1];

    // Check if we're at bottom when a new user message appears
    if (lastMessage?.role === "user" && containerRef.current) {
      const wasAtBottom = checkIfAtBottom();
      if (wasAtBottom) {
        // Reset scroll flag when user sends a new message while at bottom
        userHasScrolledUp.current = false;
        // Force immediate scroll to accommodate new message
        setTimeout(() => {
          if (containerRef.current && !userHasScrolledUp.current) {
            performAutoScroll();
          }
        }, 10);
      }
    }

    // Force scroll to bottom when conversation starts (first real message)
    if (localState?.messages?.length === 3 && containerRef.current) {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
          userHasScrolledUp.current = false;
          updateScrollButtonVisibility();
        }
      }, 100);
    }
  }, [
    localState?.messages,
    checkIfAtBottom,
    performAutoScroll,
    updateScrollButtonVisibility,
  ]);

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
            className="p-1.5 flex flex-col gap-1.5 h-full overflow-y-auto scroll-smooth"
            style={{
              scrollPaddingBottom: "20px",
              WebkitOverflowScrolling: "touch",
              scrollBehavior: isAutoScrolling.current ? "auto" : "smooth",
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

          {/* Floating scroll to bottom button - only shows when there's actual overflow AND not at bottom */}
          {showScrollButton && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <button
                onClick={handleScrollButtonClick}
                aria-label="Scroll to bottom"
                className="cursor-pointer bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                         px-2 py-2 rounded-full shadow-lg hover:shadow-xl dark:shadow-dark
                         flex items-center justify-center gap-2 transition-all duration-200 
                         hover:scale-105 border border-gray-200 dark:border-gray-600
                         backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95
                         animate-pulse-subtle"
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
