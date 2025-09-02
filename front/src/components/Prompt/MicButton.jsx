import { useEffect, useRef, useState } from "react";

import Tooltip from "../Others/Tooltip";
import { Trans, useTranslation } from "react-i18next";
import { abortRequest } from "../../apis/chatCompletions";
import { useToast } from "../../hooks/useToast";
import { useAttachments } from "../../hooks/useAttachments";

import icon_mic from "../../assets/icons/mic.svg";

export default function MicButton({
    localState,
    setLocalState,
}) {
    const { t, i18n } = useTranslation();
    const { notifySuccess, notifyError } = useToast();

    const { addAudioAttachment } = useAttachments();

    const [isRecording, setIsRecording] = useState(false);
    const [isLongPress, setIsLongPress] = useState(false); // Needed?
    const [pressTimer, setPressTimer] = useState(null); // Needed?
    const isHoldRecordingRef = useRef(false);
    const mouseDownTimeRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const streamRef = useRef(null);

    const loading = localState.messages[localState.messages.length - 2]?.role === "assistant"
    ? localState.messages[localState.messages.length - 2]?.loading || false
    : false;

    const model = localState.settings.model;
    const isAudioSupported = (model?.input?.includes("audio") || false)

    const handleAudioClick = () => {
        if (loading) return;
        // Only handle click if it wasn't a hold action
        if (!isHoldRecordingRef.current) {
        if (isRecording) {
            // Stop recording
            handleAudioRecording();
        } else {
            // Start recording
            handleAudioRecording();
        }
        }
        // Reset hold recording flag
        isHoldRecordingRef.current = false;
    };

    const handleAudioMouseDown = () => {
        if (loading) return;
        // Record the time when mouse was pressed down
        mouseDownTimeRef.current = Date.now();
        // Start recording on mouse down (hold) after a short delay
        setTimeout(() => {
        // Only start if still holding and not already recording
        if (mouseDownTimeRef.current && !isRecording) {
            isHoldRecordingRef.current = true;
            handleAudioRecording();
        }
        }, 200); // 200ms delay to distinguish from click
    };

    const handleAudioMouseUp = () => {
        if (loading) return;

        const holdDuration = mouseDownTimeRef.current
        ? Date.now() - mouseDownTimeRef.current
        : 0;
        mouseDownTimeRef.current = null;

        // If it was a hold action (longer than 200ms) and currently recording, stop it
        if (holdDuration > 200 && isRecording && isHoldRecordingRef.current) {
            handleAudioRecording();
        }
    };

    const handleAudioRecording = async () => {
        if (isRecording) {
        // Stop recording
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== "inactive"
        ) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
        } else {
        // Start recording
        try {
            // Check if we're on localhost or https for microphone access
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

            // Request microphone permission with high quality settings
            const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000, // High quality for better conversion
                channelCount: 1, // Mono for smaller files
            },
            });

            streamRef.current = stream;
            audioChunksRef.current = [];

            // Force WAV format for better compatibility
            let mimeType = "audio/wav";
            let fileExtension = "wav";

            // Check what the browser supports and prefer WAV-compatible formats
            if (MediaRecorder.isTypeSupported("audio/wav")) {
            mimeType = "audio/wav";
            fileExtension = "wav";
            } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")) {
            mimeType = "audio/webm;codecs=pcm";
            fileExtension = "webm"; // We'll convert this to WAV
            } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
            fileExtension = "webm"; // We'll convert this to WAV
            } else {
            // Fallback - we'll convert whatever we get
            mimeType = "audio/webm";
            fileExtension = "webm";
            }

            const mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            audioBitsPerSecond: 128000, // Good quality for conversion
            });

            mediaRecorderRef.current = mediaRecorder;

            // Handle data available event
            mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
            };

            // Handle stop event
            mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, {
                type: mimeType,
            });

            // Convert to WAV format for better compatibility
            await addAudioAttachment({
                localState,
                setLocalState,
                audioBlob,
                type: mimeType,
            });

            // Clean up
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
        } catch (error) {
            console.error("❌ Error starting recording:", error);

            if (error.name === "NotAllowedError") {
            notifyError(
                "Microphone permission denied. Please allow microphone access and try again."
            );
            } else if (error.name === "NotFoundError") {
            notifyError(
                "No microphone found. Please connect a microphone and try again."
            );
            } else if (error.name === "NotSupportedError") {
            notifyError(
                "Microphone access not supported. Please use HTTPS or localhost."
            );
            } else {
            notifyError(
                "Failed to start recording. Please check your microphone and permissions."
            );
            }

            setIsRecording(false);
        }
        }
    };


    return isAudioSupported && (
         <>
            <Tooltip
            text={
                isRecording
                ? t("common.record_stop")
                : t("common.record_start")
            }
            >
            <button
                className={`h-[30px] w-[30px] cursor-pointer transition-all duration-200 flex items-center justify-center rounded-full ${
                isRecording
                    ? "bg-red-500 border-2 border-red-600 animate-pulse"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                }`}
                type="button"
                onClick={handleAudioClick}
                onMouseDown={handleAudioMouseDown}
                onMouseUp={handleAudioMouseUp}
                onMouseLeave={handleAudioMouseUp} // Stop recording if mouse leaves while holding
                onTouchStart={handleAudioMouseDown} // Mobile support
                onTouchEnd={handleAudioMouseUp} // Mobile support
                disabled={loading}
            >
                {isRecording ? (
                // Stop icon when recording
                <div className="w-3 h-3 bg-white rounded-sm"></div>
                ) : (
                // Microphone icon when not recording
                <img
                    className="h-[18px] w-[18px]"
                    src={icon_mic}
                    alt="microphone"
                />
                )}
            </button>
            </Tooltip>
        </>
    );
}