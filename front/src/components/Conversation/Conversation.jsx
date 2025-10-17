import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

// Hooks
import { selectShowSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import ModelSelectorWrapper from "../Header/ModelSelectorWrapper";
import Prompt from "../Prompt/Prompt";
import ClearMessagesButton from "./ClearMessagesButton";
import EmptyConversation from "./EmptyConversation";
import ExportButton from "./ExportButton";
import HallucinationWarning from "./HallucinationWarning";
import MessageAssistant from "./MessageAssistant/MessageAssistant";
import MessageUser from "./MessageUser/MessageUser";
import Motto from "./Motto";
import UndoButton from "./UndoButton";

export default function Conversation({
  localState,
  setLocalState,
  modelsData,
  userData,
}) {
  const showSettings = useSelector(selectShowSettings);

  // UI
  const [copied, setCopied] = useState(false);
  const emptyConversation = Boolean(localState?.messages?.length <= 2);

  // --- Core scroll state ---
  const [autoFollow, setAutoFollow] = useState(true); // << explicit follow switch
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const contentObserver = useRef(null);
  const resizeObserver = useRef(null);
  const programmaticGuardUntil = useRef(0); // ignore our own scrolls for a short window
  const smoothTimer = useRef(null);

  // Helpers
  const hasOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    return el.scrollHeight > el.clientHeight + 1;
  }, []);

  const checkIfAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const threshold = 8; // tight → no visible gap
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = containerRef.current;
    if (!el) return;
    const guardMs = behavior === "smooth" ? 400 : 60;
    programmaticGuardUntil.current = Date.now() + guardMs;
    el.scrollTo({ top: el.scrollHeight, behavior });
    clearTimeout(smoothTimer.current);
    smoothTimer.current = setTimeout(() => {
      // end guard after animation; isAtBottom will be updated by next events
    }, guardMs);
  }, []);

  // Arrow visibility: show only if overflow AND NOT at bottom
  const updateArrow = useCallback(() => {
    const shouldShow = hasOverflow() && !isAtBottom;
    setShowScrollButton((prev) => (prev !== shouldShow ? shouldShow : prev));
  }, [hasOverflow, isAtBottom]);

  // Track bottom state on scroll; disable follow only on real user scroll away
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Ignore programmatic scrolls
    if (Date.now() < programmaticGuardUntil.current) return;

    const atBottomNow = checkIfAtBottom();
    if (atBottomNow !== isAtBottom) setIsAtBottom(atBottomNow);

    // If the user moved away from bottom, stop following until arrow click
    if (!atBottomNow && autoFollow) setAutoFollow(false);

    // Arrow depends only on overflow & bottom state
    updateArrow();
  }, [checkIfAtBottom, isAtBottom, autoFollow, updateArrow]);

  // Wheel / touch just funnel to the same logic by triggering a visibility recompute
  const handleWheel = useCallback(() => updateArrow(), [updateArrow]);
  const handleTouchMove = useCallback(() => updateArrow(), [updateArrow]);

  // Observe DOM growth (streaming/resends). If autoFollow is ON, always snap to bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    contentObserver.current?.disconnect();

    let pending = false;
    contentObserver.current = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (autoFollow) {
          // use "auto" during streaming to avoid jitter
          scrollToBottom("auto");
        }
        // update bottom + arrow states after growth
        const atBottomNow = checkIfAtBottom();
        if (atBottomNow !== isAtBottom) setIsAtBottom(atBottomNow);
        updateArrow();
      });
    });

    // Only structural changes; avoid characterData spam
    contentObserver.current.observe(el, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false,
    });

    return () => contentObserver.current?.disconnect();
  }, [autoFollow, scrollToBottom, checkIfAtBottom, isAtBottom, updateArrow]);

  // Keep bottom on container resizes only if following
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    resizeObserver.current?.disconnect();
    resizeObserver.current = new ResizeObserver(() => {
      if (autoFollow) scrollToBottom("auto");
      const atBottomNow = checkIfAtBottom();
      if (atBottomNow !== isAtBottom) setIsAtBottom(atBottomNow);
      updateArrow();
    });
    resizeObserver.current.observe(el);

    return () => resizeObserver.current?.disconnect();
  }, [autoFollow, scrollToBottom, checkIfAtBottom, isAtBottom, updateArrow]);

  // Event listeners
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opt = { passive: true };
    el.addEventListener("scroll", handleScroll, opt);
    el.addEventListener("wheel", handleWheel, opt);
    el.addEventListener("touchmove", handleTouchMove, opt);

    // Initial states
    setIsAtBottom(checkIfAtBottom());
    updateArrow();

    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [
    handleScroll,
    handleWheel,
    handleTouchMove,
    checkIfAtBottom,
    updateArrow,
  ]);

  // Reset on empty
  useEffect(() => {
    if (emptyConversation) {
      setAutoFollow(true);
      setIsAtBottom(true);
      setShowScrollButton(false);
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [emptyConversation, scrollToBottom]);

  // “Copied” flash
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(t);
  }, [copied]);

  // Lifecycle nudges: first message / sending while at bottom
  useEffect(() => {
    const msgs = localState?.messages;
    if (!msgs || msgs.length <= 2) return;

    // First real message: start at bottom if following
    if (msgs.length === 3 && autoFollow) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      return;
    }

    // If a user message was added and we are following, stay at bottom
    const earlier = msgs.slice(0, -1);
    const last = earlier[earlier.length - 1];
    if (last?.role === "user" && autoFollow) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [localState?.messages, autoFollow, scrollToBottom]);

  // Down-arrow: explicitly re-enable following and smooth jump
  const handleScrollButtonClick = useCallback(() => {
    setAutoFollow(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));
    // After the smooth jump completes, bottom state/arrow will settle via handlers
  }, [scrollToBottom]);

  return (
    <div
      className={`w-full md:max-w-[85vw] xl:max-w-[1300px]
                  transition-[max-width] duration-300 ease-in-out motion-reduce:transition-none
                  mx-auto flex flex-col gap-2 relative min-h-0 h-full overflow-hidden
                  ${emptyConversation ? "justify-start" : "justify-between"}`}
    >
      {/* Model selector at top, on tablet and desktop */}
      <div className="model-selector hidden md:block">
        <ModelSelectorWrapper
          localState={localState}
          setLocalState={setLocalState}
          modelsData={modelsData}
        />
      </div>

      {/* Empty conversation */}
      <div
        className={`flex flex-col space-y-16 md:max-h-[40vh] xl:max_h-[40vh] justify-end
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
        {/* Hallucination Warning */}
        <HallucinationWarning />

        {/* Scrollable messages container */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={containerRef}
            className="p-1.5 flex flex-col gap-1.5 h-full overflow-y-auto"
            style={{
              scrollPaddingBottom: "20px",
              WebkitOverflowScrolling: "touch",
              // no scroll-smooth class and no inline scrollBehavior
            }}
          >
            {localState.messages.slice(0, -1)?.map((message, message_index) => (
              <div key={message_index}>
                {message.role === "user" && (
                  <MessageUser
                    localState={localState}
                    setLocalState={setLocalState}
                    message_index={message_index}
                  />
                )}
                {message.role === "assistant" && (
                  <MessageAssistant
                    localState={localState}
                    setLocalState={setLocalState}
                    message_index={message_index}
                  />
                )}
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

          {/* Floating scroll-to-bottom button (only when overflow && NOT at bottom) */}
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

        {/* Bottom panel */}
        {localState?.messages?.length >= 4 && (
          <div className="w-full select-none h-fit px-3 py-1.5 flex justify-between items-center bg-white dark:bg-bg_secondary_dark rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
            <ClearMessagesButton
              localState={localState}
              setLocalState={setLocalState}
            />
            <div className="flex items-baseline gap-4">
              <ExportButton
                localState={localState}
                setLocalState={setLocalState}
              />
              <UndoButton
                localState={localState}
                setLocalState={setLocalState}
              />
            </div>
          </div>
        )}
      </div>

      {/* Prompt */}
      <Prompt localState={localState} setLocalState={setLocalState} />
      {emptyConversation && <Motto />}
    </div>
  );
}