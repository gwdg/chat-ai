// Converts a file to base64 string format using FileReader
export const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
    });
};

// function to convert base64 to a File object
export function dataURLtoFile(dataurl, filenameWithoutExt, mimeType = null) {
    const arr = dataurl.split(',');
    let mime;
    try {
        mime = mimeType || arr[0].match(/:(.*?);/)[1];
    } catch (err) {
        console.log("Failed to extract mimeType of file")
        return null;
    }
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    // derive extension from MIME type
    const extension = mime.split('/')[1]; // e.g. "image/png" → "png"
    return new File([u8arr], `${filenameWithoutExt}.${extension}`, { type: mime });
}


// Read file content as text
export const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
    });
};

const CODE_EXTENSIONS = [
  "py",
  "js",
  "java",
  "cpp",
  "c",
  "h",
  "cs",
  "rb",
  "php",
  "go",
  "rs",
  "swift",
  "kt",
  "ts",
  "jsx",
  "tsx",
  "html",
  "json",
  "txt",
  "md",
  "tex",
  "xml",
  "yaml",
  "yml",
  "ini",
  "toml",
  "properties",
  "css",
  "scss",
  "sass",
  "less",
  "sh",
  "ps1",
  "pl",
  "lua",
  "r",
  "m",
  "mat",
  "asm",
  "sql",
  "ipynb",
  "rmd",
  "dockerfile",
  "proto",
  "cfg",
  "bat",
];

// Get file type
export const getFileType = (file) => {
    // Attempt to use MIME type
    if (file?.type?.startsWith("audio/")) return "audio";
    if (file?.type?.startsWith("application/pdf")) return "pdf";
    if (file?.type?.startsWith("image/")) return "image";
    if (file?.type?.startsWith("video/")) return "video";
    if (file?.type?.startsWith("text/csv")) return "csv";
    if (file?.type?.startsWith("text/markdown")) return "markdown";
    if (file?.type?.startsWith("text/x-code")) return "code";
    if (file?.type?.startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) return "excel";
    if (file?.type?.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) return "docx";
    
    // Attempt to use file extension
    if (file?.name) {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "pdf") return "pdf";
      if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
      if (["mp4", "avi", "mov"].includes(ext)) return "video";
      if (["mp3", "wav", "ogg"].includes(ext)) return "audio";
      if (["csv"].includes(ext)) return "csv";
      if (["md", "markdown"].includes(ext)) return "markdown";
      if (["txt"].includes(ext)) return "text";
      if (CODE_EXTENSIONS.includes(ext)) return "code";
    }
    // Failed to find file type
    return "unknown";
};

// Format CSV text for display
const formatCSVText = (csvText) => {
    const rows = csvText.split("\n");
    const formattedRows = rows.map((row) => row.split(",").join(" | "));
    return formattedRows.join("\n");
};


const setAttachments = ({
    localState,
    setLocalState,
    newAttachments
}) => {
    setLocalState((prev) => {
    const messages = [...prev.messages]; // shallow copy
    messages[messages.length - 1] = {
        role: "user",
        content: [
        messages[messages.length - 1].content[0],
        ...newAttachments
        ]
    };
    return { ...prev, messages };
    });
};

const appendAttachments = ({
    localState,
    setLocalState,
    newAttachments,
}) => {
    const attachments = localState.messages[localState.messages.length - 1].content.slice(1);
    setAttachments({
        localState,
        setLocalState,
        newAttachments: [...attachments, ...newAttachments]
    });
};

// Add media attachments
const addAttachments = async ({
    localState,
    setLocalState,
    notifySuccess,
    notifyError,
    selectedFiles,
    saveFile,
}) => {
    
    try {

    // Validate generic file types
    const files = Array.from(selectedFiles).filter((file) => {
        return (getFileType(file) !== "unknown");
    });
    // Notify if unsupported files were removed
    if (files.length !== selectedFiles.length) {
        console.error("❌ Some files are not supported");
        notifyError("Unsupported File Type(s)");
        return;
    }

    // Further validate files
    const validFiles = [];
    for (const file of files) {
        try {
            const mimeType = file.type;

            // Ensure file does not exceed size limit
            const isAudio = mimeType.startsWith("audio/");
            const fileLimit = isAudio ? 25 * 1024 * 1024 : 50 * 1024 * 1024; // 25MB for audio, 50MB for media
            const fileLimitText = isAudio ? "25MB" : "50MB";
            if (file.size > fileLimit) {
                notifyError(
                    `File too large: ${file.name} Maximum size is ${fileLimitText}.`
                );
                continue;
            }

            // Ensure media type is supported
            if (mimeType.startsWith("image/")) {
                if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType))
                    continue;
            } else if (mimeType.startsWith("audio/")) {
                if (!["audio/mpeg","audio/mp3","audio/wav","audio/wave","audio/x-wav"].includes(mimeType))
                    continue;
            } else if (mimeType.startsWith("video/")) {
                if (!["video/mp4","video/avi","video/msvideo"].includes(mimeType))
                    continue;
            }

            // All checks successful - keep file
            validFiles.push(file);
        } catch (err) {
            notifyError(`Error while attaching ${file.name}.`);
        }
    }

    // If no valid files, return early
    if (validFiles.length === 0) {
        return;
    }

    // Process valid files
    const newAttachments = [];
    for (const file of validFiles) {
        // TODO check if files can be processed
        const fileId = saveFile(localState.messages[localState.messages.length-1].id, file)
        newAttachments.push({"type": "file", "fileId": fileId});
    }

    // Update state with new files
    appendAttachments({
        localState,
        setLocalState,
        newAttachments: newAttachments
    });

    // Notify success
    notifySuccess("File(s) attached");

    // e.target.value = "";
    } catch (error) {
        console.log(error)
    notifyError(`An error occurred: ${error.message}`);
    }
};

