import { modelSupportsTools } from "../apis/agentEndpoints";
import { brandChatTool } from "../config/brandFeatures";
import { isExternalModel } from "../config/brandPolicy";
import { isToolsEnabled } from "./modules";

/**
 * The app-side function tools a brand feature contributes to this chat, or null
 * when there is nothing to offer.
 *
 * A model without tool support never gets one. A chat whose request goes to the
 * tool gateway (`enable_tools`) cannot carry them either: the gateway owns that
 * request and drops function tools, so the feature stays quiet instead of
 * promising a block the reply cannot produce.
 */
export function brandChatToolsFor({ model, settings, persona } = {}) {
  if (!modelSupportsTools(model)) return null;
  const gateway =
    isToolsEnabled() && !isExternalModel(model) && Boolean(settings?.enable_tools);
  if (gateway) return null;
  return brandChatTool({ model, persona });
}
