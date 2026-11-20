// Upstream calls used by the agent's tools. They go to the same backend as plain chat
// (backendPath), which adds the credentials. Agent mode is switched on by front.json modules.agent.
import getModelDefaults from "../config/getModelDefaults";
import { authHeaders, getApiKey } from "./authHeaders";
import { resolveBaseURL } from "./openaiClient";
import { e2eeFetch } from "../e2ee/fetch";

export const agentEndpoint = () => resolveBaseURL().replace(/\/$/, "");
export { isAgentEnabled } from "../utils/modules";

// pi-ai insists on a key. `back` ignores it and adds the real one, so the placeholder only has
// to be non-empty. A direct endpoint (a SAIA engine) checks it, so the configured key wins.
const PROXY_KEY = "set-by-backend";
export const agentApiKey = () => getApiKey() || PROXY_KEY;
/** Request headers for the agent's own upstream calls (auth plus caller headers). */
export const agentRequestHeaders = () => authHeaders();
// Arcana in agent mode runs in the SAIA gateway. On unless front.json sets agentGatewayTools
// to false, in which case agent requests reach the plain chat endpoint without gateway fields. Web search is an
// agent tool of its own (agent/tools.ts) and does not need the gateway.
export const agentGatewayTools = () => import.meta.env.VITE_AGENT_GATEWAY_TOOLS !== "false";

// Models whose server rejected a request with tools during this session
const toollessModels = new Set<string>();
export const markToolless = (modelId: string) => toollessModels.add(modelId);

/**
 * Whether the agent may offer tools to this model.
 *
 * "External" in a display name is a routing and accounting label, not a capability: models
 * served through a bridge carry it so the engine's demand updater skips them, while the engine
 * explicitly keeps their tools in the request body. Tool support therefore comes from data:
 * `external` in the extended /models response, `"tools": false` (or `true`) in
 * config/models/<id>.json, or a rejection learned at runtime (`markToolless`). Anything else
 * starts with tools; `runAgent` retries without them if the first request is rejected.
 */
export function modelSupportsTools(model: { id?: string; name?: string; external?: boolean } | undefined) {
  if (!model?.id) return true;
  if (toollessModels.has(model.id)) return false;
  const configured = getModelDefaults(model.id)?.tools;
  if (configured === true) return true;
  if (configured === false) return false;
  return model.external !== true;
}

const blob = (data: Uint8Array, type = "") => new Blob([data as Uint8Array<ArrayBuffer>], { type });

// These tools do not compute anything themselves: the engine forwards each route to a separate
// service of its registry. When that service is not registered (or has no instance), the engine
// answers 404 `{"detail":"Unknown model/service"}` on the non-chat routes, or names the service in
// an `error.message` ("No instance available for service '<name>'"). Neither body says which
// service the route needed, so a model reporting the failure can only repeat the opaque text.
const UPSTREAM_SERVICE: Record<string, string> = {
  "/documents/convert/file": "docling-serve",
  "/audio/transcriptions": "whisperx",
  "/audio/speech": "kokoro-82m",
  "/images/generations": "flux",
  "/images/edits": "image-edit-2511",
};

/** Why a 404/503 means "this deployment cannot do that", appended to the raw body. */
const missingServiceHint = (path: string, status: number, body: string) => {
  if (status !== 404 && status !== 503) return "";
  if (!/unknown model\/service|no instance available/i.test(body)) return "";
  const named = /service '([^']+)'/i.exec(body)?.[1];
  const service = named || UPSTREAM_SERVICE[path];
  if (!service) return "";
  return `\nThe deployment's SAIA registry has no "${service}" service (or no instance of it), so ${path} never reached one. Chat, document conversion and media generation each need their own registered service; only the deployment's administrator can add one.`;
};

async function post(path: string, body: BodyInit, json = false, signal?: AbortSignal) {
  const headers = { ...(json ? { "Content-Type": "application/json" } : {}), ...agentRequestHeaders() };
  // `e2eeFetch` only rewrites keyed-model `/chat/completions` calls (explainImage);
  // every other endpoint passes through untouched.
  const response = await e2eeFetch(`${agentEndpoint()}${path}`, {
    method: "POST",
    body,
    signal,
    headers: Object.keys(headers).length ? headers : undefined,
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`${path} failed: ${response.status} ${body}${missingServiceHint(path, response.status, body)}`);
  }
  return response;
}

/** Converts a document (PDF, DOCX, PPTX, ...) to Markdown. */
export async function convertDocument(data: Uint8Array, name: string, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  // Same request as the chat upload (apis/processFile.jsx); saia-engine forwards it to docling as is
  form.append("files", blob(data), name);
  form.append("to_formats", "md");
  form.append("image_export_mode", "placeholder");
  form.append("include_images", "false");
  const result = await (await post("/documents/convert/file", form, false, signal)).json();
  return result?.document?.md_content ?? "";
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

export interface WebSearchOptions {
  count?: number;
  page?: number;
  language?: string;
  country?: string;
  safesearch?: "off" | "strict";
  freshness?: "day" | "week" | "month" | "year";
}
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Web search through saia-engine's /websearch (POST /v1/websearch for API keys). One query is one billed unit. */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {},
  signal?: AbortSignal,
): Promise<{ query: string; results: WebSearchResult[]; has_more: boolean }> {
  // The endpoint forbids unknown and null fields
  const body = Object.fromEntries(Object.entries({ query, ...options }).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  return (await post("/websearch", JSON.stringify(body), true, signal)).json();
}
