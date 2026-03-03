import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import AbortButton from "./AbortButton";
import SendButton from "./SendButton";
import MicButton from "./MicButton";
import AttachmentsContainer from "./AttachmentsContainer";
import SettingsButton from "../Header/SettingsButton";
import AttachButton from "./AttachButton";
import AttachMediaButton from "./AttachMediaButton";
import ClearButton from "./ClearButton";
import PromptTextArea from "./PromptTextArea";
import SpeechModePanel from "./SpeechModePanel";

import { useSendMessage } from "../../hooks/useSendMessage";
import { useDebounce } from "../../hooks/useDebounce";
import { useAttachments } from "../../hooks/useAttachments";
import { AudioWaveform } from "lucide-react";
import { abortRequest, chatCompletions, chatCompletionOnce } from "../../apis/chatCompletions";
import { processContentItems } from "../../utils/sendMessage";
import { loadFile, loadFileMeta, saveFile } from "../../db";
import { selectTimeout } from "../../Redux/reducers/userSettingsReducer";

export default function Prompt({
  localState,
  setLocalState,
}) { 
  const { t } = useTranslation();
  const timeout = useSelector(selectTimeout);
  const sendMessage = useSendMessage();
  const { addAudioAttachment } = useAttachments();
  const [shouldSend, setShouldSend] = useState(false);
  const [ignoreChanges, setIgnoreChanges] = useState(false);
  const [speechModeOpen, setSpeechModeOpen] = useState(false);
  const [speechPendingSend, setSpeechPendingSend] = useState(false);
  const [portalRoot, setPortalRoot] = useState(null);
  const [speechPhase, setSpeechPhase] = useState("idle");
  const speechPhaseRef = useRef("idle");
  const localStateRef = useRef(localState);
  const speechPanelRef = useRef(null);
  const speechAudioRef = useRef(null);
  const speechAudioUrlRef = useRef(null);
  const lastPlayedAudioIdRef = useRef(null);
  const speechRequestRef = useRef(false);
  const speechSessionActiveRef = useRef(false);
  const speechStopRequestedRef = useRef(false);
  const previousAttachmentCountRef = useRef(0);
  const lastMessage = localState.messages[localState.messages.length - 1];
  if (lastMessage?.content == undefined){
    // return to a valid conversation
    localState.messages = [{"content" : [{"text" : ""}]}];
  }
  const [prompt, setPrompt] = useState(lastMessage?.content[0]?.text || "");

  //const prompt = localState.messages[localState.messages.length - 1].content[0]?.text || "";
  const attachments = lastMessage.content.slice(1);
  const speechEnabled =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices;
  const speechModelInfo = useMemo(() => {
    return {
      id: "qwen3-30b-a3b-instruct-2507",
      name: "Qwen 3 30B A3B Instruct 2507",
      input: ["text"],
      output: ["text"],
    };
  }, []);
  const speechResponsePrompt = useMemo(
    () =>
      [
        "You are in a live voice conversation.",
        "Respond in a natural, friendly tone with concise answers (1-3 short sentences unless the user asks for more).",
        "Keep it smooth and conversational; ask a brief follow-up question only when it helps the user move forward.",
        "Avoid lists or markdown unless explicitly requested.",
        "Provide spoken audio output and also include a short text transcript of your response.",
        "If the user's message is unclear or empty, ask them to repeat it briefly.",
      ].join("\n"),
    []
  );
  const speechTranscriptionPrompt = useMemo(
    () =>
      [
        "Transcribe the user's audio exactly as spoken.",
        "Return only the transcript text. Do not add commentary or formatting.",
        "If a segment is unclear, use [inaudible].",
      ].join("\n"),
    []
  );
  const speechAudioGenerationPrompt = useMemo(
    () =>
      [
        "You are the speech rendering step of a live voice conversation.",
        "Generate spoken audio for the exact assistant reply text provided by the user.",
        "Always use the audio_generation tool for output.",
        "Do not change wording, tone, or meaning.",
      ].join("\n"),
    []
  );
  const speechRepeatPrompt = useMemo(
    () => t("conversation.speech_mode_repeat_voice"),
    [t]
  );
  const setSpeechPhaseSafe = (nextPhase) => {
    speechPhaseRef.current = nextPhase;
    setSpeechPhase(nextPhase);
  };

  const normalizeSpeechText = (text) => {
    if (typeof text !== "string") return "";
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/\n?-{5,}\n*references:\s*$/i, "")
      .trim();
  };

  const isInvalidSpeechTranscript = (value) => {
    if (!value) return true;
    const normalized = value.toLowerCase().trim();
    if (!normalized) return true;
    const cleaned = normalized.replace(/\[inaudible\]/g, "").trim();
    if (!cleaned) return true;
    // Keep this narrow; over-filtering causes false negatives and repeat loops.
    if (/could not use tools/.test(cleaned)) {
      return true;
    }
    return false;
  };

  const parseJsonSafely = (value) => {
    if (!value) return null;
    let current = value;
    for (let i = 0; i < 2; i += 1) {
      if (typeof current !== "string") break;
      try {
        current = JSON.parse(current);
      } catch {
        break;
      }
    }
    return typeof current === "object" || typeof current === "string"
      ? current
      : null;
  };

  const extractTranscriptFromToolPayload = (payload) => {
    if (!payload) return "";
    if (typeof payload === "string") {
      const raw = payload.trim();
      if (!raw) return "";
      const parsed = parseJsonSafely(raw);
      if (parsed && parsed !== payload) {
        const extracted = extractTranscriptFromToolPayload(parsed);
        if (extracted.trim()) return extracted;
      }
      const transcriptionMatch = raw.match(
        /"transcription"\s*:\s*"((?:\\.|[^"\\])*)"/i
      );
      if (transcriptionMatch?.[1]) {
        return transcriptionMatch[1]
          .replace(/\\"/g, "\"")
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");
      }
      const textMatch = raw.match(/"text"\s*:\s*"((?:\\.|[^"\\])*)"/i);
      if (textMatch?.[1]) {
        return textMatch[1]
          .replace(/\\"/g, "\"")
          .replace(/\\n/g, "\n")
          .replace(/\\\\/g, "\\");
      }
      if (!raw.startsWith("{") && !raw.startsWith("[")) {
        return raw;
      }
      return "";
    }
    if (typeof payload?.transcription === "string") return payload.transcription;
    if (typeof payload?.text === "string") return payload.text;
    if (
      payload?.event === "done" &&
      typeof payload?.transcription === "string"
    ) {
      return payload.transcription;
    }
    return "";
  };

  const extractTranscriptFromChoice = (choice) => {
    if (!choice) return "";
    const message = choice?.message || {};
    let transcript = "";
    const content = message?.content;
    if (typeof content === "string") {
      transcript = content;
    } else if (Array.isArray(content)) {
      transcript = content
        .map((item) => {
          if (typeof item?.text === "string") return item.text;
          if (typeof item?.transcription === "string") return item.transcription;
          return "";
        })
        .filter(Boolean)
        .join("");
    }
    if (transcript.trim()) return transcript;
    if (typeof message?.audio?.transcript === "string") {
      return message.audio.transcript;
    }
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    for (const toolCall of toolCalls) {
      if (
        typeof toolCall?.function?.name === "string" &&
        !toolCall.function.name.includes("audio_transcription")
      ) {
        continue;
      }
      const directExtracted = extractTranscriptFromToolPayload(
        toolCall?.function?.arguments
      );
      if (directExtracted.trim()) return directExtracted;
      const payload = parseJsonSafely(toolCall?.function?.arguments);
      const extracted = extractTranscriptFromToolPayload(
        payload ?? toolCall?.function?.arguments
      );
      if (extracted.trim()) return extracted;
    }
    return "";
  };

  const getLatestAssistantMessage = (state) => {
    const messages = state?.messages || [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") {
        return messages[i];
      }
    }
    return null;
  };

  const getAssistantText = (message) => {
    if (!message || !Array.isArray(message.content)) return "";
    const visibleText = message.content
      .filter((item) => item?.type === "text")
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (visibleText) return visibleText;
    const hiddenText = message?.meta?.speechAssistantText;
    return typeof hiddenText === "string" ? hiddenText.trim() : "";
  };

  const waitForLatestAssistantText = async (maxWaitMs = 12000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      const latestAssistant = getLatestAssistantMessage(localStateRef.current);
      if (latestAssistant && !latestAssistant.loading) {
        const text = getAssistantText(latestAssistant);
        if (text) return text;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const fallbackMessage = getLatestAssistantMessage(localStateRef.current);
    return getAssistantText(fallbackMessage);
  };

  const createAudioFile = (base64Data, format = "wav", filename = null) => {
    const cleanedBase64 = base64Data.includes(",")
      ? base64Data.split(",").pop()
      : base64Data;
    const byteCharacters = atob(cleanedBase64 || "");
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const normalizedFormat = (format || "wav").toLowerCase();
    const mimeType = normalizedFormat === "mp3" ? "audio/mpeg" : `audio/${normalizedFormat}`;
    const safeFilename = filename || `speech-response.${normalizedFormat}`;
    return new File([byteArray], safeFilename, { type: mimeType });
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForFileMetaReady = async (fileId, maxWaitMs = 12000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      const file = await loadFile(fileId);
      if (file) return true;
      await delay(100);
    }
    return false;
  };

  const waitForSpeechAudioAttachments = async (contentItems, maxWaitMs = 12000) => {
    if (!Array.isArray(contentItems) || contentItems.length === 0) return;
    const audioFileIds = contentItems
      .filter((item) => item?.type === "file" && typeof item?.fileId === "string")
      .map((item) => item.fileId);
    if (audioFileIds.length === 0) return;
    await Promise.all(audioFileIds.map((fileId) => waitForFileMetaReady(fileId, maxWaitMs)));
  };

  const hasInputAudioPayload = (content) =>
    Array.isArray(content) &&
    content.some((item) => item?.type === "input_audio");

  const appendAudioToLatestAssistant = (fileId) => {
    if (!fileId) return;
    setLocalState((prev) => {
      const messages = [...prev.messages];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message?.role !== "assistant" || message?.loading) continue;
        const content = Array.isArray(message.content)
          ? [...message.content]
          : [{ type: "text", text: "" }];
        const alreadyAttached = content.some(
          (item) => item?.type === "file" && item?.fileId === fileId
        );
        if (!alreadyAttached) {
          content.push({ type: "file", fileId });
        }
        messages[i] = { ...message, content };
        return { ...prev, messages, flush: true };
      }
      return prev;
    });
  };

  const appendSpeechAssistantTurn = ({ speechText, fileId = null }) => {
    const text = normalizeSpeechText(speechText);
    if (!text && !fileId) return;
    setLocalState((prev) => {
      const messages = [...prev.messages];
      const assistantContent = [{ type: "text", text: "" }];
      if (fileId) {
        assistantContent.push({ type: "file", fileId });
      }
      const assistantTurn = {
        role: "assistant",
        content: assistantContent,
        loading: false,
        meta: {
          speechAssistantText: text,
        },
      };
      const hasAudioAttachment = (message) =>
        Array.isArray(message?.content) &&
        message.content.some((item) => item?.type === "file");
      const isTrailingEmptyUser =
        messages[messages.length - 1]?.role === "user" &&
        Array.isArray(messages[messages.length - 1]?.content) &&
        !messages[messages.length - 1].content.some((item) => item?.type === "file") &&
        !messages[messages.length - 1].content.some(
          (item) =>
            item?.type === "text" &&
            typeof item?.text === "string" &&
            item.text.trim().length > 0
        );

      if (isTrailingEmptyUser && messages.length >= 2) {
        const lastAssistantIndex = messages.length - 2;
        const lastAssistant = messages[lastAssistantIndex];
        if (
          lastAssistant?.role === "assistant" &&
          !hasAudioAttachment(lastAssistant)
        ) {
          messages[lastAssistantIndex] = {
            ...lastAssistant,
            ...assistantTurn,
            meta: {
              ...(lastAssistant.meta || {}),
              speechAssistantText: text,
            },
          };
          return { ...prev, messages, flush: true };
        }
      }

      if (isTrailingEmptyUser) {
        messages[messages.length - 1] = assistantTurn;
      } else {
        messages.push(assistantTurn);
      }

      messages.push({
        role: "user",
        content: [{ type: "text", text: "" }],
      });
      return { ...prev, messages, flush: true };
    });
  };

  const clearSpeechAudioPlayback = () => {
    if (speechAudioRef.current) {
      speechAudioRef.current.onended = null;
      speechAudioRef.current.onerror = null;
      speechAudioRef.current.pause?.();
      speechAudioRef.current = null;
    }
    if (speechAudioUrlRef.current) {
      URL.revokeObjectURL(speechAudioUrlRef.current);
      speechAudioUrlRef.current = null;
    }
  };

  const interruptSpeechFlow = ({ restartListening = true } = {}) => {
    speechStopRequestedRef.current = true;
    abortRequest();
    speechPanelRef.current?.stopRecording?.();
    clearSpeechAudioPlayback();
    if (!restartListening) {
      setSpeechPhaseSafe("idle");
      return;
    }
    if (speechSessionActiveRef.current) {
      setSpeechPhaseSafe("listening");
      window.setTimeout(() => {
        if (!speechSessionActiveRef.current || !speechModeOpen) return;
        speechStopRequestedRef.current = false;
        speechPanelRef.current?.startRecording?.();
      }, 80);
    }
  };

  const generateSpeechAudioForText = async (assistantText) => {
    const text = normalizeSpeechText(assistantText || "");
    if (!text) return null;
    const timeoutAPI =
      timeout >= 5000 && timeout <= 900000 ? Math.min(timeout, 120000) : 90000;
    const audioGenerationConversation = {
      messages: [
        { role: "system", content: speechAudioGenerationPrompt },
        { role: "user", content: text },
      ],
      settings: {
        model: speechModelInfo.id,
        temperature: 0,
        top_p: 1,
        enable_tools: true,
        tools: [{ type: "audio_generation" }],
      },
    };
    let audioPayload = null;
    try {
      for await (const chunk of chatCompletions(
        audioGenerationConversation,
        timeoutAPI,
        true
      )) {
        if (speechStopRequestedRef.current) {
          return null;
        }
        const delta = chunk?.choices?.[0]?.delta;
        const audioDelta = delta?.audio;
        if (!audioDelta?.data) continue;
        const currentData = String(audioDelta.data || "");
        if (!currentData) continue;
        if (!audioPayload || currentData.length >= (audioPayload.data?.length || 0)) {
          audioPayload = {
            data: currentData,
            format: audioDelta.format || audioPayload?.format || "wav",
            filename: audioDelta.filename || audioPayload?.filename || null,
          };
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return null;
      }
      console.error("Speech audio generation failed:", error);
      return null;
    }
    if (!audioPayload?.data) {
      return null;
    }
    const audioFile = createAudioFile(
      audioPayload.data,
      audioPayload.format,
      audioPayload.filename
    );
    const conversationId = localStateRef.current?.id || localState.id;
    return saveFile(conversationId, audioFile);
  };

  // Update partial local state while preserving other values
  const savePrompt = (nextPrompt = prompt, { clearChoices = false } = {}) => {
    setIgnoreChanges(true);
    setLocalState((prev) => {
      const messages = [...prev.messages]; // shallow copy
      messages[messages.length - 1] = {
        role: "user",
        content: [ { // Replace first content item
            type: "text",
            text: nextPrompt
          }, // Keep other content items
          ...prev.messages[messages.length - 1].content.slice(1)
        ]
      };
      return {
        ...prev,
        messages,
        ...(clearChoices ? { choices: [] } : {}),
      };
    });
  };

  // Effect, watch for changes to prompt in localState
  useEffect(() => {
    if (shouldSend) {
      if (speechRequestRef.current) {
        sendSpeechMessage();
      } else {
        sendMessage({localState, setLocalState});
      }
      setShouldSend(false);
      setIgnoreChanges(false);
      setPrompt("");
    } else if (ignoreChanges) {
      setIgnoreChanges(false); // Ignored once
    } else {
      setPrompt(
        lastMessage?.content[0]?.text || ""
      );
    }
  }, [localState.messages]);

  useEffect(() => {
    speechSessionActiveRef.current = speechModeOpen;
    setSpeechPhaseSafe(speechModeOpen ? "listening" : "idle");
  }, [speechModeOpen]);

  useEffect(() => {
    localStateRef.current = localState;
  }, [localState]);

  useEffect(() => {
    if (!speechModeOpen) {
      setPortalRoot(null);
      return;
    }
    if (typeof document === "undefined") return;
    setPortalRoot(document.getElementById("conversation-shell"));
  }, [speechModeOpen]);

  useEffect(() => {
    if (!speechPendingSend) return;
    if (attachments.length <= previousAttachmentCountRef.current) return;
    const fakeEvent = { preventDefault: () => {} };
    handleSend(fakeEvent, "");
    previousAttachmentCountRef.current = attachments.length;
    setSpeechPendingSend(false);
  }, [speechPendingSend, attachments.length]);

  useEffect(() => {
    if (!speechModeOpen) return;
    const seedLastPlayed = async () => {
      const messages = localState?.messages || [];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message?.role !== "assistant") continue;
        const content = Array.isArray(message.content) ? message.content : [];
        for (const item of content) {
          if (item?.type !== "file" || !item.fileId) continue;
          const meta = await loadFileMeta(item.fileId);
          if (meta?.type?.startsWith("audio/")) {
            lastPlayedAudioIdRef.current = item.fileId;
            return;
          }
        }
        break;
      }
    };
    seedLastPlayed();
  }, [speechModeOpen]);

  useEffect(() => {
    if (!speechModeOpen) return;
    let cancelled = false;
    let retryTimer = null;
    const scheduleRetry = () => {
      if (retryTimer || cancelled) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        if (!cancelled) {
          playLatestSpeechAudio();
        }
      }, 250);
    };
    const playLatestSpeechAudio = async () => {
      if (speechStopRequestedRef.current) return;
      const messages = localState?.messages || [];
      let latestAssistant = null;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === "assistant") {
          latestAssistant = messages[i];
          break;
        }
      }
      if (!latestAssistant || latestAssistant.loading) return;
      const content = Array.isArray(latestAssistant.content)
        ? latestAssistant.content
        : [];
      let audioItem = null;
      let unresolvedAudioMeta = false;
      for (const item of content) {
        if (item?.type !== "file" || !item.fileId) continue;
        const meta = await loadFileMeta(item.fileId);
        if (!meta) {
          unresolvedAudioMeta = true;
          continue;
        }
        if (meta?.type?.startsWith("audio/")) {
          audioItem = item;
          break;
        }
      }
      if (!audioItem?.fileId) {
        if (speechPhaseRef.current === "waiting" && unresolvedAudioMeta) {
          scheduleRetry();
          return;
        }
        if (speechPhaseRef.current === "waiting") {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        return;
      }
      if (audioItem.fileId === lastPlayedAudioIdRef.current) {
        if (speechPhaseRef.current === "waiting") {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        return;
      }
      const file = await loadFile(audioItem.fileId);
      if (!file || cancelled) return;
      const url = URL.createObjectURL(file);
      if (speechAudioUrlRef.current) {
        URL.revokeObjectURL(speechAudioUrlRef.current);
      }
      speechAudioUrlRef.current = url;
      if (speechAudioRef.current) {
        speechAudioRef.current.pause?.();
      }
      const audio = new Audio(url);
      speechAudioRef.current = audio;
      setSpeechPhaseSafe("playing");
      lastPlayedAudioIdRef.current = audioItem.fileId;
      speechPanelRef.current?.stopRecording?.();
      audio.onended = () => {
        if (speechStopRequestedRef.current) return;
        if (speechAudioUrlRef.current) {
          URL.revokeObjectURL(speechAudioUrlRef.current);
          speechAudioUrlRef.current = null;
        }
        if (speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
      };
      audio.onerror = () => {
        if (speechStopRequestedRef.current) return;
        if (speechAudioUrlRef.current) {
          URL.revokeObjectURL(speechAudioUrlRef.current);
          speechAudioUrlRef.current = null;
        }
        if (speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
      };
      try {
        await audio.play();
      } catch (error) {
        if (speechAudioUrlRef.current) {
          URL.revokeObjectURL(speechAudioUrlRef.current);
          speechAudioUrlRef.current = null;
        }
        if (speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        lastPlayedAudioIdRef.current = null;
      }
    };
    playLatestSpeechAudio();
    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [speechModeOpen, localState?.messages]);

  useEffect(() => {
    if (!speechModeOpen) {
      clearSpeechAudioPlayback();
    }
    return () => {
      clearSpeechAudioPlayback();
    };
  }, [speechModeOpen]);

  // Handle changes to the prompt
  const debouncedSave = useDebounce(savePrompt, 300);
  const handleChange = (e) => {
    setPrompt(e.target.value);
    debouncedSave();
  };
  
  // Handle form submission with prompt and files
  const handleSend = async (event, nextPrompt) => {
      event.preventDefault();
      const promptToSend = typeof nextPrompt === "string" ? nextPrompt : prompt;
      if (promptToSend?.trim() === "" && attachments.length === 0) return;
      debouncedSave.cancel();
      savePrompt(promptToSend, { clearChoices: true });
      setShouldSend(true);
  };

  const handleSpeechAudio = async ({ audioBlob, type }) => {
    speechStopRequestedRef.current = false;
    previousAttachmentCountRef.current = attachments.length;
    const latestState = localStateRef.current || localState;
    const didAttach = await addAudioAttachment({
      localState: latestState,
      setLocalState,
      audioBlob,
      type,
    });
    if (!didAttach) {
      setSpeechPendingSend(false);
      return;
    }
    speechRequestRef.current = true;
    setSpeechPhaseSafe("processing");
    setSpeechPendingSend(true);
  };

  const transcribeSpeechAudio = async () => {
    if (speechStopRequestedRef.current) return "";
    try {
      const latestState = localStateRef.current || localState;
      const message = latestState.messages[latestState.messages.length - 1];
      if (!message || !Array.isArray(message.content)) return "";
      await waitForSpeechAudioAttachments(message.content);
      const processedContent = await processContentItems({
        items: message.content,
        ignoreImages: true,
        ignoreVideo: true,
        ignoreDocs: true,
        ignoreAudio: false,
      });
      if (!hasInputAudioPayload(processedContent)) {
        await delay(250);
      }
      const processedContentRetry = hasInputAudioPayload(processedContent)
        ? processedContent
        : await processContentItems({
            items: message.content,
            ignoreImages: true,
            ignoreVideo: true,
            ignoreDocs: true,
            ignoreAudio: false,
          });
      if (!hasInputAudioPayload(processedContentRetry)) {
        console.warn("Speech transcription request missing input_audio payload.");
        return "";
      }
      const timeoutAPI =
        timeout >= 5000 && timeout <= 900000 ? Math.min(timeout, 60000) : 45000;
      const buildTranscriptionConversation = (withTool = true) => ({
        messages: [
          { role: "system", content: speechTranscriptionPrompt },
          { role: "user", content: processedContentRetry },
        ],
        settings: {
          model: speechModelInfo.id,
          temperature: 0,
          top_p: 1,
          enable_tools: withTool,
          ...(withTool ? { tools: [{ type: "audio_transcription" }] } : {}),
        },
      });

      const transcriptionConversation = buildTranscriptionConversation(true);
      const result = await chatCompletionOnce(transcriptionConversation, timeoutAPI);
      let transcript = extractTranscriptFromChoice(result?.choices?.[0]);

      // Fallback: some backends emit transcription only in streamed tool deltas.
      if (!normalizeSpeechText(transcript)) {
        let streamedTranscript = "";
        const toolCallArgBuffer = {};
        for await (const chunk of chatCompletions(
          transcriptionConversation,
          timeoutAPI,
          true
        )) {
          if (speechStopRequestedRef.current) {
            return "";
          }
          const delta = chunk?.choices?.[0]?.delta;
          if (typeof delta?.content === "string") {
            streamedTranscript += delta.content;
          }
          if (!Array.isArray(delta?.tool_calls)) {
            continue;
          }
          for (const toolCall of delta.tool_calls) {
            const callIndex =
              Number.isInteger(toolCall?.index) && toolCall.index >= 0
                ? toolCall.index
                : 0;
            const argumentChunk =
              typeof toolCall?.function?.arguments === "string"
                ? toolCall.function.arguments
                : "";
            if (!argumentChunk) continue;
            toolCallArgBuffer[callIndex] =
              (toolCallArgBuffer[callIndex] || "") + argumentChunk;
            const parsedPayload = parseJsonSafely(toolCallArgBuffer[callIndex]);
            const extracted = extractTranscriptFromToolPayload(
              parsedPayload ?? toolCallArgBuffer[callIndex]
            );
            if (extracted.trim()) {
              streamedTranscript = extracted;
            }
          }
        }
        transcript = streamedTranscript;
      }
      let normalizedTranscript = normalizeSpeechText(transcript);

      // Fallback: try transcription without tool calls for backends that support audio input directly.
      if (!normalizedTranscript) {
        const plainTranscriptionConversation = buildTranscriptionConversation(false);
        const plainResult = await chatCompletionOnce(
          plainTranscriptionConversation,
          timeoutAPI
        );
        const plainTranscript = extractTranscriptFromChoice(plainResult?.choices?.[0]);
        normalizedTranscript = normalizeSpeechText(plainTranscript);
      }

      return normalizedTranscript;
    } catch (error) {
      if (error?.name === "AbortError") {
        return "";
      }
      console.error("Speech transcription failed:", error);
      return "";
    }
  };

  const respondWithRepeatPrompt = async () => {
    const fallbackText = normalizeSpeechText(speechRepeatPrompt);
    if (!fallbackText || speechStopRequestedRef.current) {
      return false;
    }
    const audioFileId = await generateSpeechAudioForText(fallbackText);
    if (speechStopRequestedRef.current || !audioFileId) {
      return false;
    }
    appendSpeechAssistantTurn({
      speechText: fallbackText,
      fileId: audioFileId,
    });
    setSpeechPhaseSafe("waiting");
    return true;
  };

  const sendSpeechMessage = async () => {
    speechStopRequestedRef.current = false;
    setSpeechPhaseSafe("processing");
    try {
      const transcript = await transcribeSpeechAudio();
      if (speechStopRequestedRef.current) return;
      const normalizedTranscript = (transcript || "").trim();
      if (isInvalidSpeechTranscript(normalizedTranscript)) {
        const generated = await respondWithRepeatPrompt();
        if (!generated && speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        return;
      }
      const latestState = localStateRef.current || localState;
      const apiMessages = [...(latestState.messages || [])];
      const lastIndex = apiMessages.length - 1;
      if (apiMessages[lastIndex]?.role === "user") {
        const content = Array.isArray(apiMessages[lastIndex].content)
          ? [...apiMessages[lastIndex].content]
          : [];
        const meta = {
          ...(apiMessages[lastIndex].meta || {}),
          speechTranscript: normalizedTranscript,
        };
        const textIndex = content.findIndex((item) => item?.type === "text");
        if (textIndex >= 0) {
          content[textIndex] = {
            ...content[textIndex],
            text: normalizedTranscript,
          };
        } else {
          content.unshift({ type: "text", text: normalizedTranscript });
        }
        apiMessages[lastIndex] = {
          ...apiMessages[lastIndex],
          meta,
          content,
        };
        setLocalState((prev) => {
          const messages = [...prev.messages];
          const uiLastIndex = messages.length - 1;
          if (messages[uiLastIndex]?.role !== "user") return prev;
          messages[uiLastIndex] = {
            ...messages[uiLastIndex],
            meta: {
              ...(messages[uiLastIndex].meta || {}),
              speechTranscript: normalizedTranscript,
            },
          };
          return { ...prev, messages, flush: true };
        });
      }
      const contextMessages = apiMessages.map((message) => {
        if (!Array.isArray(message?.content)) {
          return message;
        }
        return {
          ...message,
          content: message.content.filter((item) => item?.type !== "file"),
        };
      });
      const speechLocalState = {
        ...latestState,
        messages: contextMessages,
      };
      const sendResult = await sendMessage({
        localState: speechLocalState,
        setLocalState,
        options: {
          modelOverride: speechModelInfo,
          forceEnableTools: false,
          includeAudioTranscription: false,
          systemPromptAddon: speechResponsePrompt,
          forceAudioInput: false,
          forceIgnoreAudio: true,
          skipArcanaMcp: true,
          hideAssistantTextInUi: true,
          persistAssistantSpeechText: true,
          suppressErrorToast: true,
          skipPostProcessing: true,
        },
      });
      if (speechStopRequestedRef.current) return;
      const assistantTextFromResult =
        typeof sendResult?.assistantText === "string"
          ? sendResult.assistantText.trim()
          : "";
      const assistantText = (
        assistantTextFromResult || await waitForLatestAssistantText()
      ).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      if (!assistantText) {
        const generated = await respondWithRepeatPrompt();
        if (!generated && speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        return;
      }
      const audioFileId = await generateSpeechAudioForText(assistantText);
      if (speechStopRequestedRef.current) return;
      if (!audioFileId) {
        const generated = await respondWithRepeatPrompt();
        if (!generated && speechSessionActiveRef.current) {
          setSpeechPhaseSafe("listening");
          speechPanelRef.current?.startRecording?.();
        }
        return;
      }
      appendAudioToLatestAssistant(audioFileId);
      setSpeechPhaseSafe("waiting");
    } catch (error) {
      if (error?.name === "AbortError" || speechStopRequestedRef.current) {
        return;
      }
      console.error("Speech message flow failed:", error);
      const generated = await respondWithRepeatPrompt();
      if (!generated && speechSessionActiveRef.current) {
        setSpeechPhaseSafe("listening");
        speechPanelRef.current?.startRecording?.();
      }
    } finally {
      speechRequestRef.current = false;
      if (!speechStopRequestedRef.current && speechPhaseRef.current === "processing") {
        setSpeechPhaseSafe("waiting");
      }
    }
  };

  const handleSpeechInterrupt = () => {
    interruptSpeechFlow({ restartListening: true });
  };

  const handleSpeechClose = () => {
    interruptSpeechFlow({ restartListening: false });
    setSpeechModeOpen(false);
  };
  
  return (
    <div className="prompt-area overflow-x-hidden w-full flex flex-shrink-0 flex-col bg-white dark:bg-bg_secondary_dark dark:text-white text-black mobile:h-fit justify-center sm:overflow-y-auto rounded-2xl shadow-bottom dark:shadow-darkBottom">
        {speechModeOpen && portalRoot &&
          createPortal(
            <div className="absolute inset-0 z-50 bg-slate-100 dark:bg-black">
              <SpeechModePanel
                ref={speechPanelRef}
                onClose={handleSpeechClose}
                onInterrupt={handleSpeechInterrupt}
                onAudioCaptured={handleSpeechAudio}
                phase={speechPhase}
                autoStart
              />
            </div>,
            portalRoot
          )
        }
        {/* Attachments Container */}
        {!speechModeOpen && (
          <AttachmentsContainer
            localState={localState}
            setLocalState={setLocalState}
          />
        )}
        <div className={`flex flex-col gap-4 mobile:gap-2 w-full relative select-none rounded-2xl shadow-lg dark:text-white text-black bg-white dark:bg-bg_secondary_dark`} >
          <div className="relative">
            {/* Prompt Text Area */}
            <PromptTextArea
              localState={localState}
              setLocalState={setLocalState}
              handleSend={handleSend}
              handleChange={handleChange}
              prompt={prompt}
            />
            {/* Mobile Floating Controls */}
            {!speechModeOpen && (
              <div className="hidden mobile:flex absolute right-2.5 bottom-2.5 z-20 items-center gap-1.5 rounded-full border border-gray-200/90 dark:border-gray-700/90 bg-white/95 dark:bg-bg_secondary_dark/95 backdrop-blur-sm px-2 py-1.5 shadow-md">
                <ClearButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {speechEnabled && (
                  <button
                    type="button"
                    onClick={() => setSpeechModeOpen(true)}
                    className="cursor-pointer h-7 w-7 rounded-full bg-tertiary text-white shadow hover:bg-[#008ac2] transition-all duration-200 flex items-center justify-center"
                    aria-label={t("conversation.speech_mode_button")}
                    title={t("conversation.speech_mode_button")}
                  >
                    <AudioWaveform className="h-4 w-4" />
                  </button>
                )}
                <AttachButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                <MicButton 
                  localState={localState}
                  setLocalState={setLocalState}
                />
                <AbortButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                <SendButton
                  localState={localState}
                  setLocalState={setLocalState}
                  handleSend={handleSend}
                  prompt={prompt}
                />
              </div>
            )}
          </div>
          {/* Desktop / Tablet Buttons Section */}
          {!speechModeOpen && (
            <div className="mobile:hidden px-3 py-2 w-full h-fit grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-white dark:bg-bg_secondary_dark rounded-b-2xl relative">
              {/* Clear Button on the left  */}
              <div className="flex items-center">
                <ClearButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
              </div>
              <div className="flex justify-center">
                {speechEnabled && (
                  <button
                    type="button"
                    onClick={() => setSpeechModeOpen(true)}
                    className="cursor-pointer h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-tertiary text-white text-xs sm:text-sm font-semibold shadow-lg hover:bg-[#008ac2] transition-all duration-200 flex items-center justify-center gap-2"
                    aria-label={t("conversation.speech_mode_button")}
                  >
                    <AudioWaveform className="h-4 w-4 sm:h-5 sm:w-5" />
                    {t("conversation.speech_mode_button")}
                  </button>
                )}
              </div>
              {/* Buttons on the right */}
              <div className="flex flex-wrap gap-3 justify-end items-center">
                {/* Settings Button */}
                {/* <SettingsButton /> */}
                {/* Attach Button */}
                <AttachButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* Attach Media Button */}
                {/* <AttachMediaButton
                  localState={localState}
                  setLocalState={setLocalState}
                /> */}
                {/* Mic Button */}
                <MicButton 
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* Abort button (when loading) */}
                <AbortButton
                  localState={localState}
                  setLocalState={setLocalState}
                />
                {/* If not loading, show send button */}
                <SendButton
                  localState={localState}
                  setLocalState={setLocalState}
                  handleSend={handleSend}
                  prompt={prompt}
                />
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
