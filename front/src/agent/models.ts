import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { Model } from "@earendil-works/pi-ai";

import { resolveBaseURL } from "../apis/openaiClient";

export {
  DEFAULT_AGENT_MODEL,
  pickDefaultAgentModel,
  type AgentModelInfo,
} from "./modelSelection";

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
