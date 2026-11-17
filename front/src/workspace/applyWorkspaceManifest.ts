import { addAgent, removeAgent } from "../agents/agentStore";
import {
  createOpencodeSession,
  deleteOpencodeSession,
  putOpencodeInstructionEntry,
  setOpencodeModel,
} from "../apis/opencodeAgents";
import { deleteConversation, newId } from "../db";
import {
  attachWorkspaceAgent,
  attachWorkspaceChat,
  updateWorkspace,
} from "../db/workspaceDb";

export type ManifestConversation = {
  title?: string;
  settings?: unknown;
  messages?: unknown[];
  folderName?: string;
};

export type ImportManifestConversation = (
  conversation: ManifestConversation,
  importMessages: boolean,
) => Promise<string | null | undefined>;

export type ApplyWorkspaceManifestInput = {
  workspaceId: string;
  manifest: any;
  /** The local agent whose OpenCode connection is used when it creates the manifest agent. */
  connection: any;
  localAgents?: any[];
  modelsData?: any[];
  manifestAgentConnectionId?: string;
  importConversation: ImportManifestConversation;
  onProgress?: (step: "agent" | "chats") => void;
};

export type ApplyWorkspaceManifestResult = {
  agentId: string | null;
  createdAgent: any | null;
  chatIds: string[];
  /** Removes only what this call created, newest first. Safe to call more than once. */
  rollback: () => Promise<void>;
};

/**
 * Applies the optional workspace, agent and chat extras from a clone manifest. The function has
 * no React or modal state: everything it needs is passed in, and `rollback` closes over only the
 * rows it created so a failing later step can undo this one without touching older data.
 */
export async function applyWorkspaceManifest({
  workspaceId,
  manifest,
  connection,
  localAgents = [],
  modelsData = [],
  manifestAgentConnectionId,
  importConversation,
  onProgress,
}: ApplyWorkspaceManifestInput): Promise<ApplyWorkspaceManifestResult> {
  const chatIds: string[] = [];
  let agentId: string | null = null;
  let createdAgent: any | null = null;
  let rolledBack = false;

  const rollback = async () => {
    if (rolledBack) return;
    rolledBack = true;

    for (const chatId of [...chatIds].reverse()) {
      const { detachWorkspaceChat } = await import("../db/workspaceDb");
      if (detachWorkspaceChat) {
        await detachWorkspaceChat(workspaceId, chatId).catch(() => {});
      }
      await deleteConversation(chatId).catch(() => {});
    }
    chatIds.length = 0;

    if (createdAgent) {
      if (agentId) {
        const { detachWorkspaceAgent } = await import("../db/workspaceDb");
        if (detachWorkspaceAgent) {
          await detachWorkspaceAgent(workspaceId, agentId).catch(() => {});
        }
      }
      if (createdAgent.sessionId) {
        await deleteOpencodeSession(
          createdAgent,
          createdAgent.sessionId,
        ).catch(() => {});
      }
      if (agentId) removeAgent(agentId);
      createdAgent = null;
      agentId = null;
    }
  };

  try {
    if (manifest?.workspace?.icon || manifest?.workspace?.color) {
      await updateWorkspace(workspaceId, {
        ...(manifest.workspace.icon ? { icon: manifest.workspace.icon } : {}),
        ...(manifest.workspace.color
          ? { color: manifest.workspace.color }
          : {}),
      });
    }

    const manifestAgent = manifest?.agent;
    if (manifestAgent) {
      const selectedConnection =
        localAgents.find(
          (item) => item.id === manifestAgentConnectionId,
        ) || connection;
      onProgress?.("agent");
      const session = await createOpencodeSession(
        selectedConnection,
        manifestAgent.sessionTitle ||
          `${manifestAgent.name || selectedConnection.name} agent`,
      );
      agentId = newId();
      createdAgent = {
        id: agentId,
        projectId: selectedConnection.projectId,
        name: manifestAgent.name || selectedConnection.name,
        local: selectedConnection.local,
        serverUrl: selectedConnection.serverUrl,
        username: selectedConnection.username,
        password: selectedConnection.password,
        passwordSource: selectedConnection.passwordSource,
        sessionId: session.id,
        bridgeWorkspaceId: workspaceId,
        bridgeWritable: manifestAgent.bridgeWritable === true,
        bridgeMcp: manifestAgent.bridgeMcp === true,
        ...(manifestAgent.initialMessage
          ? {
              initialMessage: manifestAgent.initialMessage,
              initialMessageSessionId: session.id,
            }
          : {}),
      };
      addAgent(createdAgent);
      if (manifestAgent.initialMessage) {
        await putOpencodeInstructionEntry(
          selectedConnection,
          session.id,
          "chat-ai-manifest",
          manifestAgent.initialMessage,
        ).catch(() => {});
      }
      if (manifestAgent.model) {
        const model = modelsData.find(
          (item) => item.id === manifestAgent.model,
        );
        if (model?.providerID) {
          await setOpencodeModel(createdAgent, session.id, {
            id: model.id,
            providerID: model.providerID,
          }).catch(() => {});
        }
      }
      await attachWorkspaceAgent(workspaceId, agentId);
    }

    if (manifest?.chats?.length) {
      onProgress?.("chats");
      for (const chat of manifest.chats) {
        const chatId = await importConversation(
          {
            title: chat.title,
            settings: chat.settings,
            messages: chat.messages,
            ...(chat.folderName ? { folderName: chat.folderName } : {}),
          },
          true,
        );
        if (chatId) {
          chatIds.push(chatId);
          await attachWorkspaceChat(workspaceId, chatId);
        }
      }
    }

    return { agentId, createdAgent, chatIds, rollback };
  } catch (event) {
    await rollback();
    throw event;
  }
}
