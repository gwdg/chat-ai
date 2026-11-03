import { useCallback, useEffect, useRef, useState } from "react";
import { Agent } from "@earendil-works/pi-agent-core";

import { createFileSystem } from "../filesystem";
import { loadWorkspaceMessages, replaceWorkspaceMessages, updateWorkspace } from "../db/workspaceDb";
import type { WorkspaceRow } from "../db/dbTypes";
import { createAgentStreamFn, createPiModel } from "./models";
import {
  DEFAULT_WORKSPACE_PERSONA,
  createInitialWorkspaceSystemMessage,
  createPersonaUpdateMessage,
} from "./prompt";
import { createWorkspaceTools } from "./tools";

export type WorkspaceAgentStatus = "loading" | "ready" | "thinking" | "tool" | "error";

export type WorkspaceActivity = {
  toolName: string;
  args?: any;
  state: "running" | "done" | "error";
  durationMs?: number;
};

type SendPayload = {
  text: string;
  images?: { type: "image"; data: string; mimeType: string }[];
  persona?: string;
};

/**
 * Owns one pi-agent runtime for a workspace page. The transcript is persisted
 * to IndexedDB after every message and fully restored on reload.
 */
export function useWorkspaceAgent(workspace: WorkspaceRow | undefined) {
  const [messages, setMessages] = useState<any[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<any | null>(null);
  const [status, setStatus] = useState<WorkspaceAgentStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [aborted, setAborted] = useState(false);
  const [activity, setActivity] = useState<WorkspaceActivity | null>(null);
  const [fsRevision, setFsRevision] = useState(0);

  const agentRef = useRef<Agent | null>(null);
  const workspaceRef = useRef<WorkspaceRow | undefined>(workspace);
  const personaRef = useRef<string>(DEFAULT_WORKSPACE_PERSONA);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  workspaceRef.current = workspace;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!workspace) {
      setStatus("loading");
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const workspaceId = workspace.id;
    const fs = createFileSystem(workspace);
    const tools = createWorkspaceTools({
      fs,
      skills: workspace.skills ?? [],
      onMutation: () => setFsRevision((value) => value + 1),
    });

    const persist = (nextMessages: any[], immediate = false) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      const run = () => {
        replaceWorkspaceMessages(workspaceId, nextMessages).catch((persistError) => {
          console.error("Could not persist workspace messages", persistError);
        });
      };
      if (immediate) run();
      else persistTimer.current = setTimeout(run, 350);
    };

    async function init() {
      setStatus("loading");
      setError(null);
      setAborted(false);
      try {
        const stored = await loadWorkspaceMessages(workspaceId);
        if (cancelled) return;

        const initialMessages = stored.length
          ? stored
          : [createInitialWorkspaceSystemMessage(workspace as WorkspaceRow)];
        personaRef.current =
          (workspace?.settings?.system_prompt ?? "").trim() || DEFAULT_WORKSPACE_PERSONA;

        const agent = new Agent({
          initialState: {
            model: createPiModel(workspace!.modelId, workspace!.modelName),
            messages: initialMessages as any,
            tools,
          },
          streamFn: createAgentStreamFn(() => {
            const settings = workspaceRef.current?.settings ?? {};
            return {
              temperature:
                typeof settings.temperature === "number" ? settings.temperature : undefined,
              top_p: typeof settings.top_p === "number" ? settings.top_p : undefined,
            };
          }),
          toolExecution: "parallel",
        });

        unsubscribe = agent.subscribe((event: any) => {
          if (!mountedRef.current) return;
          switch (event.type) {
            case "agent_start":
              setStatus("thinking");
              setError(null);
              setAborted(false);
              break;
            case "turn_start":
              setStatus("thinking");
              setAborted(false);
              setActivity(null);
              break;
            case "message_start":
              setMessages([...agent.state.messages]);
              if (event.message?.role === "assistant") {
                setStatus("thinking");
              }
              break;
            case "message_update":
              setStreamingMessage(event.message ?? null);
              break;
            case "message_end":
              setStreamingMessage(null);
              setMessages([...agent.state.messages]);
              persist([...agent.state.messages]);
              break;
            case "tool_execution_start":
              setStatus("tool");
              setActivity({ toolName: event.toolName, args: event.args, state: "running" });
              break;
            case "tool_execution_end":
              setActivity({
                toolName: event.toolName,
                args: event.args,
                state: event.isError ? "error" : "done",
                durationMs: event.durationMs,
              });
              setStatus("thinking");
              break;
            case "agent_end": {
              const finalMessages = event.messages ?? agent.state.messages;
              setStreamingMessage(null);
              setMessages([...finalMessages]);
              setActivity(null);
              const last = finalMessages[finalMessages.length - 1];
              if (last?.role === "assistant" && last.stopReason === "error") {
                setStatus("error");
                setError(last.errorMessage || "The model request failed.");
                setAborted(false);
              } else {
                setStatus("ready");
                setError(null);
                setAborted(
                  last?.role === "assistant" && last.stopReason === "aborted",
                );
              }
              persist([...finalMessages], true);
              updateWorkspace(workspaceId, {}).catch(() => {});
              break;
            }
            default:
              break;
          }
        });

        agentRef.current = agent;
        setMessages([...agent.state.messages]);
        setStatus("ready");
      } catch (initError: any) {
        console.error("Failed to start workspace agent", initError);
        if (!cancelled) {
          setStatus("error");
          setError(initError?.message || "Could not start the workspace agent.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      unsubscribe?.();
      try {
        agentRef.current?.abort();
      } catch {
        // ignore
      }
      agentRef.current = null;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
    // The runtime is tied to the workspace identity. Model/persona changes are
    // applied to the live agent below without discarding the transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  // Apply model changes without restarting the agent.
  useEffect(() => {
    if (agentRef.current && workspace?.modelId) {
      agentRef.current.state.model = createPiModel(workspace.modelId, workspace.modelName);
    }
  }, [workspace?.modelId, workspace?.modelName]);

  const send = useCallback(async ({ text, images = [], persona }: SendPayload) => {
    const agent = agentRef.current;
    if (!agent) return;
    if (agent.state.isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;

    const nextPersona = (persona ?? workspaceRef.current?.settings?.system_prompt ?? "").trim();
    const batch: any[] = [];
    if (nextPersona && nextPersona !== personaRef.current) {
      batch.push(createPersonaUpdateMessage(nextPersona));
      personaRef.current = nextPersona;
    }

    const content = images.length
      ? [{ type: "text", text: trimmed }, ...images]
      : trimmed;
    batch.push({ role: "user", content, timestamp: Date.now() });

    setError(null);
    setAborted(false);
    setStatus("thinking");
    try {
      await agent.prompt(batch);
    } catch (sendError: any) {
      console.error("Workspace prompt failed", sendError);
      setStatus("error");
      setError(sendError?.message || "The agent could not answer.");
    }
  }, []);

  const abort = useCallback(() => {
    agentRef.current?.abort();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setAborted(false);
    if (status === "error") setStatus(agentRef.current ? "ready" : "loading");
  }, [status]);

  return {
    messages,
    streamingMessage,
    status,
    error,
    aborted,
    activity,
    fsRevision,
    ready: Boolean(agentRef.current),
    send,
    abort,
    clearError,
  };
}
