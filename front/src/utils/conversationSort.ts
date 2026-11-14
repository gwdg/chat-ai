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
  createdAt?: number;
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
  const created = (conversation: T) =>
    conversation.createdAt ?? conversation.lastModified ?? 0;

  const sorted = [...conversations];

  switch (order) {
    case "created_asc":
      return sorted.sort((a, b) => created(a) - created(b));
    case "updated_desc":
      return sorted.sort(
        (a, b) =>
          (b.lastModified ?? created(b)) - (a.lastModified ?? created(a)),
      );
    case "title_asc":
      return sorted.sort((a, b) => collator.compare(titleOf(a), titleOf(b)));
    case "title_desc":
      return sorted.sort((a, b) => collator.compare(titleOf(b), titleOf(a)));
    case "size_desc":
      return sorted.sort(
        (a, b) =>
          (b.storageSize ?? 0) - (a.storageSize ?? 0) ||
          created(b) - created(a),
      );
    case "created_desc":
    default:
      return sorted.sort((a, b) => created(b) - created(a));
  }
}
