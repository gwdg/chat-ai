import { useEffect, useState, useRef } from "react";

export default function AudioPlayer({ file, dataURL }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const mimeType = dataURL?.split(";")[0]?.replace("data:", "") || "audio";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (!isDragging) setCurrentTime(audio.currentTime);
    };
    const loaded = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const ended = () => setIsPlaying(false);
    const handleError = () => setError(true);

    audio.volume = volume;

    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", handleError);

    // set initial volume properly
    audio.volume = volume;

    return () => {
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", handleError);
    };
  }, [dataURL, isDragging, volume]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekToEvent = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clientX = e.type.includes("touch")
      ? e.touches[0].clientX
      : e.clientX;
    const posX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = posX / rect.width;
    const newTime = duration * percentage;

    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;
  };

  const handleSeekStart = (e) => {
    setIsDragging(true);
    seekToEvent(e);
  };

  const handleSeekMove = (e) => {
    if (!isDragging) return;
    seekToEvent(e);
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
  };

  /** Speed control */
  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    audioRef.current.playbackRate = rate;
    setShowSpeedMenu(false);
  };

  /** Volume control */
  const changeVolume = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  if (error || !dataURL) {
    return (
      <div className="w-full max-w-md p-6 bg-red-50 dark:bg-red-900/30 rounded-2xl border border-red-200 dark:border-red-700/50 mx-auto text-center text-red-600 dark:text-red-300">
        Failed to load audio
      </div>
    );
  }

  /** Modern volume icons */
  const VolumeIcon = () => {
    if (volume === 0) {
      // Mute
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464l-7.072 7.072M8.464 8.464l7.072 7.072M5 9h4l4-4v14l-4-4H5V9z" />
        </svg>
      );
    } else if (volume < 0.5) {
      // Low
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h4l4-4v14l-4-4H5V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10a3 3 0 010 4" />
        </svg>
      );
    } else {
      // High
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h4l4-4v14l-4-4H5V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 8a5 5 0 010 8m2-10a7 7 0 010 12" />
        </svg>
      );
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center">
      <audio ref={audioRef} src={dataURL} preload="metadata" />

      {/* Play Button */}
      <button
        onClick={togglePlayPause}
        className="mb-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400 text-white rounded-full p-5 shadow-lg transition-transform transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* MIME Type */}
      <p className="text-xs text-gray-600 dark:text-gray-200 mb-4">
        {mimeType} • {formatFileSize(file?.size)}
      </p>

      {/* Player box */}
      <div className="w-full p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-blue-200 dark:border-gray-700 shadow-lg">
        {/* Progress Bar */}
        <div
          className="relative w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-full cursor-pointer"
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseUp={handleSeekEnd}
          onMouseLeave={handleSeekEnd}
          onTouchStart={handleSeekStart}
          onTouchMove={handleSeekMove}
          onTouchEnd={handleSeekEnd}
        >
          <div
            className="absolute left-0 top-0 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 dark:bg-blue-400 rounded-full shadow border border-white dark:border-gray-900 cursor-pointer"
            style={{ left: `calc(${(currentTime / duration) * 100 || 0}% - 8px)` }}
          />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mt-2 relative">
          {/* Current time */}
          <div className="text-xs leading-none text-gray-800 dark:text-gray-100">
            {formatTime(currentTime)}
          </div>

          {/* Right side (Total time + Speed + Volume) */}
          <div className="flex items-center space-x-3 text-xs leading-none">
            {/* Total duration */}
            <div className="text-gray-800 dark:text-gray-100">
              {formatTime(duration)}
            </div>

            {/* Speed menu */}
            <div className="relative flex items-center">
              <button
                onClick={() => {
                  setShowSpeedMenu((v) => !v);
                  setShowVolumeSlider(false);
                }}
                style={{ minWidth: "42px", textAlign: "center", lineHeight: "1" }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow text-xs z-20">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <div
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`px-3 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        playbackRate === rate
                          ? "font-semibold text-blue-600 dark:text-blue-400"
                          : "text-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {rate}x
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volume menu */}
            <div className="relative flex items-center">
              <button
                onClick={() => {
                  setShowVolumeSlider((v) => !v);
                  setShowSpeedMenu(false);
                }}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
              >
                <VolumeIcon />
              </button>
              {showVolumeSlider && (
                <div className="absolute right-0 bottom-full mb-2 px-2 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg flex flex-col items-center">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={changeVolume}
                    className="h-24 w-1 cursor-pointer accent-blue-500"
                    style={{
                      writingMode: "bt-lr",
                      WebkitAppearance: "slider-vertical",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}