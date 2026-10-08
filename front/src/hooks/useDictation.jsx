import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import transcribeAudio from "../apis/transcribeAudio";
import { convertToWav } from "../utils/attachments";
import { useToast } from "./useToast";

// Dictation for a text field: record from the microphone, then send the whole
// recording for transcription and pass the text to onText. Neither audio nor
// text is kept afterwards. status: "idle" → "recording" → "transcribing" → "idle".
export function useDictation(onText) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const mountedRef = useRef(true);
  const startingRef = useRef(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const abortRef = useRef(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  const releaseMicrophone = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Closing the modal mid-way discards the recording and cancels the upload
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }
      releaseMicrophone();
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [status]);

  const transcribe = async (audioBlob) => {
    releaseMicrophone();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (audioBlob.size === 0) {
        notifyError(t("radiology.no_speech"));
        return;
      }
      const text = await transcribeAudio(await convertToWav(audioBlob), {
        signal: controller.signal,
      });
      if (!mountedRef.current) return;
      if (text.trim() === "") notifyError(t("radiology.no_speech"));
      else onTextRef.current(text);
    } catch (error) {
      if (error.name !== "AbortError") {
        notifyError(t("radiology.transcription_failed"));
      }
    } finally {
      if (mountedRef.current) setStatus("idle");
    }
  };

  const start = async () => {
    if (status !== "idle" || startingRef.current) return;
    // getUserMedia is only available over HTTPS or on localhost
    if (!navigator.mediaDevices?.getUserMedia) {
      notifyError(t("radiology.mic_insecure"));
      return;
    }
    startingRef.current = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (error) {
      const key =
        { NotAllowedError: "mic_denied", NotFoundError: "mic_not_found" }[
          error.name
        ] || "mic_failed";
      notifyError(t(`radiology.${key}`));
      return;
    } finally {
      startingRef.current = false;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    // The browser picks its own format (webm, ogg or mp4); convertToWav
    // decodes any of them.
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () =>
      transcribe(new Blob(chunks, { type: recorder.mimeType }));
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setStatus("recording");
  };

  const stop = () => {
    if (recorderRef.current?.state !== "recording") return;
    setStatus("transcribing");
    recorderRef.current.stop();
  };

  return { status, seconds, start, stop };
}
