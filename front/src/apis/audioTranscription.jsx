import { readFileAsBase64 } from "../utils/attachments";
import { chatCompletions } from "./chatCompletions";

const DEFAULT_AUDIO_TRANSCRIPTION_PROMPT = [
  "You are the audio transcription step.",
  "Transcribe the provided audio exactly as spoken.",
  "Always use the audio_transcription tool.",
  "Return only the transcription text with no extra commentary.",
].join("\n");

function getAudioFormat(file) {
  const mimeType = String(file?.type || "").toLowerCase();
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();

  if (mimeType.includes("wav") || extension === "wav") return "wav";
  if (mimeType.includes("ogg") || extension === "ogg") return "ogg";
  return "mp3";
}

export default async function transcribeAudio(
  file,
  {
    model =
      import.meta.env.VITE_AUDIO_TRANSCRIPTION_MODEL ||
      "qwen3-30b-a3b-instruct-2507",
    timeout = 90000,
    temperature = 0,
    topP = 1,
    systemPrompt = DEFAULT_AUDIO_TRANSCRIPTION_PROMPT,
  } = {}
) {
  if (!(file instanceof File)) {
    return null;
  }

  const timeoutAPI =
    timeout >= 5000 && timeout <= 900000 ? Math.min(timeout, 120000) : 90000;
  const base64DataUrl = await readFileAsBase64(file);
  const base64Data = String(base64DataUrl || "").split(",").pop();

  if (!base64Data) {
    return null;
  }

  const conversation = {
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please transcribe this audio recording.",
          },
          {
            type: "input_audio",
            input_audio: {
              data: base64Data,
              format: getAudioFormat(file),
            },
          },
        ],
      },
    ],
    settings: {
      model,
      temperature,
      top_p: topP,
      enable_tools: true,
      tools: [{ type: "audio_transcription" }],
    },
  };

  let transcription = "";

  try {
    for await (const chunk of chatCompletions(conversation, timeoutAPI, true)) {
      const delta = chunk?.choices?.[0]?.delta;

      if (delta?.tool_calls?.[0]?.function?.name === "audio_transcription.event") {
        try {
          let args = delta.tool_calls[0].function.arguments;
          if (typeof args === "string") args = JSON.parse(args);

          if (args?.event === "done" && typeof args?.transcription === "string") {
            transcription = args.transcription.trim();
          }
        } catch (parseError) {
          console.warn("Failed to parse audio transcription tool event:", parseError);
        }
      }

      if (!transcription && typeof delta?.content === "string") {
        transcription += delta.content;
      }
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return null;
    }
    console.error("Audio transcription failed:", error);
    return null;
  }

  return transcription.trim() || null;
}
