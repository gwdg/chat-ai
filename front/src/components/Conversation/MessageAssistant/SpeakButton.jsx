import React, { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import generateAudio from "../../../apis/generateAudio";
import { getSpeechModule, toSpeechText } from "../../../utils/speechAudio";

export default function SpeakButton({
   message
}) {

  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const speechModule = getSpeechModule();
  const speechModel = speechModule?.model;
  const speechVoice = speechModule?.voice;

  function stopPlayback() {
    try {
      if (audioRef.current) {
        audioRef.current.pause?.();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      window.speechSynthesis?.cancel?.();
    } catch (error) {
      console.error("Error stopping audio: ", error);
    }
  }

  useEffect(() => stopPlayback, []);

  // Used when the engine has no TTS model, and whenever a request for it fails.
  function speakWithBrowser(text) {
    if (
      typeof window === "undefined" ||
      !window.speechSynthesis ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const language = String(navigator?.language || "en").split("-")[0].toLowerCase();
      utterance.lang = language === "de" ? "de-DE" : "en-US";
      const voices = window.speechSynthesis.getVoices?.() || [];
      const matchingVoice = voices.find((voice) =>
        voice.lang?.toLowerCase().startsWith(language)
      );
      if (matchingVoice) utterance.voice = matchingVoice;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  function playFile(file) {
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => {
      if (urlRef.current === url) {
        URL.revokeObjectURL(url);
        urlRef.current = null;
      }
      audioRef.current = null;
      setIsSpeaking(false);
    };
    audio.onerror = () => {
      stopPlayback();
      setIsSpeaking(false);
    };
    audio.play().catch((playError) => {
      console.error("Audio playback failed: ", playError);
      stopPlayback();
      setIsSpeaking(false);
    });
  }

  const handleStop = async () => {
    stopPlayback();
    setIsSpeaking(false);
  }

  const handleSpeak = async () => {
    const text = toSpeechText(
      (message?.content || [])
        .filter((item) => item?.type === "text")
        .map((item) => item.text || "")
        .join(" ")
    );
    if (!text) return;

    stopPlayback();
    setIsSpeaking(true);
    try {
      if (speechModel && speechVoice) {
        const file = await generateAudio(text, speechModel, speechVoice);
        if (file) {
          playFile(file);
          return;
        }
      }
      const ok = await speakWithBrowser(text);
      if (!ok) setIsSpeaking(false);
    } catch (error) {
      console.error("Speech failed: ", error);
      setIsSpeaking(false);
    }
  };

  return speechModule && (
    !isSpeaking ? (
        <button onClick={handleSpeak} data-guide="speak" title="Speak" className="inline-grid h-[22px] w-[22px] cursor-pointer" disabled={isSpeaking}>
        <Volume2
            className="opacity-20 group-hover:opacity-100 transition-opacity duration-300 h-[22px] w-[22px] cursor-pointer text-accent"
            alt="speak_icon"
        />
        </button>
      ) : (
        <button onClick={handleStop} data-guide="speak" title="Stop" className="inline-grid h-[22px] w-[22px] cursor-pointer" disabled={!isSpeaking}>
        <Square
            className="opacity-20 group-hover:opacity-100 transition-opacity duration-300 h-[22px] w-[22px] cursor-pointer text-accent"
            alt="stop_icon"
        />
        </button>
      )
  )
}
