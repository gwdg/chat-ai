import { useCallback, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

import { useAgents } from "../../agents/agentStore";
import {
  seedWorkspaceAgentSessions,
  useChatWorkspaces,
  useWorkspaceAgentLinks,
  useWorkspaceAgentSessionLinks,
  useWorkspaceChatLinks,
} from "../../db/workspaceDb";
import { workspaceSessionIds } from "../../agents/workspaceAgentSessions";
import MetaChangesPanel from "../Meta/MetaChangesPanel";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";

// The right-hand panel of an attached chat: a What's new report scoped to the chat's
// workspaces. Connected agents are listed in the sidebar, so the panel does not repeat them.
export default function ChatAgentSidebar({ conversationId }) {
  const userSettings = useSelector(selectUserSettings);
  const agents = useAgents();
  const chatLinks = useChatWorkspaces(conversationId);
  const agentLinks = useWorkspaceAgentLinks();
  const sessionLinks = useWorkspaceAgentSessionLinks();
  const workspaceChatLinks = useWorkspaceChatLinks();

  const workspaceIds = useMemo(
    () => [...new Set((chatLinks || []).map((link) => link.workspaceId))],
    [chatLinks],
  );

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

  if (!workspaceIds.length) return null;

  return (
    <MetaChangesPanel
      userSettings={userSettings}
      scope={whatsNewScope}
      scopeKey={workspaceIds.join(",")}
    />
  );
}
