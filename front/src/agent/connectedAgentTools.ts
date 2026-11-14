import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

import type { Vfs } from "./vfs";

import { getAgents } from "../agents/agentStore";
import {
  deleteAgentSession,
  fetchAgentSessions,
  switchAgentSession,
} from "../agents/agentSessions";
import {
  getConversationWorkspaceIds,
  getWorkspaceAgentIds,
} from "../db/workspaceDb";
import {
  getOpencodeInfo,
  getOpencodeSessionStatus,
  listOpencodeFiles,
  listOpencodeMessages,
  readOpencodeFile,
} from "../apis/opencodeAgents";

const text = (value: string): AgentToolResult<any> => ({
  content: [{ type: "text", text: value }],
  details: undefined,
});

const messageText = (message: any) => {
  if (message?.type === "user") return String(message.text || "").trim();
  const parts = message?.content ?? message?.parts ?? [];
  return parts
    .map((part: any) => {
      if (part?.type === "text") return part.text || "";
      if (part?.type === "tool") return `[tool: ${part.name || "tool"}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
};

const classifyStatus = (value: any) => {
  if (!value) return "ready";
  const status =
    typeof value === "string"
      ? value
      : String(value?.type ?? value?.status ?? value?.state ?? "");
  if (/busy|running|working|active|pending|retry|permission/i.test(status)) {
    return "working";
  }
  if (/error|offline|failed|unavailable/i.test(status)) return "error";
  return "ready";
};

async function connectedAgents(conversationId: string) {
  const workspaceIds = await getConversationWorkspaceIds(conversationId);
  if (!workspaceIds.length) return [];
  const linkedIds = new Set(await getWorkspaceAgentIds(workspaceIds));
  return getAgents().filter(
    (agent) =>
      linkedIds.has(agent.id) ||
      (agent.bridgeWorkspaceId && workspaceIds.includes(agent.bridgeWorkspaceId)),
  );
}

export async function createConnectedAgentTools(
  conversationId: string,
  workspace: Vfs,
): Promise<AgentTool<any>[]> {
  const agents = await connectedAgents(conversationId);
  if (!agents.length) return [];

  const findAgent = (reference: string) => {
    const target = String(reference || "").trim();
    return agents.find(
      (agent) => agent.id === target || agent.name === target,
    );
  };

  const findSession = async (agent: any, reference: string) => {
    const tree = await fetchAgentSessions(agent);
    const target = String(reference || "").trim();
    if (!target) return { tree, session: null };
    const normalized = target.toLowerCase();
    const session =
      tree.all.find((item: any) => item.id === target) ||
      tree.all.find(
        (item: any) =>
          String(item.title || "").trim().toLowerCase() === normalized,
      ) ||
      null;
    return { tree, session };
  };

  const sessionLines = (agent: any, tree: any) => {
    const roots = tree?.roots ?? [];
    const children = tree?.children ?? new Map();
    const lines: string[] = [];
    const seen = new Set<string>();
    const walk = (session: any, depth: number) => {
      if (!session?.id || seen.has(session.id)) return;
      seen.add(session.id);
      lines.push(
        `${"  ".repeat(depth)}- ${session.id}\n${"  ".repeat(depth)}  title: ${session.title || "Untitled session"}${session.id === agent.sessionId ? "\n" + "  ".repeat(depth) + "  active: yes" : ""}`,
      );
      for (const child of children.get(session.id) || []) {
        walk(child, depth + 1);
      }
    };
    for (const root of roots) walk(root, 0);
    return lines;
  };

  const statusTool: AgentTool<any> = {
    name: "connected_agents_status",
    label: "Connected agent status",
    description:
      "Check the connection and session status of agents connected to this chat's workspace. Optionally pass one agent id or name.",
    parameters: Type.Object({
      agent: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      const selected = args.agent
        ? [findAgent(args.agent)].filter(Boolean)
        : agents;
      const lines = await Promise.all(
        selected.map(async (agent) => {
          if (!agent.sessionId) return `- ${agent.name}: no session`;
          const [info, statuses] = await Promise.allSettled([
            getOpencodeInfo(agent),
            getOpencodeSessionStatus(agent),
          ]);
          const connected =
            info.status === "fulfilled" || statuses.status === "fulfilled";
          const value =
            statuses.status === "fulfilled"
              ? statuses.value?.[agent.sessionId]
              : null;
          return `- ${agent.name}: ${connected ? classifyStatus(value) : "unreachable"}`;
        }),
      );
      return text(lines.join("\n") || "Agent not found.");
    },
  };

  const historyTool: AgentTool<any> = {
    name: "connected_agent_history",
    label: "Connected agent history",
    description:
      "Read recent messages from an agent connected to this chat's workspace. Defaults to the active session; pass a session id or title from connected_agent_list_sessions to read another session or subagent.",
    parameters: Type.Object({
      agent: Type.String(),
      session: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Number()),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent || !agent.sessionId) return text("Agent not found.");
      let sessionId = agent.sessionId;
      if (args.session) {
        const { session } = await findSession(agent, args.session);
        if (!session) return text("Session not found.");
        sessionId = session.id;
      }
      const limit = Math.min(
        100,
        Math.max(1, Number(args.limit) || 40),
      );
      try {
        const messages = await listOpencodeMessages(agent, sessionId);
        return text(
          messages
            .slice(-limit)
            .map((message: any) => {
              const value = messageText(message);
              return value
                ? `- id: ${message.id}\n  role: ${message.type}\n  text: ${value.slice(0, 12000)}`
                : "";
            })
            .filter(Boolean)
            .join("\n") || "(no messages)",
        );
      } catch (error) {
        return text(
          `Could not read agent history: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const sessionsTool: AgentTool<any> = {
    name: "connected_agent_list_sessions",
    label: "List connected agent sessions",
    description:
      "List every session of an agent connected to this chat's workspace, including nested subagent sessions, with their ids and the active session.",
    parameters: Type.Object({
      agent: Type.String(),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      try {
        const tree = await fetchAgentSessions(agent);
        return text(
          [
            `Active session: ${agent.sessionId || "none"}`,
            ...sessionLines(agent, tree),
          ].join("\n") || "(no sessions)",
        );
      } catch (error) {
        return text(
          `Could not list agent sessions: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const switchSessionTool: AgentTool<any> = {
    name: "connected_agent_switch_session",
    label: "Switch connected agent session",
    description:
      "Switch an agent connected to this chat's workspace to one of its sessions or subagent sessions. Use connected_agent_list_sessions first to get the session id or title.",
    parameters: Type.Object({
      agent: Type.String(),
      session: Type.String(),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      try {
        const { tree, session } = await findSession(agent, args.session);
        if (!session) {
          const available = tree.all
            .slice(0, 20)
            .map((item: any) => `${item.id} (${item.title || "Untitled"})`)
            .join(", ");
          return text(
            `Session not found.${available ? ` Available: ${available}` : ""}`,
          );
        }
        switchAgentSession(agent, session.id);
        return text(
          `Switched ${agent.name || agent.id} to ${session.title || session.id} (${session.id}).`,
        );
      } catch (error) {
        return text(
          `Could not switch agent session: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const removeSessionTool: AgentTool<any> = {
    name: "connected_agent_remove_session",
    label: "Remove connected agent session",
    description:
      "Delete a session or subagent session from an agent connected to this chat's workspace. Only use this when the user explicitly asks to remove that session. If the active session is removed, another session is selected or a new one is created.",
    parameters: Type.Object({
      agent: Type.String(),
      session: Type.String(),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      try {
        const { tree, session } = await findSession(agent, args.session);
        if (!session) return text("Session not found.");
        const next = await deleteAgentSession(agent, session, tree);
        return text(
          `Removed ${session.title || session.id} (${session.id}) from ${agent.name || agent.id}.${
            next ? ` Active session is now ${next.title || next.id}.` : ""
          }`,
        );
      } catch (error) {
        return text(
          `Could not remove agent session: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const filesTool: AgentTool<any> = {
    name: "connected_agent_files",
    label: "Connected agent files",
    description:
      "List files in an agent connected to this chat's workspace.",
    parameters: Type.Object({
      agent: Type.String(),
      path: Type.Optional(Type.String()),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      try {
        const rows = await listOpencodeFiles(agent, String(args.path || ""));
        return text(
          rows
            .map((entry: any) => {
              const time =
                entry?.mtime ??
                entry?.modified ??
                entry?.modifiedAt ??
                entry?.time?.modified ??
                entry?.time?.created;
              return `- ${entry.type === "directory" ? "dir" : "file"} ${entry.path}${typeof entry.size === "number" ? ` (${entry.size} bytes)` : ""}${time ? ` — ${new Date(time).toISOString()}` : ""}`;
            })
            .join("\n") || "(empty folder)",
        );
      } catch (error) {
        return text(
          `Could not list agent files: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const readTool: AgentTool<any> = {
    name: "connected_agent_read_file",
    label: "Read connected agent file",
    description:
      "Read a UTF-8 file from an agent connected to this chat's workspace.",
    parameters: Type.Object({
      agent: Type.String(),
      path: Type.String(),
      maxChars: Type.Optional(Type.Number()),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      const path = String(args.path || "").trim();
      if (!path) return text("A file path is required.");
      const maxChars = Math.min(
        100000,
        Math.max(1, Number(args.maxChars) || 20000),
      );
      try {
        const { blob, type } = await readOpencodeFile(agent, path);
        if (blob.size > 2 * 1024 * 1024) {
          return text(`File is too large to read (${blob.size} bytes).`);
        }
        const value = await blob.text();
        if (value.includes("\u0000")) {
          return text(
            `File appears to be binary (${type || "unknown type"}, ${blob.size} bytes).`,
          );
        }
        return text(value.slice(0, maxChars) || "(empty file)");
      } catch (error) {
        return text(
          `Could not read agent file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  const fetchTool: AgentTool<any> = {
    name: "connected_agent_fetch_file",
    label: "Fetch connected agent file",
    description:
      "Copy any file, including images and PDFs, from an agent connected to this chat's workspace into this chat as an attachment.",
    parameters: Type.Object({
      agent: Type.String(),
      path: Type.String(),
    }),
    execute: async (_id, args) => {
      const agent = findAgent(args.agent);
      if (!agent) return text("Agent not found.");
      const path = String(args.path || "").trim();
      if (!path) return text("A file path is required.");
      try {
        const { blob, type } = await readOpencodeFile(agent, path);
        if (blob.size > 20 * 1024 * 1024) {
          return text(`File is too large to attach (${blob.size} bytes).`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const name = path.split("/").filter(Boolean).pop() || "file";
        const safeAgent = (agent.name || agent.id)
          .replace(/[^a-z0-9._-]+/gi, "-")
          .replace(/^-+|-+$/g, "") || "agent";
        const target = `/connected-agents/${safeAgent}/${name}`;
        const directory = target.slice(0, target.lastIndexOf("/")) || "/";
        await workspace.mkdir(directory);
        await workspace.writeFile(target, bytes);
        return text(
          `Attached ${target} from ${agent.name} (${type || "application/octet-stream"}, ${blob.size} bytes).`,
        );
      } catch (error) {
        return text(
          `Could not fetch agent file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };

  return [
    statusTool,
    sessionsTool,
    historyTool,
    switchSessionTool,
    removeSessionTool,
    filesTool,
    readTool,
    fetchTool,
  ];
}
