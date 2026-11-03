import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { Model } from "@earendil-works/pi-ai";

import { resolveBaseURL } from "../apis/openaiClient";

export const DEFAULT_AGENT_MODEL = "deepseek-v4.1-flash-1017";

const PREFERRED_MODEL_IDS = [
  "deepseek-v4.1-flash-1017",
  "deepseek-v4-flash-0731",
  "glm-5.3",
  "kimi-k3",
  "qwen3-30b-a3b-instruct-2507",
];

export type AgentModelInfo = { id: string; name?: string };

export function pickDefaultAgentModel(models: AgentModelInfo[]): AgentModelInfo | null {
  if (!Array.isArray(models) || models.length === 0) return null;
  const configured = import.meta.env.VITE_AGENT_MODEL as string | undefined;
  const wanted = [configured, DEFAULT_AGENT_MODEL, ...PREFERRED_MODEL_IDS]
    .filter(Boolean)
    .map((id) => id!.toLowerCase());
  for (const id of wanted) {
    const match = models.find((model) => model.id?.toLowerCase() === id);
    if (match) return match;
  }
  return models[0];
}

/**
 * Build the pi-ai model description for the app's own backend proxy. The proxy
 * exposes the OpenAI-compatible POST /chat/completions route, so the base URL
 * is simply the configured backend endpoint without a trailing slash.
 */
export function createPiModel(modelId: string, modelName?: string): Model<"openai-completions"> {
  const baseUrl = resolveBaseURL().replace(/\/+$/, "");
  return {
    id: modelId,
    name: modelName || modelId,
    api: "openai-completions",
    provider: "chat-ai",
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 32000,
    compat: {
      // The gateway is OpenAI-compatible but does not implement the newer
      // `developer` role or reasoning_effort for every model.
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  } as Model<"openai-completions">;
}

export function createAgentStreamFn(
  getSampling: () => { temperature?: number; top_p?: number },
) {
  const api = openAICompletionsApi();
  return (model: any, context: any, options: any = {}) => {
    const sampling = getSampling() || {};
    return api.streamSimple(model, context, {
      ...options,
      apiKey: "not-needed",
      headers: { Authorization: null },
      temperature: sampling.temperature,
      samplingParams: {
        ...(options.samplingParams ?? {}),
        ...(typeof sampling.top_p === "number" ? { top_p: sampling.top_p } : {}),
      },
    });
  };
}
