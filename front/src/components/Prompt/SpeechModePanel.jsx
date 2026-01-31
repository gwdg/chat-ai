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
    <div className="px-5 py-6 sm:py-8 min-h-[240px] sm:min-h-[320px] flex flex-col speech-mode-surface">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-tertiary">
          {t("conversation.speech_mode_title")}
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t("conversation.speech_mode_close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5">
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

        <div className="text-sm text-gray-500 dark:text-gray-300">
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
            "px-5 py-2.5 rounded-full text-sm font-medium shadow-lg",
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
