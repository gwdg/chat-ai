import { useMemo, useEffect, useState, useRef } from "react";

export default function AudioPlayer ({file, dataURL}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const audioRef = useRef(null);

    //if (file && dataURL) setIsLoading(false);
    
    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        const handleError = () => {
            setError(true);
            setIsLoading(false);
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);

        return () => {
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
        };
    }, []);

    // Play and Pause function
    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    // Seek function
    const handleSeek = (e) => {
        const audio = audioRef.current;
        if (!audio || !duration || !isFinite(duration)) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        if (isFinite(newTime) && newTime >= 0 && newTime <= duration) {
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const formatTime = (time) => {
        if (isNaN(time) || !isFinite(time) || time < 0) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    if (error || !dataURL) {
        return (
            <div className="w-full max-w-md p-6 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-700/50 mx-auto">
            <div className="text-center text-red-600 dark:text-red-400">
                Failed to load audio file
            </div>
            </div>
        );
    }

    return (
    <div className="w-full max-w-md p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl border border-blue-200 dark:border-blue-700/50 mx-auto">
        {/* Audio element */}
        <audio ref={audioRef} src={dataURL} preload="metadata" />

        {/* Audio info */}
        <div className="text-center mb-6">
        <div className="bg-blue-500 dark:bg-blue-600 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
            >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
        </div>
        <h3 className="font-medium text-gray-900 dark:text-white mb-1">
            {file.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
            {(file.format || "audio")?.toUpperCase()} •{" "}
            {formatFileSize(file.size)}
        </p>
        </div>

        {/* Loading state */}
        {isLoading && (
        <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
        </div>
        )}

        {/* Audio controls */}
        {!isLoading && (
        <div className="space-y-4">
            {/* Play/Pause button */}
            <div className="flex justify-center">
            <button
                onClick={togglePlayPause}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full p-3 transition-colors cursor-pointer"
            >
                {isPlaying ? (
                <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                ) : (
                <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M8 5v14l11-7z" />
                </svg>
                )}
            </button>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
            <div
                className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 cursor-pointer"
                onClick={handleSeek}
            >
                <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                    width: `${
                    duration &&
                    isFinite(duration) &&
                    currentTime &&
                    isFinite(currentTime)
                        ? (currentTime / duration) * 100
                        : 0
                    }%`,
                }}
                />
            </div>
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>
            </div>
        </div>
        )}
    </div>
    );
};