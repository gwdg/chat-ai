import type { ConversationRow, FolderRow } from "../db/dbTypes";

export type OrganizerCategoryId =
  | "code"
  | "writing"
  | "research"
  | "data"
  | "planning"
  | "learning"
  | "health"
  | "travel"
  | "finance"
  | "creative";

type OrganizerCategory = {
  id: OrganizerCategoryId;
  pattern: RegExp;
};

const ORGANIZER_CATEGORIES: OrganizerCategory[] = [
  {
    id: "code",
    pattern:
      /\b(programm|python|javascript|typescript|react|vue|angular|node|rust|golang|java\b|sql|database|docker|kubernetes|git|linux|shell|script|html|css|api\b|debug|bug|algorithm)/i,
  },
  {
    id: "data",
    pattern:
      /\b(data|daten|analys|analytic|statistic|statistik|chart|diagram|excel|csv|spreadsheet|tabelle|table)/i,
  },
  {
    id: "research",
    pattern:
      /\b(research|recherche|study|studie|paper|thesis|dissertation|literature|literatur|source|quelle|science|wissenschaft|academic)/i,
  },
  {
    id: "writing",
    pattern:
      /\b(write|writing|schreib|essay|article|artikel|blog|email|e-mail|letter|brief|story|geschichte|translate|translation|übersetz|uebersetz|proofread|korrektur)/i,
  },
  {
    id: "learning",
    pattern:
      /\b(learn|lernen|course|kurs|exam|prüfung|pruefung|homework|hausaufgabe|school|schule|university|universität|universitaet|tutorial|lesson|lektion)/i,
  },
  {
    id: "planning",
    pattern:
      /\b(plan|planung|schedule|zeitplan|todo|to-do|task|aufgabe|project|projekt|roadmap|goal|ziel|organiz|organisier)/i,
  },
  {
    id: "health",
    pattern:
      /\b(health|gesundheit|medical|medizin|doctor|arzt|symptom|diet|diät|diaet|fitness|workout|sleep|schlaf)/i,
  },
  {
    id: "travel",
    pattern:
      /\b(travel|reise|trip|urlaub|flight|flug|hotel|vacation|ferien|itinerary|route)/i,
  },
  {
    id: "finance",
    pattern:
      /\b(finance|finanz|budget|money|geld|tax|steuer|invoice|rechnung|bank|salary|gehalt|investment)/i,
  },
  {
    id: "creative",
    pattern:
      /\b(idea|idee|brainstorm|design|logo|image|bild|music|musik|art|kunst|poem|gedicht|creative|kreativ)/i,
  },
];

const GENERIC_TITLES = new Set([
  "",
  "untitled chat",
  "untitled",
  "new chat",
  "neuer chat",
  "unbenannt",
  "unbenannter chat",
]);

export type ProposedTopic = {
  key: string;
  folderId: string | null;
  categoryId: OrganizerCategoryId | null;
  suggestedName?: string | null;
  color?: string | null;
  icon?: string | null;
  order?: number;
  conversations: ConversationRow[];
};

export type ProposedMove = {
  conversationId: string;
  topicKey: string;
};

export type ProposedDeletion = {
  conversationId: string;
  reason: "empty" | "duplicate";
  duplicateOfId?: string;
};

export type AIGroup = {
  name?: string;
  existing_topic_id?: string | null;
  existingTopicId?: string | null;
  color?: string | null;
  icon?: string | null;
  conversation_ids?: string[];
  conversationIds?: string[];
};

export type AIDeletion = {
  conversation_id?: string;
  conversationId?: string;
  reason?: string;
  duplicate_of?: string | null;
  duplicateOf?: string | null;
};

export type AITitle = {
  conversation_id?: string;
  conversationId?: string;
  title?: string;
};

export type AITopicRename = {
  topic_id?: string;
  topicId?: string;
  name?: string;
};

export type AITreeNode = {
  topic_id?: string;
  topicId?: string;
  name?: string;
  color?: string | null;
  icon?: string | null;
  conversation_ids?: string[];
  conversationIds?: string[];
};

export type ProposedTitleChange = {
  conversationId: string;
  title: string;
  previousTitle: string;
};

