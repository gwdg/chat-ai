import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useToast } from "../../hooks/useToast";

export default function SpeechModePanel({
  onClose,
  onAudioCaptured,
  autoStart = true,
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const shouldSendRef = useRef(true);

  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setHasError(false);
      const isSecureContext =
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost";

      if (!isSecureContext) {
        notifyError(
          "Microphone access requires HTTPS or localhost. Please use https:// or access via localhost"
        );
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

      let mimeType = "audio/wav";
      if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
        mimeType = "audio/webm;codecs=pcm";
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
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

      if (error.name === "NotAllowedError") {
        notifyError(
          "Microphone permission denied. Please allow microphone access and try again."
        );
      } else if (error.name === "NotFoundError") {
        notifyError("No microphone found. Please connect a microphone and try again.");
      } else if (error.name === "NotSupportedError") {
        notifyError("Microphone access not supported. Please use HTTPS or localhost.");
      } else {
        notifyError("Failed to start recording. Please check your microphone and permissions.");
      }
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

  const handleClose = () => {
    shouldSendRef.current = false;
    if (isRecording) {
      stopRecording();
    } else {
      cleanupStream();
    }
    onClose?.();
  };

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

  return (
    <div className="speech-mode-surface w-full h-full min-h-[360px] sm:min-h-[440px] flex flex-col text-white select-none">
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="text-[11px] sm:text-xs font-medium tracking-[0.16em] uppercase text-white/70">
          {t("conversation.speech_mode_title")}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer h-9 w-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition"
          aria-label={t("conversation.speech_mode_close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-8">
        <div
          className={`speech-curves ${isRecording ? "is-recording" : ""}`}
          aria-hidden="true"
        >
          <svg
            className="speech-curves-layer"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path d="M0,120 C150,40 350,200 540,120 C720,40 900,200 1200,120 L1200,200 L0,200 Z" />
          </svg>
          <svg
            className="speech-curves-layer speech-curves-layer--alt"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path d="M0,140 C220,80 420,220 640,140 C860,80 1040,220 1200,140 L1200,200 L0,200 Z" />
          </svg>
        </div>

        <div
          className={`speech-wave ${isRecording ? "is-recording" : ""}`}
          aria-hidden="true"
        >
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
          <span className="speech-wave-bar" />
        </div>

        <div className="text-sm sm:text-base text-white/80">
          {isRecording
            ? t("conversation.speech_mode_listening")
            : hasError
            ? t("conversation.speech_mode_error")
            : t("conversation.speech_mode_ready")}
        </div>

        <button
          type="button"
          onClick={isRecording ? handleStopAndSend : startRecording}
          className={[
            "cursor-pointer px-6 py-3 rounded-full text-sm sm:text-base font-semibold",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-tertiary text-white hover:bg-[#008ac2]",
          ].join(" ")}
        >
          {isRecording
            ? t("conversation.speech_mode_stop_send")
            : t("conversation.speech_mode_start")}
        </button>
      </div>
    </div>
  );
}
