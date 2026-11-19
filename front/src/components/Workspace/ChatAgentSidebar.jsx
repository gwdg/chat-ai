import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useAgents } from "../../agents/agentStore";
import {
  seedWorkspaceAgentSessions,
  useChatWorkspaces,
  useWorkspaceList,
  useWorkspaceAgentLinks,
  useWorkspaceAgentSessionLinks,
  useWorkspaceChatLinks,
} from "../../db/workspaceDb";
import { workspaceSessionIds } from "../../agents/workspaceAgentSessions";
import MetaChangesPanel from "../Meta/MetaChangesPanel";
import WorkspaceAgentPanel from "./WorkspaceAgentPanel";
import WorkspaceFilesPanel from "./WorkspaceFilesPanel";
import WorkspaceSessionsPanel from "./WorkspaceSessionsPanel";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

// The Agents tab picks how each of this chat's workspaces runs its agent. A chat
// can be attached to several workspaces, so each gets its own selector, headed by
// the workspace name only when there is more than one to tell apart.
function ChatAgentsPanel({ workspaces }) {
  if (!workspaces.length) return null;
  return (
    <div data-guide="chat-agents-tab" className="flex flex-col gap-3">
      {workspaces.map((workspace) => (
        <section key={workspace.id} className="min-w-0">
          {workspaces.length > 1 && (
            <h3 className="mb-1 truncate px-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
              {workspace.name}
            </h3>
          )}
          <WorkspaceAgentPanel workspaceId={workspace.id} framed={false} />
        </section>
      ))}
    </div>
  );
}

// The right-hand panel of an attached chat: a What's new report scoped to the chat's
// workspaces. Connected agents are listed in the sidebar, so the panel does not repeat them.
export default function ChatAgentSidebar({ conversationId }) {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const agents = useAgents();
  const chatLinks = useChatWorkspaces(conversationId);
  const agentLinks = useWorkspaceAgentLinks();
  const sessionLinks = useWorkspaceAgentSessionLinks();
  const workspaceChatLinks = useWorkspaceChatLinks();
  const workspaceList = useWorkspaceList();

  const workspaceIds = useMemo(
    () => [...new Set((chatLinks || []).map((link) => link.workspaceId))],
    [chatLinks],
  );

  const chatWorkspaces = useMemo(() => {
    const byId = new Map((workspaceList || []).map((row) => [row.id, row]));
    return workspaceIds
      .map((id) => byId.get(id))
      .filter((row) => Boolean(row));
  }, [workspaceIds, workspaceList]);

  const connectedAgents = useMemo(() => {
    const ids = new Set(
      (agentLinks || [])
        .filter((link) => workspaceIds.includes(link.workspaceId))
        .map((link) => link.agentId),
    );
    return agents.filter(
      (agent) =>
        ids.has(agent.id) ||
        (agent.bridgeWorkspaceId &&
          workspaceIds.includes(agent.bridgeWorkspaceId)),
    );
  }, [agents, agentLinks, workspaceIds]);

  // Give agents attached before per-workspace sessions existed their active session here too.
  useEffect(() => {
    for (const workspaceId of workspaceIds) {
      void seedWorkspaceAgentSessions(workspaceId, agents);
    }
  }, [agents, workspaceIds]);

  // Only sessions attached to one of this chat's workspaces are listed. Agents that reach the
  // chat only through the bridge keep their full list.
  const sessionIdsFor = useCallback(
    (agent) => {
      const attachedWorkspaceIds = workspaceIds.filter((workspaceId) =>
        (agentLinks || []).some(
          (link) =>
            link.workspaceId === workspaceId && link.agentId === agent.id,
        ),
      );
      if (!attachedWorkspaceIds.length) return null;
      const ids = new Set();
      for (const workspaceId of attachedWorkspaceIds) {
        for (const id of workspaceSessionIds(
          sessionLinks,
          workspaceId,
          agent.id,
        )) {
          ids.add(id);
        }
      }
      return ids;
    },
    [agentLinks, sessionLinks, workspaceIds],
  );

  // The What's new panel reports on this chat's workspaces only: their chats, their agents
  // and the sessions attached to them. The Meta chat calls getWhatsNew without a scope.
  const whatsNewScope = useMemo(() => {
    const sessionIds = {};
    for (const agent of connectedAgents) {
      const ids = sessionIdsFor(agent);
      if (ids) sessionIds[agent.id] = [...ids];
    }
    return {
      agentIds: connectedAgents.map((agent) => agent.id),
      sessionIds,
      conversationIds: [
        ...new Set(
          (workspaceChatLinks || [])
            .filter((link) => workspaceIds.includes(link.workspaceId))
            .map((link) => link.conversationId),
        ),
      ],
    };
  }, [connectedAgents, sessionIdsFor, workspaceChatLinks, workspaceIds]);

  // The panel's other tabs are the workspace itself: its files, the chats attached
  // to it, and the agent each one runs. They stay inside the panel so the chat page
  // keeps one right-hand column.
  const tabs = useMemo(
    () => [
      {
        id: "workspace",
        label: t("meta_chat.files_tab"),
        content: <WorkspaceFilesPanel workspaceIds={workspaceIds} />,
      },
      {
        id: "sessions",
        label: t("meta_chat.sessions_tab"),
        content: (
          <WorkspaceSessionsPanel
            workspaceIds={workspaceIds}
            activeConversationId={conversationId}
          />
        ),
      },
      {
        id: "agents",
        label: t("meta_chat.agents_tab"),
        content: <ChatAgentsPanel workspaces={chatWorkspaces} />,
      },
    ],
    [chatWorkspaces, conversationId, t, workspaceIds],
  );

  if (!workspaceIds.length) return null;

  return (
    <MetaChangesPanel
      userSettings={userSettings}
      scope={whatsNewScope}
      scopeKey={workspaceIds.join(",")}
      tabs={tabs}
    />
  );
}
