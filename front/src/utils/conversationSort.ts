export type ConversationSortOrder =
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "title_asc"
  | "title_desc"
  | "size_desc";

export const DEFAULT_CONVERSATION_SORT: ConversationSortOrder = "created_desc";

type SortableConversation = {
  title?: string | null;
  createdAt: number;
  lastModified?: number;
  storageSize?: number;
};

export function sortConversations<T extends SortableConversation>(
  conversations: T[],
  order: ConversationSortOrder,
  untitledLabel = "Untitled Chat",
): T[] {
  const collator = new Intl.Collator(undefined, {
    sensitivity: "base",
    numeric: true,
  });
  const titleOf = (conversation: T) =>
    (conversation.title || untitledLabel).trim();

  const sorted = [...conversations];

  switch (order) {
    case "created_asc":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "updated_desc":
      return sorted.sort(
        (a, b) =>
          (b.lastModified ?? b.createdAt) - (a.lastModified ?? a.createdAt),
      );
    case "title_asc":
      return sorted.sort((a, b) => collator.compare(titleOf(a), titleOf(b)));
    case "title_desc":
      return sorted.sort((a, b) => collator.compare(titleOf(b), titleOf(a)));
    case "size_desc":
      return sorted.sort(
        (a, b) =>
          (b.storageSize ?? 0) - (a.storageSize ?? 0) ||
          b.createdAt - a.createdAt,
      );
    case "created_desc":
    default:
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
  }
}
