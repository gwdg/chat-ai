import { useCallback, useEffect, useRef, useState } from "react";

// Hooks
import MessageUser from "./MessageUser";
import ExportConversationButton from "./ExportConversationButton";
import ImportConversationButton from "./ImportConversationButton";
import UndoButton from "./UndoButton";
import ClearHistoryButton from "./ClearHistoryButton";
import MessageAssistant from "./MessageAssistant/MessageAssistant";

export default function Conversation({
  modelsData,
  localState,
  setLocalState,
}) {
  // Hooks
 
  const [copied, setCopied] = useState(false);;
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  // New state for scroll management
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  //Refs
  const containerRefs = useRef([]);

  const containerRef = useRef(null);
  const scrollTimeout = useRef(null);
  const lastResponseLength = useRef(0);
  const lastScrollTop = useRef(0);
  const autoScrollTimeout = useRef(null);

  // const handleResponseSave = (index) => {
  //   // Find assistant response index in conversation array
  //   const assistantIndex = localState.messages.findIndex(
  //     (msg) =>
  //       msg.role === "assistant" &&
  //       msg.content === localState.responses[index].response
  //   );

  //   // Update both responses and conversation
  //   const newResponses = localState.responses.map((res, i) => {
  //     if (i === index) {
  //       return { ...res, response: editedResponse };
  //     }
  //     return res;
  //   });

  //   const newMessages = localState.messages.map((msg, i) => {
  //     if (i === assistantIndex) {
  //       return { ...msg, content: editedResponse };
  //     }
  //     return msg;
  //   });

  //   setLocalState({
  //     ...localState,
  //     responses: newResponses,
  //     messages: newMessages,
  //   });

  //   setEditingResponseIndex(-1);
  //   setEditedResponse("");
  // };

  // Enhanced scroll to bottom function
  const scrollToBottom = useCallback(
    (forceSmooth = false, isUserInitiated = false) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

      // If user initiated, always scroll and update state
      if (isUserInitiated) {
        setUserScrolledUp(false);
        setIsAutoScrolling(true);

        container.scrollTo({
          top: scrollHeight,
          behavior: "smooth",
        });

        // Clear auto-scrolling flag after animation
        if (autoScrollTimeout.current) {
          clearTimeout(autoScrollTimeout.current);
        }
        autoScrollTimeout.current = setTimeout(() => {
          setIsAutoScrolling(false);
        }, 1000);
        return;
      }

      // For auto-scroll, only proceed if user hasn't scrolled up
      if (!userScrolledUp) {
        const behavior =
          forceSmooth || distanceFromBottom < 500 ? "smooth" : "auto";

        setIsAutoScrolling(true);
        container.scrollTo({
          top: scrollHeight,
          behavior,
        });

        // Clear auto-scrolling flag
        if (autoScrollTimeout.current) {
          clearTimeout(autoScrollTimeout.current);
        }
        autoScrollTimeout.current = setTimeout(
          () => {
            setIsAutoScrolling(false);
          },
          behavior === "smooth" ? 1000 : 100
        );
      }
    },
    [userScrolledUp]
  );

  // Enhanced scroll handler that detects user intent
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    scrollTimeout.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) {return;}
      const { scrollTop, scrollHeight, clientHeight } = container;

      // More sensitive scroll direction detection (only when not auto-scrolling)
      if (!isAutoScrolling) {
        const scrolledUp = scrollTop < lastScrollTop.current - 5; // Add threshold
        const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 20; // Increase threshold

        // Update user scroll state with better logic
        if (scrolledUp) {
          setUserScrolledUp(true);
        } else if (isAtBottom) {
          setUserScrolledUp(false);
        }
      }

      // Better scroll button visibility logic (always update regardless of auto-scrolling)
      const hasOverflow = scrollHeight > clientHeight + 10;
      const scrolledFromBottom = scrollHeight - (scrollTop + clientHeight);
      setShowScrollButton(hasOverflow && scrolledFromBottom > 150); // Show when above 150px threshold

      lastScrollTop.current = scrollTop;
    }, 16); // Reduce to ~60fps for smoother detection
  }, []); // Remove isAutoScrolling dependency

  // Click handler for scroll button
  const handleScrollButtonClick = useCallback(() => {
    scrollToBottom(true, true); // force smooth scroll, user initiated
  }, [scrollToBottom]);

  function formatFileSize(bytes) {
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    // Keep dividing by 1024 until we reach the appropriate unit
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Return formatted string with 2 decimal places and unit
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Utility function to convert base64 image data to file-like objects
  const convertBase64ArrayToImageList = (base64Array) => {
    const imageFileList = base64Array.map((item, index) => {
      if (
        item.type === "image_url" &&
        item.image_url.url.startsWith("data:image")
      ) {
        const base64Data = item.image_url.url;
        const fileName = `image_${index + 1}`;
        const fileSize = atob(base64Data.split(",")[1]).length;

        return {
          name: fileName,
          type: "image",
          size: fileSize,
          text: base64Data,
        };
      }
      return null;
    });

    return imageFileList.filter(Boolean);
  };

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => {
      setCopied(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [copied]);

  // Enhanced effect for auto-scrolling with user intent detection
  useEffect(() => {
    if (!containerRef.current || !localState.responses) return;

    const currentLength = localState.responses.length;
    const lastResponse = localState.responses[currentLength - 1];

    // Only auto-scroll if user hasn't manually scrolled up
    if (!userScrolledUp) {
      // For new responses
      if (currentLength > lastResponseLength.current) {
        scrollToBottom(true); // smooth scroll for new responses
      }
      // For updating responses, check if user is near bottom
      else if (lastResponse?.response && (loading || loadingResend)) {
        const container = containerRef.current;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

        // Only auto-scroll if very close to bottom
        if (distanceFromBottom < 50) {
          scrollToBottom(false); // instant scroll for updates
        }
      }
    }

    lastResponseLength.current = currentLength;
  }, [
    localState.responses,
    loading,
    scrollToBottom,
    loadingResend,
    userScrolledUp,
  ]);

  useEffect(() => {
    handleScroll();
  }, [localState.responses, handleScroll]);

  // Cleanup and event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Initial check
      handleScroll();

      // Use passive listeners for better scroll performance
      container.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleScroll, { passive: true });

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }
        if (autoScrollTimeout.current) {
          clearTimeout(autoScrollTimeout.current);
        }
      };
    }
  }, [handleScroll]);

  // useEffect(() => {
  //   const handleClickOutside = (event) => {
  //     if (
  //       containerRef.current &&
  //       !containerRef.current.contains(event.target)
  //     ) {
  //       setEditingIndex(-1);
  //       setEditingResponseIndex(-1);
  //       setIsEditing(false);
  //     }
  //   };

  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => document.removeEventListener("mousedown", handleClickOutside);
  // }, []);

  // Add this new effect after your existing useEffects
  useEffect(() => {
    // Reset scroll state when conversation changes significantly
    if (localState?.messages?.length === 2) {
      setUserScrolledUp(false);
      setShowScrollButton(false);
    }
  }, [localState?.messages?.length]);

  useEffect(() => {
    if (localState?.messages?.length > 2 && containerRef.current) {
      const container = containerRef.current;
      const hasOverflow = container.scrollHeight > container.clientHeight;
      if (hasOverflow) {
        setShowScrollButton(true);
      }
    }
  }, [localState?.responses?.length]);

  // Add this new useEffect after your existing ones
  useEffect(() => {
    // Ensure scroll button shows when user scrolls up during loading
    if ((loading || loadingResend) && userScrolledUp && containerRef.current) {
      const container = containerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const hasOverflow = scrollHeight > clientHeight + 10;
      const scrolledFromBottom = scrollHeight - (scrollTop + clientHeight);

      if (hasOverflow && scrolledFromBottom > 150) {
        setShowScrollButton(true);
      }
    }
  }, [loading, loadingResend, userScrolledUp]);

  return (
    <>
      <div
        ref={containerRef}
        className="p-1.5 flex flex-col gap-1.5 overflow-y-auto flex-1 relative"
      >
        {localState.messages.slice(0, -1)?.map((msg, index) => (
          <>
            {/* User message */}
            {(msg.role === "user") && (
              <MessageUser
                msg={msg}
                index={index}
                containerRefs={containerRefs}
                loading={loading}
                loadingResend={loadingResend}
              />
            )}
            {/* Assistant message */}
            {(msg.role === "assistant") && (
              <MessageAssistant
                msg={msg}
                index={index}
                containerRefs={containerRefs}
                loading={loading}
                loadingResend={loadingResend}
              />
            )}
            {/* Render info message */}
            {msg.role === "info" && (
              <div key={index} className="flex flex-col gap-1">
                {msg.content && (
                  <div className="text-xs font-bold text-tertiary p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {msg.content?.data}
                  </div>
                )}
              </div>
            )}
          </>
        ))}
      </div>

      {localState?.messages?.length <= 2 ? (
        // Empty conversation
          <ImportConversationButton
            localState={localState}
            setLocalState={setLocalState}
          />
      ) : (
        // Non-empty conversation
        <div className="w-full bottom-0 sticky select-none h-fit px-3 py-1.5 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-xl">
          {/* Export conversation button */}
            <ClearHistoryButton
              localState={localState}
              setLocalState={setLocalState}
            />
          {showScrollButton && (
            // Scroll to top button
            <button
              onClick={handleScrollButtonClick}
              aria-label="Scroll to bottom"
              className="text-tertiary max-w-[130px] w-full p-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <p className="text-xs">Scroll to bottom</p>
            </button>
          )}
          <div className="flex items-baseline gap-4">
            {/* Export conversation button */}
            <ExportConversationButton
              localState={localState}
              setLocalState={setLocalState}
            />
            {/* Import conversation button */}
            <ImportConversationButton
              localState={localState}
              setLocalState={setLocalState}
            />
            {/* Undo button */}
            <UndoButton
              localState={localState}
              setLocalState={setLocalState}
            />
          </div>
        </div>
      )}
    </>
  );
}