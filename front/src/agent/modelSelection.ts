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
