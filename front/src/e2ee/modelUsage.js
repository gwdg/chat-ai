// Which internal feature uses which model.
//
// The Encryption tab lists encrypted models plus the models that run in the
// background, so a user can see what leaves the browser even when they never
// picked that model in a chat. The selection mirrors the call sites:
// - generateTitle / generateConversationOrganization: VITE_TITLE_GENERATION_MODEL
// - generateMemory: VITE_MEMORY_GENERATION_MODEL
// - generateChoiceProposal: VITE_PROPOSAL_GENERATION_MODEL (Choices module)
// - generateConversationSummary: the user's default chat model (`getDefaultChatAIModel`)
// - explainImage: VITE_EXPLAIN_IMAGE_MODEL (browser agent, default gemma)
// Without their own key, the first three fall back to VITE_DEFAULT_SETTINGS.model.id.

/** The deployment's default chat model, as `getDefaultSettings()` resolves it. */
export function envDefaultModelId(env = import.meta.env) {
  try {
    return JSON.parse(env.VITE_DEFAULT_SETTINGS ?? "")?.model?.id ?? "";
  } catch {
    return "";
  }
}

/**
 * @param {object} env
 * @param {{defaultModelId?: string, summaries?: boolean}} options
 *   `defaultModelId` is the user's default chat model; `summaries` mirrors
 *   `user_settings.conversation_summaries`.
 * @returns {Map<string, string[]>} model id → feature ids, in a stable order.
 *   Features: titles, memory, proposals, summaries, image_analysis.
 */
export function internalModelUsage(
  env = import.meta.env,
  { defaultModelId = "", summaries = true } = {},
) {
  const fallback = envDefaultModelId(env);
  const usage = new Map();

  const add = (modelId, feature) => {
    if (!modelId) return;
    const list = usage.get(modelId) ?? [];
    if (!list.includes(feature)) list.push(feature);
    usage.set(modelId, list);
  };

  add(env.VITE_TITLE_GENERATION_MODEL || fallback, "titles");
  add(env.VITE_MEMORY_GENERATION_MODEL || fallback, "memory");
  if (env.VITE_MODULE_CHOICES === "true") {
    add(env.VITE_PROPOSAL_GENERATION_MODEL || fallback, "proposals");
  }
  if (summaries) {
    add(
      defaultModelId || fallback || env.VITE_TITLE_GENERATION_MODEL,
      "summaries",
    );
  }
  if (env.VITE_MODULE_AGENT === "true") {
    add(env.VITE_EXPLAIN_IMAGE_MODEL || "gemma-4-31b-it", "image_analysis");
  }

  return usage;
}
