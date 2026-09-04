import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

const SpeechModePanel = forwardRef(function SpeechModePanel(
  {
    onClose,
    onInterrupt,
    onAudioCaptured,
    autoStart = true,
    phase = "idle",
  },
  ref
) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const shouldSendRef = useRef(true);
  const phaseRef = useRef(phase);
  const isRecordingRef = useRef(false);
  const waveCanvasRef = useRef(null);
  const waveFrameRef = useRef(null);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const isThinking = phase === "processing" || phase === "waiting";
  const isPlaying = phase === "playing";
  const isInterruptible = isThinking || isPlaying;
  const statusText = hasError
    ? t("conversation.speech_mode_error")
    : isRecording
    ? t("conversation.speech_mode_listening")
    : isThinking
    ? t("conversation.speech_mode_thinking")
    : isPlaying
    ? ""
    : t("conversation.speech_mode_ready");

  const startRecording = async () => {
    if (isRecording) return;
    try {
      setHasError(false);
      const isSecureContext =
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost";

      if (!isSecureContext) {
        setHasError(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = "audio/webm;codecs=opus";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
        mimeType = "audio/webm;codecs=pcm";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      } else {
        mimeType = "audio/webm";
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupStream();
        if (shouldSendRef.current && audioBlob.size > 0) {
          await onAudioCaptured({ audioBlob, type: mimeType });
        }
        shouldSendRef.current = true;
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (error) {
      console.error("❌ Error starting recording:", error);
      setHasError(true);
      setIsRecording(false);
      cleanupStream();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleStopAndSend = () => {
    shouldSendRef.current = true;
    stopRecording();
  };

  const handleInterrupt = () => {
    shouldSendRef.current = false;
    if (isRecording) {
      stopRecording();
    }
    onInterrupt?.();
  };

  const handleClose = () => {
    shouldSendRef.current = false;
    if (isRecording) stopRecording();
    cleanupStream();
    onClose?.();
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let palette = {
      cyan: "#6ad4ff",
      blue: "#6e7fff",
      magenta: "#e768ff",
      violet: "#9f77ff",
    };

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const styles = getComputedStyle(canvas);
      palette = {
        cyan: styles.getPropertyValue("--speech-wave-cyan").trim() || "#6ad4ff",
        blue: styles.getPropertyValue("--speech-wave-blue").trim() || "#6e7fff",
        magenta:
          styles.getPropertyValue("--speech-wave-magenta").trim() || "#e768ff",
        violet:
          styles.getPropertyValue("--speech-wave-violet").trim() || "#9f77ff",
      };
    };

    const renderFrame = (time) => {
      if (disposed) return;
      if (!width || !height) {
        syncCanvasSize();
      }

      ctx.clearRect(0, 0, width, height);

      const midY = height * 0.52;
      const activity =
        isRecordingRef.current || phaseRef.current === "playing"
          ? 1
          : phaseRef.current === "processing" || phaseRef.current === "waiting"
          ? 0.92
          : 0.84;
      const breathing = 0.88 + 0.12 * Math.sin(time * 0.00065);
      const intensity = activity * breathing;
      const travel = time * 0.00028;
      const glowBoost = 10 + intensity * 8;

      const layers = [
        {
          color: palette.magenta,
          alpha: 0.62,
          width: 2.1,
          freqA: 1.45,
          freqB: 3.05,
          speedA: 1.1,
          speedB: 0.7,
          phase: 0.4,
          ampScale: 1.1,
        },
        {
          color: palette.cyan,
          alpha: 0.54,
          width: 1.8,
          freqA: 1.7,
          freqB: 3.3,
          speedA: 1.3,
          speedB: 0.78,
          phase: 1.05,
          ampScale: 1,
        },
        {
          color: palette.blue,
          alpha: 0.46,
          width: 1.5,
          freqA: 1.95,
          freqB: 3.55,
          speedA: 1.45,
          speedB: 0.9,
          phase: 1.55,
          ampScale: 0.92,
        },
        {
          color: palette.violet,
          alpha: 0.34,
          width: 1.25,
          freqA: 2.2,
          freqB: 3.85,
          speedA: 1.6,
          speedB: 1.05,
          phase: 2.1,
          ampScale: 0.8,
        },
      ];

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const layer of layers) {
        const baseAmp = height * 0.09 * layer.ampScale * intensity;

        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const nx = x / width;
          const envelope = 0.66 + 0.34 * Math.sin(Math.PI * nx);
          const phaseA =
            (nx - travel * layer.speedA) * Math.PI * 2 * layer.freqA + layer.phase;
          const phaseB =
            (nx - travel * layer.speedB) * Math.PI * 2 * layer.freqB + layer.phase;
          const y =
            midY +
            Math.sin(phaseA) * baseAmp * envelope +
            Math.sin(phaseB) * baseAmp * 0.32;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = layer.color;
        ctx.globalAlpha = layer.alpha;
        ctx.lineWidth = layer.width + intensity * 0.8;
        ctx.shadowColor = layer.color;
        ctx.shadowBlur = glowBoost;
        ctx.stroke();
      }

      ctx.restore();
      waveFrameRef.current = requestAnimationFrame(renderFrame);
    };

    syncCanvasSize();
    waveFrameRef.current = requestAnimationFrame(renderFrame);
    window.addEventListener("resize", syncCanvasSize);

    return () => {
      disposed = true;
      if (waveFrameRef.current) {
        cancelAnimationFrame(waveFrameRef.current);
        waveFrameRef.current = null;
      }
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, []);

  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
    return () => {
      shouldSendRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    startRecording: () => {
      if (!isRecording) {
        startRecording();
      }
    },
    stopRecording: () => {
      if (isRecording) {
        stopRecording();
      }
    },
  }));

  return (
    <div className="speech-mode-surface w-full h-full min-h-[360px] sm:min-h-[440px] flex flex-col text-slate-900 dark:text-white select-none">
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="text-[11px] sm:text-xs font-medium tracking-[0.16em] uppercase text-slate-700/90 dark:text-white/70">
          {t("conversation.speech_mode_title")}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer h-9 w-9 rounded-full flex items-center justify-center bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition"
          aria-label={t("conversation.speech_mode_close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-end px-6 pb-8 pt-16">
        <div className="speech-flow-shell" aria-hidden="true">
          <canvas ref={waveCanvasRef} className="speech-flow-canvas" />
          <div className="speech-flow-glow" />
        </div>
        {statusText ? (
          <div className="relative z-10 mb-3 text-center text-sm sm:text-base text-slate-700 dark:text-white/80">
            {statusText}
          </div>
        ) : null}

        <button
          type="button"
          onClick={
            isRecording
              ? handleStopAndSend
              : isInterruptible
              ? handleInterrupt
              : startRecording
          }
          className={[
            "relative z-10 cursor-pointer px-6 py-3 rounded-full text-sm sm:text-base font-semibold",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : isInterruptible
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-tertiary text-white hover:bg-[#008ac2]",
          ].join(" ")}
        >
          {isRecording
            ? t("conversation.speech_mode_stop_send")
            : isInterruptible
            ? t("conversation.speech_mode_stop")
            : t("conversation.speech_mode_start")}
        </button>
      </div>
    </div>
  );
});

export default SpeechModePanel;
