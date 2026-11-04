import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { abortRequest } from "../apis/chatCompletions";
import generateAudio from "../apis/generateAudio";
import { saveFileReady } from "../db";
import {
  encodeWav,
  resolveTtsConfig,
  splitSpeechText,
  toSpeechText,
} from "../utils/speechAudio";

export const SPEECH_PHASE = {
  IDLE: "idle",
  LISTENING: "listening",
  CAPTURING: "capturing",
  THINKING: "thinking",
  SPEAKING: "speaking",
  ERROR: "error",
};

const VAD = {
  blockSize: 1024,
  preRollSeconds: 0.4,
  onsetMs: 160,
  silenceMs: 1000,
  minCaptureMs: 450,
  minVoiceMs: 260,
  maxCaptureMs: 60000,
  bargeInThinkingMs: 220,
  bargeInSpeakingMs: 260,
  postCaptureGuardMs: 700,
  playbackGuardMs: 450,
  minThreshold: 0.008,
  speakingThresholdFactor: 1.8,
};

const ASSISTANT_TIMEOUT_MS = 180000;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function useSpeechSession({
  localState,
  setLocalState,
  sendMessage,
  enabled = true,
}) {
  const { i18n } = useTranslation();
  const [phase, setPhase] = useState(SPEECH_PHASE.IDLE);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const phaseRef = useRef(SPEECH_PHASE.IDLE);
  const tokenRef = useRef(0);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const localStateRef = useRef(localState);
  const setLocalStateRef = useRef(setLocalState);
  const sendMessageRef = useRef(sendMessage);
  const ttsConfigRef = useRef(resolveTtsConfig(localState?.settings, i18n?.language));
  const handleAudioRef = useRef(null);

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const sampleRateRef = useRef(48000);

  const preRollRef = useRef([]);
  const captureRef = useRef(null);
  const aboveMsRef = useRef(0);
  const levelRef = useRef(0);
  const noiseFloorRef = useRef(0.004);
  const lastLevelEmitRef = useRef(0);
  const playbackGuardUntilRef = useRef(0);
  const postCaptureGuardUntilRef = useRef(0);

  const playbackRef = useRef(null);
  const browserSpeechRef = useRef(null);

  useEffect(() => {
    localStateRef.current = localState;
    setLocalStateRef.current = setLocalState;
    sendMessageRef.current = sendMessage;
    ttsConfigRef.current = resolveTtsConfig(localState?.settings, i18n?.language);
  }, [localState, setLocalState, sendMessage, i18n?.language]);

  const updatePhase = useCallback((nextPhase) => {
    if (phaseRef.current === nextPhase) return;
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const resetOnset = useCallback(() => {
    aboveMsRef.current = 0;
  }, []);

  function stopPlayback() {
    const playback = playbackRef.current;
    if (playback) {
      playbackRef.current = null;
      playback.audio.onended = null;
      playback.audio.onerror = null;
      try {
        playback.audio.pause();
        playback.audio.currentTime = 0;
      } catch (playbackError) {
        console.warn("Could not stop speech playback.", playbackError);
      }
      URL.revokeObjectURL(playback.url);
      playback.resolve(false);
    }
    const browserSpeech = browserSpeechRef.current;
    if (browserSpeech) {
      browserSpeechRef.current = null;
      try {
        window.speechSynthesis?.cancel();
      } catch (speechError) {
        console.warn("Could not stop browser speech.", speechError);
      }
      browserSpeech.resolve(false);
    }
  }

  function teardownAudioGraph() {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch (disconnectError) {
        console.warn("Could not disconnect the audio processor.", disconnectError);
      }
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (disconnectError) {
        console.warn("Could not disconnect the microphone source.", disconnectError);
      }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close?.().catch(() => {});
      audioContextRef.current = null;
    }
    preRollRef.current = [];
    captureRef.current = null;
    aboveMsRef.current = 0;
    levelRef.current = 0;
    setLevel(0);
  }

  const stop = useCallback(() => {
    activeRef.current = false;
    startingRef.current = false;
    tokenRef.current += 1;
    stopPlayback();
    teardownAudioGraph();
    updatePhase(SPEECH_PHASE.IDLE);
  }, [updatePhase]);

  useEffect(() => () => stop(), [stop]);

  async function appendUserAudio(wavBlob) {
    const current = localStateRef.current;
    if (!current?.id) throw new Error("conversation_unavailable");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([wavBlob], `speech-${stamp}.wav`, {
      type: "audio/wav",
    });
    const fileId = await saveFileReady(current.id, file);
    const messages = [...(current.messages || [])];
    let lastIndex = messages.length - 1;
    if (messages[lastIndex]?.role !== "user") {
      messages.push({ role: "user", content: [{ type: "text", text: "" }] });
      lastIndex = messages.length - 1;
    }
    const lastMessage = messages[lastIndex];
    const content = Array.isArray(lastMessage.content)
      ? [...lastMessage.content]
      : [{ type: "text", text: "" }];
    content.push({ type: "file", fileId });
    messages[lastIndex] = {
      ...lastMessage,
      content,
      meta: { ...(lastMessage.meta || {}), speechAudio: true },
    };
    const nextState = { ...current, messages };
    localStateRef.current = nextState;
    setLocalStateRef.current(nextState);
    return { nextState, conversationId: current.id, assistantIndex: messages.length };
  }

  function appendAssistantAudio(conversationId, assistantIndex, fileId) {
    setLocalStateRef.current((prev) => {
      if (prev.id !== conversationId) return prev;
      const messages = [...prev.messages];
      const message = messages[assistantIndex];
      if (!message || message.role !== "assistant") return prev;
      const content = Array.isArray(message.content) ? [...message.content] : [];
      if (content.some((item) => item?.type === "file" && item.fileId === fileId)) {
        return prev;
      }
      content.push({ type: "file", fileId });
      messages[assistantIndex] = { ...message, content };
      return { ...prev, messages, flush: true };
    });
  }

  function waitForAssistant(assistantIndex, token, sendPromise) {
    return new Promise((resolve) => {
      const startedAt = now();
      let settledAt = null;
      sendPromise.finally(() => {
        settledAt = now();
      });
      const check = () => {
        if (token !== tokenRef.current) {
          resolve(null);
          return;
        }
        const message = localStateRef.current?.messages?.[assistantIndex];
        if (message?.role === "assistant" && !message.loading) {
          resolve(message);
          return;
        }
        const timestamp = now();
        if (settledAt && timestamp - settledAt > 600) {
          resolve(undefined);
          return;
        }
        if (timestamp - startedAt > ASSISTANT_TIMEOUT_MS) {
          resolve(undefined);
          return;
        }
        window.setTimeout(check, 120);
      };
      check();
    });
  }

  function playAudioFile(file, token) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        audio.onended = null;
        audio.onerror = null;
        if (playbackRef.current?.audio === audio) {
          playbackRef.current = null;
        }
        URL.revokeObjectURL(url);
        resolve(ok && token === tokenRef.current);
      };
      playbackRef.current = { audio, url, resolve: finish };
      playbackGuardUntilRef.current = now() + VAD.playbackGuardMs;
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch((playError) => {
        console.warn("Speech playback failed.", playError);
        finish(false);
      });
    });
  }

  function speakWithBrowser(text, token) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const language = ttsConfigRef.current.language || "en";
      utterance.lang = language === "de" ? "de-DE" : "en-US";
      const voices = window.speechSynthesis.getVoices?.() || [];
      const matchingVoice = voices.find((voice) =>
        voice.lang?.toLowerCase().startsWith(language.toLowerCase())
      );
      if (matchingVoice) utterance.voice = matchingVoice;
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        utterance.onend = null;
        utterance.onerror = null;
        if (browserSpeechRef.current?.utterance === utterance) {
          browserSpeechRef.current = null;
        }
        resolve(ok && token === tokenRef.current);
      };
      browserSpeechRef.current = { utterance, resolve: finish };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      playbackGuardUntilRef.current = now() + VAD.playbackGuardMs;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function speakAssistant(message, token, conversationId, assistantIndex) {
    const textContent = (message?.content || [])
      .filter((item) => item?.type === "text")
      .map((item) => item.text || "")
      .join(" ");
    const text = toSpeechText(textContent);
    if (!text) return false;

    const { model, voice, language } = ttsConfigRef.current;
    if (!model || !voice) {
      updatePhase(SPEECH_PHASE.SPEAKING);
      return speakWithBrowser(text, token);
    }

    const chunks = splitSpeechText(text);
    if (chunks.length === 0) return false;
    updatePhase(SPEECH_PHASE.SPEAKING);

    const synthesize = async (chunk) => {
      try {
        return await generateAudio(chunk, model, voice, 90000, language);
      } catch (speechError) {
        console.warn("Speech generation failed.", speechError);
        return null;
      }
    };

    let nextAudio = synthesize(chunks[0]);
    for (let index = 0; index < chunks.length; index += 1) {
      const audioFile = await nextAudio;
      if (token !== tokenRef.current) return false;
      if (!audioFile) {
        return speakWithBrowser(chunks.slice(index).join(" "), token);
      }
      nextAudio =
        index + 1 < chunks.length ? synthesize(chunks[index + 1]) : null;
      const fileId = await saveFileReady(conversationId, audioFile);
      appendAssistantAudio(conversationId, assistantIndex, fileId);
      const completed = await playAudioFile(audioFile, token);
      if (!completed) {
        if (token !== tokenRef.current) return false;
        return speakWithBrowser(chunks.slice(index).join(" "), token);
      }
    }
    return true;
  }

  async function runSpeechTurn(wavBlob, token) {
    let turn;
    try {
      turn = await appendUserAudio(wavBlob);
    } catch (appendError) {
      console.error("Could not attach the spoken message.", appendError);
      setError("conversation_unavailable");
      updatePhase(SPEECH_PHASE.ERROR);
      return;
    }

    const sendPromise = Promise.resolve(
      sendMessageRef.current({
        localState: turn.nextState,
        setLocalState: setLocalStateRef.current,
        speechMode: true,
      })
    ).catch((sendError) => {
      console.error("Speech message failed.", sendError);
      return null;
    });

    const assistant = await waitForAssistant(turn.assistantIndex, token, sendPromise);
    if (token !== tokenRef.current) return;
    if (assistant === undefined) {
      setError("response_timeout");
      updatePhase(SPEECH_PHASE.ERROR);
      return;
    }
    if (!assistant) {
      return;
    }

    const assistantHasText = Boolean(
      toSpeechText(
        (assistant.content || [])
          .filter((item) => item?.type === "text")
          .map((item) => item.text || "")
          .join(" ")
      )
    );
    const spoke = await speakAssistant(
      assistant,
      token,
      turn.conversationId,
      turn.assistantIndex
    );
    if (token !== tokenRef.current) return;
    if (!spoke) {
      setNotice(
        assistantHasText
          ? "speech_mode_output_unavailable"
          : "speech_mode_didnt_catch"
      );
      window.setTimeout(() => setNotice(null), 4000);
    }
    postCaptureGuardUntilRef.current = now() + 300;
    updatePhase(SPEECH_PHASE.LISTENING);
    resetOnset();
  }

  function beginCapture(timestamp, usePreRoll = true) {
    const chunks = usePreRoll ? preRollRef.current.map((chunk) => chunk.slice()) : [];
    captureRef.current = {
      chunks,
      startedAt: timestamp,
      lastVoiceAt: timestamp,
      voiceMs: usePreRoll ? VAD.onsetMs : 0,
      sampleRate: sampleRateRef.current,
    };
    resetOnset();
    updatePhase(SPEECH_PHASE.CAPTURING);
  }

  async function finalizeCapture({ force = false } = {}) {
    const capture = captureRef.current;
    if (!capture) return;
    captureRef.current = null;
    const duration = now() - capture.startedAt;
    const minimumDuration = force ? VAD.minVoiceMs : VAD.minCaptureMs;
    if (duration < minimumDuration || capture.voiceMs < VAD.minVoiceMs) {
      updatePhase(SPEECH_PHASE.LISTENING);
      resetOnset();
      return;
    }
    const wavBlob = encodeWav(capture.chunks, capture.sampleRate);
    if (wavBlob.size < 2048) {
      updatePhase(SPEECH_PHASE.LISTENING);
      resetOnset();
      return;
    }
    postCaptureGuardUntilRef.current = now() + VAD.postCaptureGuardMs;
    updatePhase(SPEECH_PHASE.THINKING);
    resetOnset();
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    await runSpeechTurn(wavBlob, token);
  }

  function bargeIn(timestamp) {
    tokenRef.current += 1;
    stopPlayback();
    abortRequest();
    beginCapture(timestamp, true);
  }

  function processAudioBlock(event) {
    if (!activeRef.current) return;
    const input = event.inputBuffer.getChannelData(0);
    const block = new Float32Array(input);
    const timestamp = now();
    const blockMs = (block.length / sampleRateRef.current) * 1000;

    let sumSquares = 0;
    for (let i = 0; i < block.length; i += 1) {
      sumSquares += block[i] * block[i];
    }
    const rms = Math.sqrt(sumSquares / block.length);
    levelRef.current = levelRef.current * 0.78 + rms * 0.22;

    if (timestamp - lastLevelEmitRef.current > 90) {
      lastLevelEmitRef.current = timestamp;
      setLevel(Math.min(1, levelRef.current * 7));
    }

    const preRollLimit = sampleRateRef.current * VAD.preRollSeconds;
    preRollRef.current.push(block);
    let preRollSamples = preRollRef.current.reduce(
      (total, chunk) => total + chunk.length,
      0
    );
    while (preRollSamples > preRollLimit && preRollRef.current.length > 1) {
      preRollSamples -= preRollRef.current.shift().length;
    }

    const currentPhase = phaseRef.current;
    if (currentPhase === SPEECH_PHASE.IDLE || currentPhase === SPEECH_PHASE.ERROR) {
      return;
    }

    if (currentPhase === SPEECH_PHASE.LISTENING && rms < noiseFloorRef.current * 2.5) {
      noiseFloorRef.current = Math.max(
        0.0005,
        noiseFloorRef.current * 0.995 + rms * 0.005
      );
    }

    const baseThreshold = Math.max(
      VAD.minThreshold,
      noiseFloorRef.current * 3.2
    );
    const threshold =
      currentPhase === SPEECH_PHASE.SPEAKING
        ? Math.max(0.018, baseThreshold * VAD.speakingThresholdFactor)
        : baseThreshold;
    const aboveThreshold = levelRef.current > threshold;

    if (!aboveThreshold) {
      aboveMsRef.current = Math.max(0, aboveMsRef.current - blockMs * 1.7);
    } else if (timestamp >= playbackGuardUntilRef.current) {
      aboveMsRef.current += blockMs;
    }

    if (currentPhase === SPEECH_PHASE.LISTENING) {
      if (aboveMsRef.current >= VAD.onsetMs) {
        beginCapture(timestamp);
      }
      return;
    }

    if (currentPhase === SPEECH_PHASE.CAPTURING) {
      const capture = captureRef.current;
      if (!capture) return;
      capture.chunks.push(block);
      if (aboveThreshold) {
        capture.lastVoiceAt = timestamp;
        capture.voiceMs += blockMs;
      }
      const silentFor = timestamp - capture.lastVoiceAt;
      if (
        capture.voiceMs >= VAD.minVoiceMs &&
        silentFor >= VAD.silenceMs &&
        timestamp - capture.startedAt >= VAD.minCaptureMs
      ) {
        void finalizeCapture();
      } else if (timestamp - capture.startedAt >= VAD.maxCaptureMs) {
        void finalizeCapture();
      }
      return;
    }

    if (currentPhase === SPEECH_PHASE.THINKING || currentPhase === SPEECH_PHASE.SPEAKING) {
      if (timestamp < postCaptureGuardUntilRef.current) return;
      const requiredMs =
        currentPhase === SPEECH_PHASE.SPEAKING
          ? VAD.bargeInSpeakingMs
          : VAD.bargeInThinkingMs;
      if (aboveMsRef.current >= requiredMs) {
        bargeIn(timestamp);
      }
    }
  }

  handleAudioRef.current = processAudioBlock;

  const start = useCallback(async () => {
    if (!enabled || activeRef.current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setNotice(null);
    try {
      const secure =
        window.isSecureContext ||
        location.protocol === "https:" ||
        location.hostname === "localhost";
      if (!secure) {
        setError("insecure_context");
        updatePhase(SPEECH_PHASE.ERROR);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("microphone_unavailable");
        updatePhase(SPEECH_PHASE.ERROR);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        setError("audio_context_unavailable");
        updatePhase(SPEECH_PHASE.ERROR);
        return;
      }
      const audioContext = new AudioContextClass();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(VAD.blockSize, 1, 1);
      processor.onaudioprocess = (event) => handleAudioRef.current?.(event);
      source.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      streamRef.current = stream;
      sourceRef.current = source;
      processorRef.current = processor;
      sampleRateRef.current = audioContext.sampleRate || 48000;
      noiseFloorRef.current = 0.004;
      resetOnset();
      activeRef.current = true;
      updatePhase(SPEECH_PHASE.LISTENING);
    } catch (startError) {
      console.error("Could not start speech mode.", startError);
      const code =
        startError?.name === "NotAllowedError"
          ? "permission_denied"
          : startError?.name === "NotFoundError"
          ? "microphone_not_found"
          : "microphone_unavailable";
      setError(code);
      updatePhase(SPEECH_PHASE.ERROR);
    } finally {
      startingRef.current = false;
    }
  }, [enabled, resetOnset, updatePhase]);

  const interrupt = useCallback(() => {
    tokenRef.current += 1;
    stopPlayback();
    abortRequest();
    if (captureRef.current) {
      captureRef.current = null;
    }
    resetOnset();
    if (activeRef.current) {
      postCaptureGuardUntilRef.current = now() + 250;
      updatePhase(SPEECH_PHASE.LISTENING);
    }
  }, [resetOnset, updatePhase]);

  const sendNow = useCallback(() => {
    if (phaseRef.current === SPEECH_PHASE.CAPTURING) {
      void finalizeCapture({ force: true });
    }
  }, []);

  const retry = useCallback(() => {
    stop();
    window.setTimeout(() => {
      void start();
    }, 50);
  }, [start, stop]);

  return {
    phase,
    level,
    error,
    notice,
    isActive: activeRef.current,
    start,
    stop,
    interrupt,
    sendNow,
    retry,
  };
}
