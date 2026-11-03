// Runs one chat turn through pi's agent loop: model call, tool execution, next model call.
//
// History format: UI messages stay as they are (text + file content items). An assistant message
// produced by the agent additionally keeps pi's transcript of that turn (assistant messages with
// tool calls, and tool results) in `meta.agent`, which is replayed as-is on the next turn.
// Assistant messages without it (older chats, other models) are replayed from their text.
import "./shims/globals";
import { Agent, type AgentMessage } from "@earendil-works/pi-agent-core";
import { createModels, createProvider, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { agentEndpoint, agentGatewayTools, markToolless, modelSupportsTools } from "../apis/agentEndpoints";
import { onAbortRequest, reasoningParams } from "../apis/chatCompletions";
import { loadFileMeta, saveFile } from "../db";
import { getFileType } from "../utils/attachments";
import { prepareAttachment, UPLOADS, uploadPath } from "./prepare";
import { addGatewayFields, gatewayFetch, gatewayRequestFields, nameResults, toAgentMessage } from "./gateway";
import { createTools } from "./tools";
import { type Change, observe } from "./vfs";
import { getWorkspace, listMounts } from "./workspace";

const PROVIDER = "chat-ai";
// pi-ai insists on a key; the backend ignores it and adds the real one.
const PROXY_KEY = "set-by-backend";

const AGENT_PROMPT = `You have a virtual filesystem rooted at "/" that belongs to this conversation. There is no shell.
Files the user attaches are placed under ${UPLOADS}/; documents and audio come with a converted text variant next to them.
Use the tools to read, write and edit files, to convert documents, to transcribe audio, and to generate speech, images and Word documents.
Every file you write is shown to the user in the chat, so do not repeat a file's whole content in your answer.`;

const NO_TOOLS_PROMPT = "You cannot call tools in this conversation; attached files are referenced by name only.";

type ModelSpec = { id: string; name?: string; input?: string[] };

export interface TurnUpdate {
  /** The agent's messages of this turn so far, the streaming one included. */
  agentMessages: AgentMessage[];
  /** Thinking (as <think> blocks) and text of all assistant messages of the turn. */
  text: string;
  /** Files the agent wrote, as UI content items. */
  files: { type: "file"; fileId: string }[];
}

export interface TurnResult extends TurnUpdate {
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  error?: string;
}

// External models are proxied to commercial APIs that refuse tool calls on this endpoint.
export const isExternalModel = (model: ModelSpec) => (model?.name ?? "").toLowerCase().includes("external");

function toModel(spec: ModelSpec): Model<"openai-completions"> {
  return {
    id: spec.id,
    name: spec.name ?? spec.id,
    api: "openai-completions",
    provider: PROVIDER,
    baseUrl: agentEndpoint(),
    reasoning: false,
    input: spec.input?.includes("image") ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
    },
  };
}

/** Rewrites tool calls and tool results in a request as plain text, for models that cannot take them. */
function flattenToolHistory(messages: any[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
      return { role: "user", content: `[Tool result]\n${content}` };
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      const calls = message.tool_calls.map((call: any) => `[Tool call ${call.function?.name}(${call.function?.arguments})]`);
      const { tool_calls, ...rest } = message;
      return { ...rest, content: [message.content ?? "", ...calls].filter(Boolean).join("\n") };
    }
    return message;
  });
}

const textOfThinking = (message: AgentMessage) =>
  message.role !== "assistant"
    ? ""
    : message.content
        .map((block) => (block.type === "thinking" ? `<think>${block.thinking}</think>` : block.type === "text" ? block.text : ""))
        .join("");

export const agentText = (messages: AgentMessage[]) =>
  messages
    .map(textOfThinking)
    .filter((text) => text.trim())
    .join("\n\n");

const stripThink = (text: string) => text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "").trim();

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/**
 * Makes sure a message's attachments are in the workspace (see prepare.ts) and returns a note
 * listing them, plus the images to send inline.
 */
async function ingestAttachments(conversationId: string, fs, items: any[], vision: boolean, audio: Map<string, InputAudio> | null) {
  const lines: string[] = [];
  const images: { type: "image"; data: string; mimeType: string }[] = [];
  for (const item of items) {
    if (item.type !== "file" || !item.fileId) continue;
    const meta = await loadFileMeta(item.fileId);
    if (!meta) continue;
    const path = uploadPath(item.fileId, meta.name);
    const kind = getFileType(meta);
    // Usually started when the file was attached; waits for it, or does it now
    await prepareAttachment(conversationId, item.fileId);
    if (!(await fs.stat(path))) continue;
    const variants = [`${path}.md`, `${path}.txt`];
    const converted = [];
    for (const variant of variants) if (await fs.stat(variant)) converted.push(variant);
    lines.push(`- ${path}${converted.length ? ` (text: ${converted.join(", ")})` : ""}`);
    if (vision && kind === "image") {
      const bytes = await fs.readFile(path);
      images.push({ type: "image", data: toBase64(bytes), mimeType: meta.type || "image/png" });
    }
    if (audio && kind === "audio") {
      const format = /wav/.test(meta.type) || /\.wav$/i.test(meta.name) ? "wav" : "mp3";
      audio.set(path, { data: toBase64(await fs.readFile(path)), format });
    }
  }
  return { note: lines.length ? `\n\n[Attached files]\n${lines.join("\n")}` : "", images };
}

