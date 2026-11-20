export type ChatFolderLabelSource = {
  kind: string;
  label?: string | null;
  config?: { conversationId?: string } | null;
};

export type ChatFolderLabelConversation = {
  id: string;
  title?: string | null;
};

type ChatFolderLabelInput = {
  sources?: ChatFolderLabelSource[] | null;
  conversations?: ChatFolderLabelConversation[] | null;
};

const CHAT_FOLDER_PATH = /^\/chats\/([^/]+)\/?$/;

/**
 * The label for a chat's folder in the workspace root. Navigation keeps using
 * `/chats/<conversation id>`; only the visible row text comes from here.
 */
export function chatFolderLabel(
  path: string,
  { sources, conversations }: ChatFolderLabelInput = {},
): string | undefined {
  const match = CHAT_FOLDER_PATH.exec(String(path ?? "").trim());
  if (!match) return undefined;
  const conversationId = match[1];

  const conversation = (conversations ?? []).find(
    (candidate) => candidate.id === conversationId,
  );
  const title =
    typeof conversation?.title === "string" ? conversation.title.trim() : "";
  if (title) return title;

  const source = (sources ?? []).find(
    (candidate) =>
      candidate.kind === "chat" &&
      candidate.config?.conversationId === conversationId,
  );
  const label =
    typeof source?.label === "string" ? source.label.trim() : "";
  return label || undefined;
}