export type ProposedTopicRename = {
  folderId: string;
  name: string;
  previousName: string;
};

export type OrganizationProposal = {
  topics: ProposedTopic[];
  moves: ProposedMove[];
  titles: ProposedTitleChange[];
  topicRenames: ProposedTopicRename[];
  deletions: ProposedDeletion[];
};

type Destination =
  | { kind: "existing"; folder: FolderRow }
  | { kind: "category"; categoryId: OrganizerCategoryId };

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function conversationTitle(conversation: ConversationRow): string {
  return (conversation.title || "").trim();
}

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(normalize(title));
}

function isEmptyConversation(conversation: ConversationRow): boolean {
  if (typeof conversation.hasFirstPrompt === "boolean") {
    return !conversation.hasFirstPrompt;
  }
  return (conversation.messageCount ?? 0) === 0;
}

function findDestination(
  conversation: ConversationRow,
  sortedFolders: FolderRow[],
): Destination | null {
  const title = conversationTitle(conversation);
  const summary = (conversation.summary ?? "").trim();
  if ((!title || isGenericTitle(title)) && !summary) return null;

  const searchable = `${title}\n${summary}`.trim();
  const normalizedSearchable = normalize(searchable);

  for (const folder of sortedFolders) {
    const folderName = normalize(folder.name);
    if (folderName.length < 3) continue;
    if (normalizedSearchable.includes(folderName)) {
      return { kind: "existing", folder };
    }
  }

  for (const category of ORGANIZER_CATEGORIES) {
    if (category.pattern.test(searchable)) {
      return { kind: "category", categoryId: category.id };
    }
  }

  return null;
}

