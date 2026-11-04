import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { ChevronDown, ChevronUp } from "lucide-react";

// Hooks
import { selectShowSettings } from "../../Redux/reducers/interfaceSettingsSlice";
import Prompt from "../Prompt/Prompt";
import EmptyConversation from "./EmptyConversation";
import HallucinationWarning from "./HallucinationWarning";
import MessageAssistant from "./MessageAssistant/MessageAssistant";
import MessageUser from "./MessageUser/MessageUser";
import Motto from "./Motto";
import UndoButton from "./UndoButton";
import Tooltip from "../Others/Tooltip";
import CloseChatButton from "./CloseChatButton";

export default function Conversation({
  localState,
  setLocalState,
  modelsData,
  userData,
}) {
  const showSettings = useSelector(selectShowSettings);
  const { t } = useTranslation();

  // UI
  const [copied, setCopied] = useState(false);
  const emptyConversation = Boolean(localState?.messages?.length <= 2);

  // --- Core scroll state ---
  const [autoFollow, setAutoFollow] = useState(true); // << explicit follow switch
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showTopScrollButtons, setShowTopScrollButtons] = useState(false);
  const [showCloseButton, setShowCloseButton] = useState(true);

  // Refs
  const containerRef = useRef(null);
  const messageRefs = useRef({});
  const contentObserver = useRef(null);
  const resizeObserver = useRef(null);
  const programmaticGuardUntil = useRef(0); // ignore our own scrolls for a short window
  const smoothTimer = useRef(null);
  const jumpTimer = useRef(null);

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

  const updateArrow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const overflow = hasOverflow();
    const atBottom = checkIfAtBottom();
    setIsAtBottom((prev) => (prev !== atBottom ? atBottom : prev));

    const shouldShowBottom = overflow && !atBottom;
    setShowScrollButton((prev) =>
      prev !== shouldShowBottom ? shouldShowBottom : prev
    );

    const containerTop = el.getBoundingClientRect().top;
    const shouldShowTop = overflow && el.scrollTop > 8;
    setShowTopScrollButtons((prev) =>
      prev !== shouldShowTop ? shouldShowTop : prev
    );

    const firstMessage = Object.keys(messageRefs.current)
      .map(Number)
      .sort((a, b) => a - b)
      .map((index) => messageRefs.current[index])
      .find((element) => element && element.getBoundingClientRect().height > 0);
    const isOnFirstMessage =
      !firstMessage ||
      firstMessage.getBoundingClientRect().bottom > containerTop + 8;
    setShowCloseButton((prev) =>
      prev !== isOnFirstMessage ? isOnFirstMessage : prev
    );
  }, [checkIfAtBottom, hasOverflow]);

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

  const scrollElementToTop = useCallback(
    (element) => {
      const el = containerRef.current;
      if (!el || !element) return;

      setAutoFollow(false);
      setShowScrollButton(hasOverflow());

      const guardMs = 400;
      programmaticGuardUntil.current = Date.now() + guardMs;

      const containerRect = el.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const targetTop = Math.max(
        0,
        el.scrollTop + elementRect.top - containerRect.top
      );
      el.scrollTo({ top: targetTop, behavior: "smooth" });

      clearTimeout(jumpTimer.current);
      jumpTimer.current = setTimeout(updateArrow, guardMs + 50);
    },
    [hasOverflow, updateArrow]
  );

  const scrollToTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    setAutoFollow(false);
    setShowScrollButton(hasOverflow());

    const guardMs = 400;
    programmaticGuardUntil.current = Date.now() + guardMs;
    el.scrollTo({ top: 0, behavior: "smooth" });

    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(updateArrow, guardMs + 50);
  }, [hasOverflow, updateArrow]);

  const handlePreviousMessage = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const containerTop = el.getBoundingClientRect().top;
    let previousElement = null;
    let previousTop = -Infinity;

    Object.keys(messageRefs.current).forEach((key) => {
      const element = messageRefs.current[key];
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.height === 0) return;
      if (rect.top < containerTop - 8 && rect.top > previousTop) {
        previousTop = rect.top;
        previousElement = element;
      }
    });

    if (previousElement) {
      scrollElementToTop(previousElement);
      return;
    }

    scrollToTop();
  }, [scrollElementToTop, scrollToTop]);

  const handleNextMessage = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const containerTop = el.getBoundingClientRect().top;
    let nextElement = null;
    let nextTop = Infinity;

    Object.keys(messageRefs.current).forEach((key) => {
      const element = messageRefs.current[key];
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.height === 0) return;
      if (rect.top > containerTop + 8 && rect.top < nextTop) {
        nextTop = rect.top;
        nextElement = element;
      }
    });

    if (nextElement) {
      scrollElementToTop(nextElement);
      return;
    }

    setAutoFollow(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));
    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(updateArrow, 450);
  }, [scrollElementToTop, scrollToBottom, updateArrow]);

  useEffect(() => () => clearTimeout(jumpTimer.current), []);

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
      className={`w-full flex flex-col gap-2 relative min-h-0 h-full overflow-hidden
                  ${emptyConversation ? "justify-start" : "justify-between"}`}
    >
      {showCloseButton && (
        <CloseChatButton localState={localState} setLocalState={setLocalState} />
      )}

      {/* Empty conversation */}
      <div
        className={`flex flex-col space-y-16 md:max-h-[45vh] xl:max_h-[45vh] justify-end
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
        className={`flex flex-col relative w-full
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
          <div ref={containerRef}
            className="h-full overflow-y-auto"
            style={{
                scrollPaddingBottom: "20px",
                WebkitOverflowScrolling: "touch",
                // no scroll-smooth class and no inline scrollBehavior
              }}
          >
          <div
            className="p-1.5 flex flex-col gap-1.5 h-full md:max-w-[85vw] xl:max-w-[1300px] transition-[max-width] duration-300 ease-in-out motion-reduce:transition-none mx-auto"
          >
            {localState.messages.slice(0, -1)?.map((message, message_index) => (
              <div
                key={message_index}
                className="flex flex-col"
                ref={(node) => {
                  messageRefs.current[message_index] = node;
                }}
              >
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
                      <div className="text-sm font-bold text-accent p-1.5 bg-base-200 rounded-2xl">
                        {message.content[0]?.text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>

          {/* Floating previous-message / scroll-to-top buttons */}
          {showTopScrollButtons && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
              <Tooltip text={t("common.previous_message")}>
                <button
                  onClick={handlePreviousMessage}
                  aria-label={t("common.previous_message")}
                  className="btn btn-circle shadow-lg"
                >
                  <ChevronUp className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip text={t("common.scroll_to_top")}>
                <button
                  onClick={scrollToTop}
                  aria-label={t("common.scroll_to_top")}
                  className="btn btn-circle shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        <div
          className="relative px-1.5 flex flex-col w-full max-h-0 md:max-w-[85vw] xl:max-w-[1300px] mx-auto"
        >
        {/* Floating next-message / scroll-to-bottom buttons */}
          {showScrollButton && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
              <Tooltip text={t("common.next_message")}>
                <button
                  onClick={handleNextMessage}
                  aria-label={t("common.next_message")}
                  className="btn btn-circle shadow-lg"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </Tooltip>
              <Tooltip text={t("common.scroll")}>
                <button
                  onClick={handleScrollButtonClick}
                  aria-label="Scroll to bottom"
                  className="btn btn-circle shadow-lg"
                >
                  <svg
                    className="w-5 h-5"
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
              </Tooltip>
            </div>
          )}
          {/* Floating button - bottom right above the prompt box */}
          {localState?.messages?.length >= 4 && (
              <div className="absolute bottom-3 right-5 md:right-3 z-10 flex items-end">
                {/* Undo Button */}
                <UndoButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
              </div>
          )}
        </div>
      </div>

      {/* Prompt */}
      <Prompt
        localState={localState}
        setLocalState={setLocalState}
        userData={userData}
        modelsData={modelsData}
      />
      {emptyConversation && <Motto />}
    </div>
  );
}