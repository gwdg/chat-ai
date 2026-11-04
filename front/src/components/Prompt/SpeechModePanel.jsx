import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AudioLines, RotateCw, Send, X, Square } from "lucide-react";

import { SPEECH_PHASE } from "../../hooks/useSpeechSession";

const PHASE_COPY = {
  [SPEECH_PHASE.LISTENING]: {
    status: "speech_mode_listening",
    hint: "speech_mode_hint_listening",
  },
  [SPEECH_PHASE.CAPTURING]: {
    status: "speech_mode_capturing",
    hint: "speech_mode_hint_capturing",
  },
  [SPEECH_PHASE.THINKING]: {
    status: "speech_mode_thinking",
    hint: "speech_mode_hint_interrupt",
  },
  [SPEECH_PHASE.SPEAKING]: {
    status: "speech_mode_speaking",
    hint: "speech_mode_hint_interrupt",
  },
  [SPEECH_PHASE.ERROR]: {
    status: "speech_mode_error",
    hint: "speech_mode_hint_error",
  },
};

const ERROR_KEYS = {
  insecure_context: "speech_mode_error_insecure",
  permission_denied: "speech_mode_error_permission",
  microphone_not_found: "speech_mode_error_no_microphone",
  microphone_unavailable: "speech_mode_error_microphone",
  audio_context_unavailable: "speech_mode_error_microphone",
  response_timeout: "speech_mode_error_timeout",
  conversation_unavailable: "speech_mode_error_conversation",
};

function Waveform({ level, phase }) {
  const canvasRef = useRef(null);
  const levelRef = useRef(level);
  const phaseRef = useRef(phase);

  useEffect(() => {
    levelRef.current = level;
    phaseRef.current = phase;
  }, [level, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    let frame = null;
    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let palette = ["#009ee0", "#b4388d", "#695ea2"];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const styles = getComputedStyle(canvas);
      palette = [
        styles.getPropertyValue("--color-accent")?.trim() || "#009ee0",
        styles.getPropertyValue("--color-primary")?.trim() || "#b4388d",
        styles.getPropertyValue("--color-secondary")?.trim() || "#695ea2",
      ];
    };

    const draw = (time) => {
      if (disposed) return;
      context.clearRect(0, 0, width, height);
      const activePhase = phaseRef.current;
      const energy = Math.min(1, levelRef.current || 0);
      const isCapturing = activePhase === SPEECH_PHASE.CAPTURING;
      const isSpeaking = activePhase === SPEECH_PHASE.SPEAKING;
      const isThinking = activePhase === SPEECH_PHASE.THINKING;
      const baseAmplitude = isCapturing
        ? 0.16 + energy * 0.7
        : isSpeaking
        ? 0.1 + energy * 0.32
        : isThinking
        ? 0.07
        : 0.09 + energy * 0.55;
      const speed = isCapturing ? 0.0016 : isThinking ? 0.0005 : 0.0008;
      const midY = height / 2;
      context.globalCompositeOperation = "lighter";

      for (let layer = 0; layer < 3; layer += 1) {
        const amplitude = height * baseAmplitude * (1 - layer * 0.18);
        const frequency = 1.4 + layer * 0.55;
        const offset = layer * 1.7;
        context.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const nx = x / Math.max(1, width);
          const envelope = 0.55 + 0.45 * Math.sin(Math.PI * nx);
          const wave =
            Math.sin(nx * Math.PI * 2 * frequency + time * speed * (1 + layer * 0.4) + offset) *
            amplitude *
            envelope;
          const fine = Math.sin(nx * Math.PI * 2 * (frequency * 2.7) - time * speed * 1.3) *
            amplitude *
            0.18;
          const y = midY + wave + fine;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = palette[layer % palette.length];
        context.globalAlpha = 0.62 - layer * 0.16;
        context.lineWidth = 2.2 - layer * 0.45;
        context.shadowColor = palette[layer % palette.length];
        context.shadowBlur = 14 - layer * 3;
        context.stroke();
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="speech-mode-wave" aria-hidden="true" />;
}

export default function SpeechModePanel({
  phase,
  level,
  error,
  notice,
  onClose,
  onInterrupt,
  onSendNow,
  onRetry,
}) {
  const { t } = useTranslation();
  const copy = PHASE_COPY[phase] || PHASE_COPY[SPEECH_PHASE.LISTENING];
  const isCapturing = phase === SPEECH_PHASE.CAPTURING;
  const isInterruptible =
    phase === SPEECH_PHASE.THINKING || phase === SPEECH_PHASE.SPEAKING;
  const isError = phase === SPEECH_PHASE.ERROR;
  const statusText = t(`conversation.${copy.status}`);
  const hintText = isError && error
    ? t(`conversation.${ERROR_KEYS[error] || "speech_mode_error_microphone"}`)
    : t(`conversation.${copy.hint}`);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const overlay = (
    <div className="speech-mode-overlay fixed inset-0 z-[120] flex flex-col bg-base-100 text-base-content">
      <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/70">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <AudioLines className="h-4 w-4 text-accent" />
          <span>{t("conversation.speech_mode_title")}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("conversation.speech_mode_close")}
          className="h-10 w-10 rounded-full flex items-center justify-center bg-base-200 hover:bg-base-300 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-5 py-6">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div
            className="speech-mode-orb"
            data-phase={phase}
            aria-hidden="true"
          >
            <div className="speech-mode-orb-core" />
          </div>
          <Waveform level={level} phase={phase} />
          <div className="mt-7 text-xl sm:text-2xl font-semibold text-center" aria-live="polite">
            {statusText}
          </div>
          <div className="mt-2 text-sm sm:text-base opacity-70 text-center max-w-lg">
            {hintText}
          </div>
          {notice ? (
            <div className="mt-4 text-sm font-medium text-warning text-center">
              {t(`conversation.${notice}`)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-8 pt-2 flex flex-col items-center gap-3">
        {isCapturing && (
          <button
            type="button"
            onClick={onSendNow}
            className="speech-mode-action bg-accent text-accent-content hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            {t("conversation.speech_mode_send_now")}
          </button>
        )}
        {isInterruptible && (
          <button
            type="button"
            onClick={onInterrupt}
            className="speech-mode-action bg-error text-error-content hover:opacity-90"
          >
            <Square className="h-4 w-4" />
            {t("conversation.speech_mode_interrupt")}
          </button>
        )}
        {isError && (
          <button
            type="button"
            onClick={onRetry}
            className="speech-mode-action bg-accent text-accent-content hover:opacity-90"
          >
            <RotateCw className="h-4 w-4" />
            {t("conversation.speech_mode_retry")}
          </button>
        )}
        {!isCapturing && !isInterruptible && !isError && (
          <div className="text-xs uppercase tracking-[0.18em] opacity-50 pb-2">
            {t("conversation.speech_mode_hint_start")}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
}
