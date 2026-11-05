import getModelDefaults from "../config/getModelDefaults";
import { normalizeMcpUrl } from "../agent/mcp";
import { createBackendClient } from "./openaiClient";

// Remote entries carry a server id; local entries carry a URL. Older conversations keep the
// id as a string in mcp_servers.
const gatewayMcpServers = (settings) => {
  const servers = settings?.mcp_servers;
  if (Array.isArray(servers)) {
    const remote = servers
      .filter(
        (server) =>
          server &&
          typeof server.id === "string" &&
          typeof server.url !== "string" &&
          server.enabled !== false,
      )
      .map((server) => server.id.trim())
      .filter(Boolean);
    if (remote.length) return remote;
    const local = normalizeMcpUrl(
      servers.find((server) => server?.enabled && server?.url?.trim())?.url,
    );
    return local ? [local] : [];
  }
  return typeof servers === "string" && servers.trim() ? [servers.trim()] : [];
};

// Request fields that set the reasoning effort for `model`, from its defaults and the conversation settings
export function reasoningParams(model, settings) {
  const params = {};
  const modelDefaults = getModelDefaults(model);
  try {
    if (modelDefaults?.reasoning_effort !== undefined && modelDefaults?.reasoning_effort !== null) {
      let reasoning_effort = modelDefaults.reasoning_effort;
      if (settings?.reasoning_effort !== undefined && settings?.reasoning_effort !== null) {
        reasoning_effort = Math.min(settings.reasoning_effort, modelDefaults.reasoning_options.length - 1)
      }
      if (model?.toLowerCase().startsWith("claude")) {
        // External Claude models
        params.reasoning_effort = modelDefaults.reasoning_options[reasoning_effort];
      }
      else if (model?.toLowerCase().startsWith("openai") && !(model?.toLowerCase().startsWith("openai-gpt-oss"))) {
        // External OpenAI models
        params.reasoning_effort = modelDefaults.reasoning_options[reasoning_effort];
      }
      if (model?.toLowerCase().includes("mistral")) {
        // Internal models that don't use enable_thinking separately
        params.reasoning_effort = modelDefaults.reasoning_options[reasoning_effort];
      }
      else {
        if (reasoning_effort == 0) {
          params.chat_template_kwargs = modelDefaults.reasoning_options[0] == "none" ?
            {enable_thinking: false} : {reasoning_effort: modelDefaults.reasoning_options[0]};
        } else if (modelDefaults.reasoning_options[reasoning_effort] == "on") {
          params.chat_template_kwargs = {enable_thinking: true};
        } else {
          params.chat_template_kwargs = {enable_thinking: true, reasoning_effort: modelDefaults.reasoning_options[reasoning_effort]};
        }
      }
    }
  }  catch {
    console.warn("Could not find reasoning setting")
  }
  return params;
}

// Controller for handling API request cancellation
let controller = new AbortController();

async function* chatCompletions (
  conversation,
  timeout = 30000,
  stream = true,
) {
  try {
    const model = typeof conversation.settings.model === 'string'
      ? conversation.settings.model
      : conversation.settings.model?.id; // TODO fall back to defaultModel

    // Initialize params
    const params = {
      model: model,
      messages: conversation.messages,
      temperature: conversation.settings.temperature,
      top_p: conversation.settings.top_p,
      stream: stream,
      stream_options: {include_usage: true },
    };

    Object.assign(params, reasoningParams(model, conversation.settings));

    // Handle tools
    if (conversation.settings?.enable_tools) {
      params.enable_tools = true;
      params.tools = conversation?.settings?.tools || [];
    }

    // Function tools run by the caller (e.g. the Meta chat's local tools)
    if (Array.isArray(conversation.settings?.function_tools) && conversation.settings.function_tools.length > 0) {
      params.tools = conversation.settings.function_tools;
      if (conversation.settings.tool_choice) params.tool_choice = conversation.settings.tool_choice;
    }

    if (conversation.settings?.arcana && conversation.settings.arcana.id !== "") {
      params.arcana = conversation.settings.arcana;
    }

    if (conversation.settings?.feedback) {
      params.feedback = conversation.settings.feedback;
    }

    // Remote server ids, or the first enabled local server as the gateway server id
    const mcpServers = gatewayMcpServers(conversation.settings);
    if (mcpServers.length) {
      params["mcp-servers"] = mcpServers;
    }

    // Define openai object to call backend
    const openai = createBackendClient(timeout);

    // Get chat completion response
    const streamResponse = await openai.chat.completions.create(
      params, { 
      signal: controller.signal,
    });

    if (!stream) {
      const result = streamResponse;
      console.error("Error:", result);
      return result;
    }

    let answer = ""
    let completed = false
    for await (const chunk of streamResponse) {
      if (chunk?.object == "error") {
        console.error(chunk)
          const err = new Error(chunk?.message || "Unknown error");
          err.type = chunk?.type;
          err.status = chunk?.status || chunk?.code;
          err.code = chunk?.code || chunk?.status;
          throw err;
      }
      try {
        if (!completed) {
          answer += chunk.choices[0].delta?.content || ""
          // yield (chunk.choices[0].delta)
          yield chunk
        } else {
          yield chunk;
          return {
            answer, 
            usage: chunk?.usage || null
          };
        }
        if (chunk?.choices?.[0]?.finish_reason === 'stop') {
          completed = true
        }
      }
      catch (err) {
        console.warn("Warning: ", err)
        console.log(chunk)
        // TODO forward exact error
      }
    }
  } catch (error) {
    // Handle AbortError at the top level
    if (error?.name === "AbortError") {
      return null;
    }
    throw error; // Propagate other errorsrs
  }
}

// Other running requests (the agent loop) that the abort button should stop too
const abortListeners = new Set();
export function onAbortRequest(listener) {
  abortListeners.add(listener);
  return () => abortListeners.delete(listener);
}

function abortRequest() {
  abortListeners.forEach((listener) => listener());
  if (controller) {
    controller.abort(); // stops the stream/fetch
  }
  controller = new AbortController();
}

export { chatCompletions, abortRequest };
