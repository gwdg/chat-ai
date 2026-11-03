import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { useDispatch, useSelector } from "react-redux";

import { featureGuides, getFeatureGuide } from "../config/featureGuides";
import { buildUseCaseGuide } from "../config/useCases";
import {
  markTutorialCompleted,
  markUseCaseCompleted,
  openSidebar,
  selectSuppressedTutorials,
} from "../Redux/reducers/interfaceSettingsSlice";

const FeatureGuideContext = createContext(null);

export function useFeatureGuide() {
  const context = useContext(FeatureGuideContext);
  if (!context) {
    throw new Error("useFeatureGuide must be used inside FeatureGuideProvider");
  }
  return context;
}

function Cursor({ x, y }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[2147483646] transition-transform duration-500 ease-out motion-reduce:transition-none"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 2L20 12L12.5 13.5L9 21L4 2Z"
          fill="#009EE0"
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function isVisible(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  let node = element;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
    node = node.parentElement;
  }

  return true;
}

export function FeatureGuideProvider({ children }) {
  const dispatch = useDispatch();
  const suppressedTutorials = useSelector(selectSuppressedTutorials);
  const location = useLocation();
  const [active, setActive] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [stepComplete, setStepComplete] = useState(true);
  const [stepWasIncompleteAtStart, setStepWasIncompleteAtStart] =
    useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const targetRef = useRef(null);
  const enabled = location.pathname === "/meta";

  const guide = active?.guide ?? (active ? getFeatureGuide(active.id) : null);
  const step = guide?.steps?.[active?.step] ?? null;
  const total = guide?.steps?.length ?? 0;
  const stepGated = Boolean(
    step?.check || step?.completeOnEvent || step?.completeOnTargetClick,
  );
  const guideIsActive = Boolean(active) || Boolean(completion);

  useEffect(() => {
    if (guideIsActive) dispatch(openSidebar());
  }, [guideIsActive, dispatch]);

  const closeGuide = useCallback(() => {
    setActive(null);
    setCompletion(null);
    setTargetRect(null);
  }, []);

  const startGuide = useCallback(
    (featureId) => {
      if (!enabled || !featureGuides[featureId]) return;
      setCompletion(null);
      setTargetRect(null);
      setCursor({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      setActive({ id: featureId, step: 0 });
    },
    [enabled],
  );

  const startCustomGuide = useCallback(
    (customGuide) => {
      if (!enabled || !customGuide?.steps?.length) return;
      setCompletion(null);
      setTargetRect(null);
      setCursor({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      setActive({
        id: customGuide.id,
        step: 0,
        guide: customGuide,
      });
    },
    [enabled],
  );

  const nextStep = useCallback(() => {
    if (!active) return;
    const currentGuide =
      active.guide ?? getFeatureGuide(active.id);
    setTargetRect(null);
    const next = active.step + 1;
    if (!currentGuide || next >= currentGuide.steps.length) {
      if (active.guide) {
        const prefix = "use_case:";
        if (active.id.startsWith(prefix)) {
          dispatch(markUseCaseCompleted(active.id.slice(prefix.length)));
        }
      } else {
        dispatch(markTutorialCompleted(active.id));
      }
      setActive(null);
      setCompletion({
        guideId: active.id,
        guide: active.guide ?? null,
        isUseCase: Boolean(active.guide),
      });
      return;
    }
    setActive({ ...active, step: next });
  }, [active, dispatch]);

  const previousStep = useCallback(() => {
    setTargetRect(null);
    setActive((current) => {
      if (!current || current.step === 0) return current;
      return { ...current, step: current.step - 1 };
    });
  }, []);

  useEffect(() => {
    if (!active && !completion) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeGuide();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, completion, closeGuide]);

  useEffect(() => {
    if (!enabled) return;

    const handleStart = (event) => {
      const featureId = event.detail?.featureId;
      if (!featureId || suppressedTutorials.includes(featureId)) return;
      startGuide(featureId);
    };

    window.addEventListener("chatai:start-feature-guide", handleStart);
    return () =>
      window.removeEventListener("chatai:start-feature-guide", handleStart);
  }, [enabled, startGuide, suppressedTutorials]);

  useEffect(() => {
    if (!enabled) return;

    const handleStartUseCase = (event) => {
      const useCaseId = event.detail?.useCaseId;
      const guide = buildUseCaseGuide(useCaseId);
      if (!guide) return;
      startCustomGuide(guide);
    };

    window.addEventListener("chatai:start-use-case", handleStartUseCase);
    return () =>
      window.removeEventListener("chatai:start-use-case", handleStartUseCase);
  }, [enabled, startCustomGuide]);

  useEffect(() => {
    if (!active) return;

    const stopOutsideClose = (event) => {
      if (event.target?.closest?.("[data-guide-keep-open]")) {
        event.stopPropagation();
      }
    };

    window.addEventListener("pointerdown", stopOutsideClose, true);
    window.addEventListener("mousedown", stopOutsideClose, true);
    window.addEventListener("touchstart", stopOutsideClose, true);

    return () => {
      window.removeEventListener("pointerdown", stopOutsideClose, true);
      window.removeEventListener("mousedown", stopOutsideClose, true);
      window.removeEventListener("touchstart", stopOutsideClose, true);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !step) {
      setStepComplete(true);
      setStepWasIncompleteAtStart(false);
      return;
    }

    if (!stepGated) {
      setStepComplete(true);
      setStepWasIncompleteAtStart(false);
      return;
    }

    let initial = false;
    if (typeof step.check === "function") {
      try {
        initial = Boolean(step.check());
      } catch {
        initial = false;
      }
    }
    setStepComplete(initial);
    setStepWasIncompleteAtStart(!initial);
  }, [active?.id, active?.step, step, stepGated]);

  useEffect(() => {
    if (!active || typeof step?.check !== "function") return;

    const run = () => {
      let done = false;
      try {
        done = Boolean(step.check());
      } catch {
        done = false;
      }
      setStepComplete(done);
    };

    run();
    const interval = window.setInterval(run, 300);
    return () => window.clearInterval(interval);
  }, [active?.id, active?.step, step]);

  useEffect(() => {
    if (!active || !step?.completeOnEvent) return;

    const handler = () => setStepComplete(true);
    const eventName = `chatai:${step.completeOnEvent}`;
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [active?.id, active?.step, step]);

  useEffect(() => {
    if (!active || !step?.completeOnTargetClick) return;

    const handler = (event) => {
      const target = targetRef.current;
      if (
        target &&
        (target === event.target || target.contains(event.target))
      ) {
        setStepComplete(true);
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [active?.id, active?.step, step]);

  useEffect(() => {
    if (
      !active ||
      !step ||
      !stepGated ||
      !stepComplete ||
      !stepWasIncompleteAtStart
    ) {
      return;
    }

    const timer = window.setTimeout(() => nextStep(), 650);
    return () => window.clearTimeout(timer);
  }, [
    active?.id,
    active?.step,
    step,
    stepGated,
    stepComplete,
    stepWasIncompleteAtStart,
    nextStep,
  ]);

  useEffect(() => {
    if (!active || !step) {
      setTargetRect(null);
      return;
    }

    targetRef.current = null;

    if (typeof step.prepare === "function") {
      try {
        step.prepare();
      } catch {
        // The guide still works without the optional shortcut.
      }
    }

    const selectors = Array.isArray(step.target)
      ? step.target
      : [step.target];
    let cancelled = false;
    let currentTarget = null;

    const findTarget = () =>
      selectors
        .flatMap((selector) =>
          Array.from(document.querySelectorAll(selector)),
        )
        .find(isVisible);

    const measure = () => {
      if (cancelled) return;
      const target = findTarget();
      if (!target) {
        if (currentTarget) {
          currentTarget = null;
          targetRef.current = null;
          setTargetRect(null);
        }
        return;
      }
      targetRef.current = target;
      if (target !== currentTarget) {
        currentTarget = target;
        try {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        } catch {
          target.scrollIntoView();
        }
      }
      const rect = target.getBoundingClientRect();
      const nextRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
      setTargetRect((prev) =>
        prev &&
        prev.left === nextRect.left &&
        prev.top === nextRect.top &&
        prev.width === nextRect.width &&
        prev.height === nextRect.height
          ? prev
          : nextRect,
      );
      const nextCursor = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setCursor((prev) =>
        prev.x === nextCursor.x && prev.y === nextCursor.y
          ? prev
          : nextCursor,
      );
    };

    measure();
    const timers = [100, 250, 450, 700].map((delay) =>
      window.setTimeout(measure, delay),
    );
    const interval = window.setInterval(measure, 400);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(measure);
      const initialTarget = findTarget();
      if (initialTarget) resizeObserver.observe(initialTarget);
    }

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      resizeObserver?.disconnect();
    };
  }, [active, step]);

  const completionGuide = completion
    ? completion.guide ?? getFeatureGuide(completion.guideId)
    : null;
  const contextValue = useMemo(
    () => ({
      startGuide,
      startCustomGuide,
      closeGuide,
      enabled,
      isActive: Boolean(active),
      activeGuide: guide,
      activeStep: step,
      stepIndex: active?.step ?? null,
      stepCount: total,
      stepComplete,
      stepGated,
      nextStep,
      previousStep,
      completion,
      completionGuide,
    }),
    [
      startGuide,
      startCustomGuide,
      closeGuide,
      enabled,
      active,
      guide,
      step,
      total,
      stepComplete,
      stepGated,
      nextStep,
      previousStep,
      completion,
      completionGuide,
    ],
  );

  return (
    <FeatureGuideContext.Provider value={contextValue}>
      {children}
      {active &&
        step &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {targetRect && (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-[2147483644] rounded-xl outline outline-2 outline-accent transition-all duration-300 motion-reduce:transition-none"
                style={{
                  left: targetRect.left - 6,
                  top: targetRect.top - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                  boxShadow: "0 0 0 6px rgba(0, 158, 224, 0.18)",
                }}
              />
            )}

            <Cursor x={cursor.x} y={cursor.y} />
          </>,
          document.body,
        )}
    </FeatureGuideContext.Provider>
  );
}
