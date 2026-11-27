import { useParams } from "react-router";

import { useChatWorkspaces } from "../db/workspaceDb";

/**
 * The workspace a creation action belongs to.
 *
 * "Selected" means the workspace page is open (`/workspace/<id>`), or the open
 * chat is attached to a workspace. The oldest link wins, the same resolution
 * `getChatWorkspaceId` uses for the chat's own workspace bundle, so a chat in
 * several workspaces does not become ambiguous.
 *
 * Returns null when nothing is selected; callers then keep their old
 * behaviour (an unassigned chat).
 */
export function useActiveWorkspaceId(conversationId?: string): string | null {
  const params = useParams<{ workspaceId?: string }>();
  const chatLinks = useChatWorkspaces(conversationId);

  if (params.workspaceId) return params.workspaceId;
  const oldest = [...chatLinks].sort((a, b) => a.createdAt - b.createdAt)[0];
  return oldest?.workspaceId ?? null;
}