type InputAudio = { data: string; format: "wav" | "mp3" };

/**
 * Audio for models that take it as input. pi's messages carry only text and images, so the
 * audio is added to the request in onPayload, to the user message whose note lists its path.
 */
function addInputAudio(messages: any[], audio: Map<string, InputAudio>) {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const parts = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    const text = parts.map((part) => (part.type === "text" ? part.text : "")).join("\n");
    const clips = [...audio].filter(([path]) => text.includes(`- ${path}`));
    if (!clips.length) continue;
    message.content = [...parts, ...clips.map(([, input_audio]) => ({ type: "input_audio", input_audio }))];
  }
}

/**
 * Images from earlier turns (generated, read or attached while a vision model was selected)
 * stay in the stored transcript. Models without vision reject them, so they become a note.
 */
function dropImages(messages: any[]) {
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    message.content = message.content.map((part) =>
      part.type === "image_url" ? { type: "text", text: "[Image omitted: this model cannot see images]" } : part,
    );
  }
}

/** The UI conversation as pi messages. The last message must be the user's new prompt. */
async function toAgentMessages(conversationId: string, fs, uiMessages: any[], spec: ModelSpec, vision: boolean, audio: Map<string, InputAudio> | null) {
  const out: AgentMessage[] = [];
  for (const message of uiMessages) {
    const items = Array.isArray(message.content) ? message.content : [{ type: "text", text: String(message.content ?? "") }];
    const text = items.filter((item) => item.type === "text").map((item) => item.text ?? "").join("\n");
    if (message.role === "user") {
      const { note, images } = await ingestAttachments(conversationId, fs, items, vision, audio);
      const content = [{ type: "text" as const, text: `${text}${note}` }, ...images];
      if (!text.trim() && !note && !images.length) continue;
      out.push({ role: "user", content, timestamp: message.createdAt ?? Date.now() });
    } else if (message.role === "assistant") {
      if (Array.isArray(message.meta?.agent) && message.meta.agent.length) {
        out.push(...message.meta.agent);
        continue;
      }
      const answer = stripThink(text);
      if (!answer) continue;
      out.push({
        role: "assistant",
        content: [{ type: "text", text: answer }],
        api: "openai-completions",
        provider: PROVIDER,
        model: spec.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "stop",
        timestamp: message.createdAt ?? Date.now(),
      } as AgentMessage);
    }
  }
  return out;
}

