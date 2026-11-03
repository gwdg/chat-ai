// Upstream calls used by the agent's tools. They go through the agent proxy
// (VITE_AGENT_ENDPOINT, e.g. http://localhost:8081/agent), a route of back/ that adds the API key.
import getModelDefaults from "../config/getModelDefaults";

export const agentEndpoint = () => (import.meta.env.VITE_AGENT_ENDPOINT || "").replace(/\/$/, "");
export const isAgentEnabled = () => !!agentEndpoint();
// Web search and arcana in agent mode run in the SAIA gateway. Off unless front.json sets
// agentGatewayTools, so agent requests reach the plain chat endpoint without gateway fields.
export const agentGatewayTools = () => import.meta.env.VITE_AGENT_GATEWAY_TOOLS === "true";

// Models whose server rejected a request with tools during this session
const toollessModels = new Set<string>();
export const markToolless = (modelId: string) => toollessModels.add(modelId);

/**
 * Whether the agent may offer tools to this model. External models get none; a model whose
 * server has no tool calling is marked with `"tools": false` in config/models/<id>.json, or
 * found out at runtime.
 */
export function modelSupportsTools(model: { id?: string; name?: string } | undefined) {
  if ((model?.name ?? "").toLowerCase().includes("external")) return false;
  if (!model?.id) return true;
  return getModelDefaults(model.id)?.tools !== false && !toollessModels.has(model.id);
}

const blob = (data: Uint8Array, type = "") => new Blob([data as Uint8Array<ArrayBuffer>], { type });

async function post(path: string, body: BodyInit, json = false, signal?: AbortSignal) {
  const response = await fetch(`${agentEndpoint()}${path}`, {
    method: "POST",
    body,
    signal,
    headers: json ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${(await response.text()).slice(0, 500)}`);
  return response;
}

/** Converts a document (PDF, DOCX, PPTX, ...) to Markdown. */
export async function convertDocument(data: Uint8Array, name: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("document", blob(data), name);
  const result = await (await post("/documents/convert", form, false, signal)).json();
  return result?.markdown ?? "";
}

export async function transcribeAudio(data: Uint8Array, name: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("model", "whisper");
  form.append("file", blob(data), name);
  const result = await (await post("/audio/transcriptions", form, false, signal)).json();
  return result?.text ?? "";
}

export const SPEECH_MODEL = "speaches-ai/Kokoro-82M-v1.0-ONNX";
export const DEFAULT_VOICE = "bf_alice";

export async function generateSpeech(input: string, voice = DEFAULT_VOICE, signal?: AbortSignal): Promise<Uint8Array> {
  const body = JSON.stringify({ model: SPEECH_MODEL, input, voice, response_format: "mp3" });
  return new Uint8Array(await (await post("/audio/speech", body, true, signal)).arrayBuffer());
}

/** Image responses come either as OpenAI JSON ({data: [{b64_json}]}) or as raw image bytes. */
async function readImage(response: Response): Promise<Uint8Array> {
  if (!(response.headers.get("content-type") ?? "").includes("json")) return new Uint8Array(await response.arrayBuffer());
  const result = await response.json();
  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) throw new Error("The image endpoint returned no image");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export const EXPLAIN_IMAGE_MODEL = () => import.meta.env.VITE_EXPLAIN_IMAGE_MODEL || "gemma-4-31b-it";

/** Asks the vision model about an image, for agent models that cannot see images themselves. */
export async function explainImage(image: Uint8Array, mimeType: string, question: string, signal?: AbortSignal): Promise<string> {
  let binary = "";
  for (let i = 0; i < image.length; i += 0x8000) binary += String.fromCharCode(...image.subarray(i, i + 0x8000));
  const body = JSON.stringify({
    model: EXPLAIN_IMAGE_MODEL(),
    stream: false,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: question },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${btoa(binary)}` } },
      ],
    }],
  });
  const result = await (await post("/chat/completions", body, true, signal)).json();
  const answer = result?.choices?.[0]?.message?.content;
  if (!answer) throw new Error("The image model returned no description");
  return answer.trim();
}

export async function generateImage(prompt: string, size?: string, signal?: AbortSignal): Promise<Uint8Array> {
  const body = JSON.stringify({ prompt, n: 1, ...(size ? { size } : {}) });
  return readImage(await post("/images/generations", body, true, signal));
}

export async function editImage(image: Uint8Array, name: string, prompt: string, signal?: AbortSignal): Promise<Uint8Array> {
  const form = new FormData();
  form.append("image", blob(image, "image/png"), name);
  form.append("prompt", prompt);
  return readImage(await post("/images/edits", form, false, signal));
}
