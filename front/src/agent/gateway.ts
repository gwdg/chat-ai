// Server-side tools of the SAIA gateway (web search, arcana) in the browser agent.
//
// The gateway runs its own tools and passes the agent's tools through: calls to the agent's
// tools come back as normal tool calls. Its own tool use is streamed as status events, which
// look like tool-call deltas named "<module>.event". This module filters those events out of
// the stream before pi parses it, and turns the gateway's `gwdg_tool.event`s (its exact
// assistant tool-call message and tool results) into pi messages for the transcript, so the
// model sees them again on later requests. See docs/tool-passthrough.md in the gateway repo.
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { usesAgentProxy } from "../apis/agentEndpoints";

/** Request fields that switch on gateway tools for this turn. */
export function gatewayRequestFields(settings: any) {
  const tools = settings?.tools ?? {};
  const fields: Record<string, unknown> = {};
  // Opt-in, unlike the agent's own tools: web search needs the user's consent (the toggle
  // asks for it), and both send conversation data to further services.
  if (tools.web_search === true) fields.selectors = [{ type: "web_search" }, { type: "fetch_url" }];
  const arcana = settings?.arcana;
  if (tools.arcana === true && arcana?.id) fields.arcana = arcana;
  return fields;
}

/** Adds the gateway fields to a chat completion payload. */
export function addGatewayFields(payload: any, fields: Record<string, unknown>) {
  const { selectors, ...rest } = fields as { selectors?: object[] };
  // Gateway selectors need tools to send them with; models without tools get none
  if (selectors?.length && payload.tools) payload.tools = [...payload.tools, ...selectors];
  Object.assign(payload, rest);
}

type Exchange = { event: "call" | "result"; message: any };

/**
 * A fetch that removes the gateway's status events from SSE responses and reports its
 * `gwdg_tool.event`s to `onExchange`.
 */
export function gatewayFetch(onExchange: (exchange: Exchange) => void): typeof fetch {
  return async (input, init) => {
    // The model client always sends a placeholder API key. Only the agent proxy replaces it;
    // the normal endpoint authenticates through the OIDC proxy and must not see it.
    if (!usesAgentProxy() && init?.headers) {
      const headers = new Headers(init.headers);
      headers.delete("authorization");
      init = { ...init, headers };
    }
    const response = await fetch(input, init);
    const type = response.headers.get("content-type") ?? "";
    // Streams only; a JSON answer has no events in it
    if (!response.body || type.includes("json")) return response;

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    const keep = (line: string) => {
      const event = statusEvent(line);
      if (!event) return true;
      if (event.name === "gwdg_tool.event") {
        try {
          onExchange(JSON.parse(event.arguments));
        } catch (error) {
          console.warn("Unreadable gwdg_tool.event:", error);
        }
      }
      return false;
    };
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          const kept = lines.filter(keep);
          if (kept.length) controller.enqueue(encoder.encode(kept.map((line) => `${line}\n`).join("")));
        },
        flush(controller) {
          if (buffer && keep(buffer)) controller.enqueue(encoder.encode(buffer));
        },
      }),
    );
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

/** The status event in an SSE line, if it is one: a tool-call delta named "*.event". */
function statusEvent(line: string): { name: string; arguments: string } | undefined {
  if (!line.startsWith("data:") || !line.includes(".event")) return undefined;
  try {
    const call = JSON.parse(line.slice(5)).choices?.[0]?.delta?.tool_calls?.[0];
    const name = call?.function?.name;
    if (typeof name === "string" && name.endsWith(".event")) return { name, arguments: call.function.arguments ?? "{}" };
  } catch {
    // Not JSON (e.g. [DONE]): not ours
  }
  return undefined;
}

const parseArguments = (raw: unknown) => {
  if (typeof raw !== "string") return (raw as object) ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return { arguments: raw };
  }
};

/** A `gwdg_tool.event` message as a pi message. */
export function toAgentMessage(exchange: Exchange, base: { api: string; provider: string; model: string }): AgentMessage {
  const { message } = exchange;
  const timestamp = Date.now();
  if (exchange.event === "result") {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
    return { role: "toolResult", toolCallId: message.tool_call_id, toolName: "", content: [{ type: "text", text: content }], isError: false, timestamp } as AgentMessage;
  }
  const text = typeof message.content === "string" ? message.content : "";
  return {
    role: "assistant",
    content: [
      ...(text.trim() ? [{ type: "text" as const, text }] : []),
      ...(message.tool_calls ?? []).map((call: any) => ({
        type: "toolCall" as const,
        id: call.id,
        name: call.function?.name ?? "",
        arguments: parseArguments(call.function?.arguments),
      })),
    ],
    ...base,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "toolUse",
    timestamp,
  } as AgentMessage;
}

/** Fills in toolName on results from the call they answer. */
export function nameResults(messages: AgentMessage[]) {
  const names = new Map<string, string>();
  for (const message of messages) {
    if (message.role === "assistant") for (const block of message.content) if (block.type === "toolCall") names.set(block.id, block.name);
    if (message.role === "toolResult" && !message.toolName) (message as any).toolName = names.get(message.toolCallId) ?? "";
  }
  return messages;
}
