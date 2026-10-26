import { useEffect, useRef, useState } from "react";

export default function MiniAudioButton({ src }) {
  const audioRef = useRef(null);
  const rafRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
        if (audio.duration) {
            const next = audio.currentTime / audio.duration;

            setProgress((prev) =>
            Math.abs(prev - next) > 0.001 ? next : prev
            );
        }
        rafRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("ended", handleEnded);
        return () => audio.removeEventListener("ended", handleEnded);
    }, []);

  const toggle = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  /** SVG circle math */
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <button
      onClick={toggle}
      className="btn btn-info btn-circle relative"
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Progress ring */}
      <svg className="absolute inset-0" width="40" height="40">
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="3"
          fill="none"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="white"
          strokeWidth="3"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>

      {/* Play / Pause icon */}
      {isPlaying ? (
        <svg className="w-4 h-4 text-white relative z-10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-white relative z-10 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}