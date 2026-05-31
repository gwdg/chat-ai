import React, { useState, useEffect, useCallback, useRef } from "react";
import { Volume2, Square } from "lucide-react";
import generateAudio from "../../../apis/generateAudio";

export default function SpeakButton({
   message
}) {
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechFile, setSpeechFile] = useState(null);

  const speechModule = import.meta.env?.VITE_MODULE_SPEECH
    ? JSON.parse(import.meta.env.VITE_MODULE_SPEECH)
    : false; 

  const speechModel = speechModule?.model;
  const speechVoice = speechModule?.voice;
  let audio = useRef(null);

  const handleStop = async () => {
    try {
      if (audio.current) {
        audio.current.pause();
        audio.current.currentTime = 0;
      }
    } catch (error) {
      console.error("Error stopping audio: ", error);
    }
    setIsSpeaking(false);
  }

  const handleSpeak = async () => {
    setIsSpeaking(true);
    try {
      if (!speechFile) {
        console.log("Generating speech...");
        const file = await generateAudio(
          message?.content?.[0]?.text || "", 
          speechModel, 
          speechVoice
        );

        if (!file) {
          setSpeechFile(null);
          console.error("Speech generation failed");
          return;
        }

        setSpeechFile(file);

        const audioDataURL = URL.createObjectURL(file);
        audio.current = new Audio(audioDataURL);
        audio.current.onended = () => {
          setIsSpeaking(false);
        };
        audio.current.play().catch((playError) => {
          console.error("Audio playback failed: ", playError);
        });
      }

      if (speechFile) {
        const audioDataURL = URL.createObjectURL(speechFile);
        audio.current = new Audio(audioDataURL);
        // play audio and set isSpeaking to false when playback finishes
        audio.current.onended = () => {
          setIsSpeaking(false);
        };
        audio.current.play().catch((playError) => {
          console.error("Audio playback failed: ", playError);
          setIsSpeaking(false);
        });
        
      }
    } catch (error) {
      console.error("Speech failed: ", error);
      setSpeechFile(null);
      setIsSpeaking(false);
    }
  };

  return speechModule && (
    !isSpeaking ? (
        <button onClick={handleSpeak} title="Speak" className="inline-grid h-[22px] w-[22px] cursor-pointer" disabled={isSpeaking}>
        <Volume2
            className="opacity-20 group-hover:opacity-100 transition-opacity duration-300 h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
            alt="speak_icon"
        />
        </button>
      ) : (
        <button onClick={handleStop} title="Stop" className="inline-grid h-[22px] w-[22px] cursor-pointer" disabled={!isSpeaking}>
        <Square
            className="opacity-20 group-hover:opacity-100 transition-opacity duration-300 h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
            alt="stop_icon"
        />
        </button>
      )
  )
}