// Convert audio blob to WAV format using Web Audio API
const convertToWav = async (audioBlob) => {
    try {
    // Create audio context
    const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000, // Common sample rate for better compatibility
    });

    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Convert to WAV
    const wavArrayBuffer = audioBufferToWav(audioBuffer);
    const wavBlob = new Blob([wavArrayBuffer], { type: "audio/wav" });

    // Close audio context to free resources
    audioContext.close();

    return wavBlob;
    } catch (error) {
    console.error("Error converting to WAV:", error);
    throw error; // Re-throw the error so it can be caught by the caller
    }
};

// Convert AudioBuffer to WAV format
const audioBufferToWav = (audioBuffer) => {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const result = new ArrayBuffer(44 + audioBuffer.length * numChannels * 2);
    const view = new DataView(result);

    // WAV header
    const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
    };

    let offset = 0;
    writeString(offset, "RIFF");
    offset += 4;
    view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true);
    offset += 4;
    writeString(offset, "WAVE");
    offset += 4;
    writeString(offset, "fmt ");
    offset += 4;
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, format, true);
    offset += 2;
    view.setUint16(offset, numChannels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, (sampleRate * numChannels * bitDepth) / 8, true);
    offset += 4;
    view.setUint16(offset, (numChannels * bitDepth) / 8, true);
    offset += 2;
    view.setUint16(offset, bitDepth, true);
    offset += 2;
    writeString(offset, "data");
    offset += 4;
    view.setUint32(offset, audioBuffer.length * numChannels * 2, true);
    offset += 4;

    // Convert float audio data to 16-bit PCM
    const channels = [];
    for (let channel = 0; channel < numChannels; channel++) {
    channels.push(audioBuffer.getChannelData(channel));
    }

    let sampleIndex = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
        );
        offset += 2;
    }
    }

    return result;
};

const addAudioAttachment = async ({
    localState,
    setLocalState,
    notifyError,
    notifySuccess,
    audioBlob,
    type,
    saveFile,
}) => {
// Convert recorded audio to WAV format for better compatibility
    try {
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `recording_${timestamp}.wav`;

    // Check file size (25MB limit - adjust as needed for your use case)
    if (audioBlob.size > 25 * 1024 * 1024) {
        console.error(`❌ File too large: ${audioBlob.size} bytes`);
        notifyError(
        `Audio file too large: ${fileName}. Maximum supported size is 25MB.`
        );
        return;
    }

    let wavBlob;
    console.log("Type is ", type)
    // If it's already WAV, use it directly
    if (type.includes("wav")) {
        wavBlob = audioBlob;
    } else {
        // Convert WebM/other formats to WAV
        wavBlob = await convertToWav(audioBlob);
    }

    // Convert WAV blob to base64
    const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
        // Remove the data URL prefix to get raw base64
        const result = reader.result.split(",")[1];

        resolve(result);
        };
        reader.onerror = (error) => {
        console.error("❌ FileReader error:", error);
        reject(error);
        };
        reader.readAsDataURL(wavBlob);
    });

    // Create file object in the format expected by your system
    const file = new File([wavBlob], fileName, { type: "audio/wav" });
    const fileId = saveFile(localState.messages[localState.messages.length-1].id, file)
    appendAttachments({
        localState,
        setLocalState,
        newAttachments: [{"type": "file", "fileId": fileId}]
    });

    notifySuccess("Audio recorded and converted to WAV successfully");
    } catch (error) {
    notifyError(`Error processing recorded audio: ${error.message}`);
    }
};

const pasteAttachments = async ({
    localState,
    setLocalState,
    notifyError,
    notifySuccess,
    clipboardData,
    saveFile
}) => {
    try {
        const clipboardItems = clipboardData.items;
        const imageItems = [];

        // Extract image items from clipboard
        for (const item of clipboardItems) {
            if (item.type.startsWith("image/")) {
                const f = item.getAsFile();
                if (f) {
                    imageItems.push(f);
                }
            }
        }

        if (imageItems.length > 0) {
            const newAttachments = [];
            // Process each pasted image
            for (const img of imageItems) {
                const timestamp = new Date()
                .toISOString()
                .replace(/[-:.]/g, "")
                .slice(0, 15);
                const ext = img.type.split("/")[1] || "png";
                const imageName = `clipboard_${timestamp}.${ext}`;
                const file = new File([img], imageName, { type: img.type });
                const fileId = saveFile(localState.messages[localState.messages.length-1].id, file)
                newAttachments.push({"type": "file", "fileId": fileId});
            }
            appendAttachments({
                localState,
                setLocalState,
                newAttachments
            });
            notifySuccess("Image pasted from clipboard");
        }
    } catch (error) {
        console.log(error)
        notifyError("An error occurred while pasting: ", error);
    }
};

export { addAttachments, addAudioAttachment, pasteAttachments };