export function buildOrganizationProposal({
  conversations,
  folders,
  getCategoryName,
  aiGroups = null,
  aiDeletions = [],
  aiTitles = [],
  aiTopicRenames = [],
  aiTree = null,
}: {
  conversations: ConversationRow[];
  folders: FolderRow[];
  getCategoryName: (categoryId: OrganizerCategoryId) => string;
  aiGroups?: AIGroup[] | null;
  aiDeletions?: AIDeletion[] | null;
  aiTitles?: AITitle[] | null;
  aiTopicRenames?: AITopicRename[] | null;
  aiTree?: AITreeNode[] | null;
}): OrganizationProposal {
  if (Array.isArray(aiTree)) {
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    const groups: AIGroup[] = [];
    const renames: AITopicRename[] = [];

    for (const node of aiTree) {
      const topicId =
        typeof node?.topic_id === "string"
          ? node.topic_id
          : typeof node?.topicId === "string"
            ? node.topicId
            : "";
      const existing = folderById.get(topicId);
      const name =
        typeof node?.name === "string" ? node.name.trim() : "";
      const conversationIds = Array.isArray(node?.conversation_ids)
        ? node.conversation_ids
        : Array.isArray(node?.conversationIds)
          ? node.conversationIds
          : [];

      if (existing) {
        groups.push({
          name: name || existing.name,
          existing_topic_id: existing.id,
          color: node.color ?? null,
          icon: node.icon ?? null,
          conversation_ids: conversationIds,
        });
        if (name && name !== existing.name.trim()) {
          renames.push({ topic_id: existing.id, name });
        }
      } else if (name) {
        groups.push({
          name,
          existing_topic_id: "",
          color: node.color ?? null,
          icon: node.icon ?? null,
          conversation_ids: conversationIds,
        });
      }
    }

    return buildOrganizationProposal({
      conversations,
      folders,
      getCategoryName,
      aiGroups: groups,
      aiDeletions,
      aiTitles,
      aiTopicRenames: renames,
      aiTree: null,
    });
  }

  const deletions = new Map<string, ProposedDeletion>();
  const emptyIds = new Set<string>();

  for (const conversation of conversations) {
    if (!isEmptyConversation(conversation)) continue;
    emptyIds.add(conversation.id);
    deletions.set(conversation.id, {
      conversationId: conversation.id,
      reason: "empty",
    });
  }

  const byTitle = new Map<string, ConversationRow[]>();
  for (const conversation of conversations) {
    if (emptyIds.has(conversation.id)) continue;
    const title = conversationTitle(conversation);
    if (!title || isGenericTitle(title)) continue;
    const key = normalize(title);
    const group = byTitle.get(key);
    if (group) group.push(conversation);
    else byTitle.set(key, [conversation]);
  }

  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const [keep, ...duplicates] = [...group].sort(
      (a, b) =>
        (b.lastModified ?? b.createdAt) - (a.lastModified ?? a.createdAt),
    );
    for (const duplicate of duplicates) {
      deletions.set(duplicate.id, {
        conversationId: duplicate.id,
        reason: "duplicate",
        duplicateOfId: keep.id,
      });
    }
  }

  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const sortedFolders = [...folders].sort(
    (a, b) => b.name.trim().length - a.name.trim().length,
  );
  const folderByName = new Map(
    folders.map((folder) => [normalize(folder.name), folder]),
  );

  if (Array.isArray(aiGroups)) {
    const conversationById = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    const aiTopicsByKey = new Map<string, ProposedTopic>();
    const aiMoves: ProposedMove[] = [];
    const assigned = new Set<string>();
    const aiDeletionMap = new Map<string, ProposedDeletion>();

    for (const deletion of Array.isArray(aiDeletions) ? aiDeletions : []) {
      const conversationId =
        typeof deletion?.conversation_id === "string"
          ? deletion.conversation_id
          : typeof deletion?.conversationId === "string"
            ? deletion.conversationId
            : "";
      if (!conversationId || !conversationById.has(conversationId)) continue;

      const reason =
        deletion?.reason === "duplicate"
          ? "duplicate"
          : deletion?.reason === "empty"
            ? "empty"
            : null;
      if (!reason) continue;

      const duplicateOfId =
        typeof deletion?.duplicate_of === "string"
          ? deletion.duplicate_of
          : typeof deletion?.duplicateOf === "string"
            ? deletion.duplicateOf
            : "";

      if (
        reason === "duplicate" &&
        duplicateOfId &&
        duplicateOfId !== conversationId &&
        conversationById.has(duplicateOfId)
      ) {
        aiDeletionMap.set(conversationId, {
          conversationId,
          reason,
          duplicateOfId,
        });
      } else {
        aiDeletionMap.set(conversationId, { conversationId, reason });
      }
    }

    const deletedIds = new Set(aiDeletionMap.keys());
    const aiTitleChanges: ProposedTitleChange[] = [];
    const proposedTitles = new Map<string, string>();
    const aiTopicRenameChanges: ProposedTopicRename[] = [];
    const proposedTopicNames = new Map<string, string>();

    for (const rename of Array.isArray(aiTopicRenames) ? aiTopicRenames : []) {
      const topicId =
        typeof rename?.topic_id === "string"
          ? rename.topic_id
          : typeof rename?.topicId === "string"
            ? rename.topicId
            : "";
      const folder = folderById.get(topicId);
      if (!folder) continue;
      const name =
        typeof rename?.name === "string"
          ? rename.name.trim().replace(/\s+/g, " ")
          : "";
      if (!name || name === folder.name.trim()) continue;
      proposedTopicNames.set(topicId, name);
    }

    for (const [folderId, name] of proposedTopicNames) {
      aiTopicRenameChanges.push({
        folderId,
        name,
        previousName: folderById.get(folderId)!.name,
      });
    }

    for (const titleChange of Array.isArray(aiTitles) ? aiTitles : []) {
      const conversationId =
        typeof titleChange?.conversation_id === "string"
          ? titleChange.conversation_id
          : typeof titleChange?.conversationId === "string"
            ? titleChange.conversationId
            : "";
      const conversation = conversationById.get(conversationId);
      if (!conversation || deletedIds.has(conversationId)) continue;
      const title =
        typeof titleChange?.title === "string"
          ? titleChange.title.trim().replace(/\s+/g, " ")
          : "";
      if (!title || title === conversationTitle(conversation)) continue;
      proposedTitles.set(conversationId, title);
    }

    for (const [conversationId, title] of proposedTitles) {
      aiTitleChanges.push({
        conversationId,
        title,
        previousTitle: conversationTitle(
          conversationById.get(conversationId)!,
        ),
      });
    }

    for (let groupIndex = 0; groupIndex < aiGroups.length; groupIndex += 1) {
      const group = aiGroups[groupIndex];
      const rawIds = Array.isArray(group?.conversation_ids)
        ? group.conversation_ids
        : Array.isArray(group?.conversationIds)
          ? group.conversationIds
          : [];
      const groupConversations: ConversationRow[] = [];
      const groupIds = new Set<string>();

      for (const id of rawIds) {
        if (typeof id !== "string") continue;
        if (groupIds.has(id)) continue;
        const conversation = conversationById.get(id);
        if (!conversation) continue;
        if (emptyIds.has(conversation.id)) continue;
        if (deletedIds.has(conversation.id)) continue;
        if (assigned.has(conversation.id)) continue;
        groupIds.add(id);
        groupConversations.push(conversation);
      }

      if (!groupConversations.length) continue;

      const requestedName =
        typeof group?.name === "string" ? group.name.trim() : "";
      const requestedExistingId =
        typeof group?.existing_topic_id === "string"
          ? group.existing_topic_id
          : typeof group?.existingTopicId === "string"
            ? group.existingTopicId
            : "";
      const existingById = requestedExistingId
        ? folderById.get(requestedExistingId)
        : undefined;
      const existingByName =
        !existingById && requestedName
          ? folderByName.get(normalize(requestedName))
          : undefined;
      const existing = existingById ?? existingByName;

      let key: string;
      let folderId: string | null = null;
      let suggestedName: string | null = null;

      if (existing) {
        key = `existing:${existing.id}`;
        folderId = existing.id;
        suggestedName = existing.name;
      } else {
        if (!requestedName) continue;
        key = `new:${normalize(requestedName)}`;
        suggestedName = requestedName;
      }

      for (const conversation of groupConversations) {
        assigned.add(conversation.id);
      }

      let topic = aiTopicsByKey.get(key);
      if (!topic) {
        topic = {
          key,
          folderId,
          categoryId: null,
          suggestedName,
          color: group.color ?? null,
          icon: group.icon ?? null,
          order: groupIndex,
          conversations: [],
        };
        aiTopicsByKey.set(key, topic);
      }

      for (const conversation of groupConversations) {
        topic.conversations.push(conversation);
        if (folderId && conversation.folderId === folderId) continue;
        aiMoves.push({
          conversationId: conversation.id,
          topicKey: key,
        });
      }
    }

    return {
      topics: [...aiTopicsByKey.values()].filter(
        (topic) => topic.conversations.length > 0,
      ),
      moves: aiMoves,
      titles: aiTitleChanges,
      topicRenames: aiTopicRenameChanges,
      deletions: [...aiDeletionMap.values()],
    };
  }

  const topicsByKey = new Map<string, ProposedTopic>();
  const moves: ProposedMove[] = [];

  for (const conversation of conversations) {
    if (emptyIds.has(conversation.id)) continue;

    if (conversation.folderId && knownFolderIds.has(conversation.folderId)) {
      continue;
    }

    const destination = findDestination(conversation, sortedFolders);
    if (!destination) continue;

    let key: string;
    let folderId: string | null = null;
    let categoryId: OrganizerCategoryId | null = null;

    if (destination.kind === "existing") {
      key = `existing:${destination.folder.id}`;
      folderId = destination.folder.id;
    } else {
      categoryId = destination.categoryId;
      const categoryName = getCategoryName(categoryId);
      const existing = folderByName.get(normalize(categoryName));
      if (existing) {
        key = `existing:${existing.id}`;
        folderId = existing.id;
      } else {
        key = `new:${categoryId}`;
      }
    }

    let topic = topicsByKey.get(key);
    if (!topic) {
      topic = { key, folderId, categoryId, conversations: [] };
      topicsByKey.set(key, topic);
    }
    topic.conversations.push(conversation);
    moves.push({ conversationId: conversation.id, topicKey: key });
  }

  return {
    topics: [...topicsByKey.values()].filter(
      (topic) => topic.conversations.length > 0,
    ),
    moves,
    titles: [],
    topicRenames: [],
    deletions: [...deletions.values()],
  };
}