export async function runAgentTurn({
  conversationId,
  uiMessages,
  systemPrompt,
  settings,
  onUpdate,
}: {
  conversationId: string;
  uiMessages: any[];
  systemPrompt: string;
  settings: any;
  onUpdate: (update: TurnUpdate) => void;
}): Promise<TurnResult> {
  const spec: ModelSpec = typeof settings.model === "string" ? { id: settings.model } : settings.model;
  const external = isExternalModel(spec);
  const useTools = modelSupportsTools(spec);
  const model = toModel(spec);
  const vision = model.input.includes("image");

  const storage = await getWorkspace(conversationId);
  // Files written under UPLOADS are inputs (uploads and their converted variants), not results to show
  const written = new Set<string>();
  const workspace = observe(storage, (change: Change) => {
    if (change.kind === "write" && !change.path.startsWith(`${UPLOADS}/`)) written.add(change.path);
  });

  // Audio files by upload path, sent as audio to models that take it
  const audio = spec.input?.includes("audio") ? new Map<string, InputAudio>() : null;
  const conversation = await toAgentMessages(conversationId, storage, uiMessages.filter((m) => m.role !== "system"), spec, vision, audio);
  const prompt = conversation.pop();
  if (!prompt || prompt.role !== "user") throw new Error("Nothing to send");

  const models = createModels();
  models.setProvider(
    createProvider({
      id: PROVIDER,
      name: "Chat AI",
      baseUrl: agentEndpoint(),
      auth: { apiKey: { name: "Chat AI", resolve: async () => ({ auth: { apiKey: PROXY_KEY } }) } },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );

  const extra = { top_p: settings.top_p, ...reasoningParams(spec.id, settings) };
  const gatewayFields = external || !agentGatewayTools() ? {} : gatewayRequestFields(settings);
  const onPayload = (payload: any) => {
    // Let the server pick the output limit, as the plain chat path does.
    delete payload.max_tokens;
    delete payload.max_completion_tokens;
    Object.assign(payload, extra);
    addGatewayFields(payload, gatewayFields);
    if (!useTools) {
      delete payload.tools;
      payload.messages = flattenToolHistory(payload.messages);
    }
    if (external) {
      // reasoningParams also sets this for OpenAI models, which reject it; back/ never forwarded it.
      delete payload.chat_template_kwargs;
      // OpenAI's reasoning models only accept the default sampling parameters.
      if (/^openai-(gpt-?[5-9]|o\d)/.test(spec.id)) {
        delete payload.temperature;
        delete payload.top_p;
      }
    }
    if (!vision) dropImages(payload.messages);
    if (audio?.size) addInputAudio(payload.messages, audio);
    return payload;
  };

  // The gateway's own tool use during a request, as pi messages. It belongs before the
  // assistant message that request produced: `before` maps that message to it, for the
  // following requests of this turn (transformContext) and the stored transcript (done).
  let gatewayMessages: AgentMessage[] = [];
  const before = new Map<AgentMessage, AgentMessage[]>();
  const fetchFn = gatewayFetch((exchange) =>
    gatewayMessages.push(toAgentMessage(exchange, { api: model.api, provider: PROVIDER, model: spec.id })),
  );

  const mounts = listMounts(conversationId);
  const agent = new Agent({
    initialState: {
      systemPrompt: [
        systemPrompt,
        useTools ? AGENT_PROMPT : NO_TOOLS_PROMPT,
        useTools && mounts.length ? `The user's local folders are mounted at: ${mounts.join(", ")}.` : "",
        useTools && settings.tools?.write_access === false
          ? "The user has turned off writing and editing files: you can read files but not change them."
          : "",
        `Current date: ${new Date().toLocaleString()}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      model,
      tools: useTools ? createTools(workspace, { vision, enabled: settings.tools }) : [],
      messages: conversation,
    },
    transformContext: async (messages) => nameResults(messages.flatMap((message) => [...(before.get(message) ?? []), message])),
    streamFn: (m, context, options) => {
      gatewayMessages = [];
      return models.streamSimple(m, context, { ...options, temperature: settings.temperature, onPayload, fetch: fetchFn });
    },
  });

  // Files the agent wrote, by path. A file written twice keeps one place in the message.
  const files = new Map<string, string>();
  const saveWritten = async () => {
    for (const path of [...written]) {
      written.delete(path);
      try {
        const bytes = await storage.readFile(path);
        const name = path.split("/").pop() || "file";
        const file = new File([bytes as Uint8Array<ArrayBuffer>], name, { type: guessType(name) });
        files.set(path, saveFile(conversationId, file));
      } catch (error) {
        console.warn(`Could not attach ${path}:`, error);
      }
    }
  };

  const done: AgentMessage[] = [];
  let streaming: AgentMessage | undefined;
  const snapshot = (): TurnUpdate => {
    const agentMessages = streaming ? [...done, streaming] : [...done];
    return { agentMessages, text: agentText(agentMessages), files: [...files.values()].map((fileId) => ({ type: "file", fileId })) };
  };

  let error: string | undefined;
  agent.subscribe(async (event) => {
    switch (event.type) {
      case "message_update":
        streaming = event.message;
        break;
      case "message_end":
        streaming = undefined;
        if (event.message.role === "user") return;
        if (event.message.role === "assistant" && gatewayMessages.length) {
          before.set(event.message, gatewayMessages);
          done.push(...nameResults(gatewayMessages));
          gatewayMessages = [];
        }
        done.push(event.message);
        if (event.message.role === "assistant" && event.message.stopReason === "error") {
          error = event.message.errorMessage ?? "The model request failed.";
        }
        break;
      case "tool_execution_end":
        await saveWritten();
        break;
      default:
        return;
    }
    onUpdate(snapshot());
  });

  const stopListening = onAbortRequest(() => agent.abort());
  try {
    await agent.prompt(prompt);
  } finally {
    stopListening();
  }
  await saveWritten();

  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  for (const message of done) {
    if (message.role !== "assistant") continue;
    // Each call resends the conversation, so the last call's input is the context size.
    usage.prompt_tokens = message.usage.input + message.usage.cacheRead;
    usage.completion_tokens += message.usage.output;
  }
  usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

  // vLLM without --enable-auto-tool-choice rejects any request with tools. If the very first
  // request failed that way, remember the model and redo the turn without tools.
  if (useTools && done.length === 1 && error && NO_TOOL_CALLING.test(error)) {
    markToolless(spec.id);
    return runAgentTurn({ conversationId, uiMessages, systemPrompt, settings, onUpdate });
  }
  return { ...snapshot(), usage, error };
}

const NO_TOOL_CALLING = /tool[- ]choice|tool-call-parser|does not support tools|tools? (is|are) not supported/i;

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  txt: "text/plain",
};

const guessType = (name: string) => TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "text/plain";
