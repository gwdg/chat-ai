import { describe, expect, it } from "vitest";
import { buildOrganizationProposal } from "../conversationOrganizer";

const conversation = (id, title, extra = {}) => ({
  id,
  title,
  createdAt: 1,
  lastModified: 1,
  messageCount: 2,
  folderId: null,
  ...extra,
});

const getCategoryName = (id) => `Category ${id}`;

describe("conversation organizer", () => {
  it("proposes deletion of empty and duplicate chats", () => {
    const proposal = buildOrganizationProposal({
      conversations: [
        conversation("keep", "Same title", { lastModified: 10 }),
        conversation("dupe", "Same title", { lastModified: 5 }),
        conversation("empty", "Empty", { messageCount: 0 }),
      ],
      folders: [],
      getCategoryName,
    });

    expect(proposal.deletions.map((item) => item.conversationId)).toEqual(
      expect.arrayContaining(["empty", "dupe"]),
    );
    expect(
      proposal.deletions.find((item) => item.conversationId === "dupe"),
    ).toMatchObject({ reason: "duplicate", duplicateOfId: "keep" });
  });

  it("builds topics from AI groups and keeps existing topics", () => {
    const proposal = buildOrganizationProposal({
      conversations: [conversation("c1", "Chat one"), conversation("c2", "Chat two")],
      folders: [{ id: "f1", name: "Work", createdAt: 1 }],
      getCategoryName,
      aiGroups: [
        {
          name: "Work",
          existing_topic_id: "f1",
          conversation_ids: ["c1"],
        },
        {
          name: "New topic",
          conversation_ids: ["c2"],
        },
      ],
    });

    expect(proposal.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ suggestedName: "Work", folderId: "f1" }),
        expect.objectContaining({ suggestedName: "New topic" }),
      ]),
    );
    expect(proposal.moves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conversationId: "c1", topicKey: "existing:f1" }),
        expect.objectContaining({ conversationId: "c2" }),
      ]),
    );
  });

  it("renames topics from the AI tree", () => {
    const proposal = buildOrganizationProposal({
      conversations: [conversation("c1", "Chat one")],
      folders: [{ id: "f1", name: "Old", createdAt: 1 }],
      getCategoryName,
      aiTree: [{ topic_id: "f1", name: "Renamed", conversation_ids: ["c1"] }],
    });

    expect(proposal.topicRenames).toEqual([
      { folderId: "f1", name: "Renamed", previousName: "Old" },
    ]);
    expect(proposal.topics[0]).toMatchObject({
      suggestedName: "Old",
      folderId: "f1",
    });
  });

  it("falls back to category proposals without AI input", () => {
    const proposal = buildOrganizationProposal({
      conversations: [
        conversation("code-1", "Python debugging"),
        conversation("write-1", "Write an essay"),
      ],
      folders: [],
      getCategoryName,
    });
    expect(proposal.topics.length).toBeGreaterThan(0);
    expect(proposal.topics.every((topic) => topic.conversations.length > 0)).toBe(true);
  });
});
