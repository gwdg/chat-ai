import { describe, expect, it } from "vitest";

import { chatFolderLabel } from "../chatFolderName";

const conversations = [
  { id: "conv-1", title: "Trip planning" },
  { id: "conv-2", title: "   " },
];

const sources = [
  {
    kind: "chat",
    label: "Trip planning",
    config: { conversationId: "conv-1" },
  },
  {
    kind: "chat",
    label: "Derived chat label",
    config: { conversationId: "conv-2" },
  },
  {
    kind: "chat",
    label: "Derived chat label",
    config: { conversationId: "conv-3" },
  },
  {
    kind: "local",
    label: "Project",
    config: { conversationId: "conv-1" },
  },
];

describe("chatFolderLabel", () => {
  it("uses the conversation title for a chat folder", () => {
    expect(
      chatFolderLabel("/chats/conv-1", { sources, conversations }),
    ).toBe("Trip planning");
  });

  it("falls back to the derived chat source label", () => {
    expect(
      chatFolderLabel("/chats/conv-2", { sources, conversations }),
    ).toBe("Derived chat label");
    expect(
      chatFolderLabel("/chats/conv-3", { sources, conversations }),
    ).toBe("Derived chat label");
  });

  it("returns undefined when no title or chat source label exists", () => {
    expect(
      chatFolderLabel("/chats/conv-4", { sources, conversations }),
    ).toBeUndefined();
    expect(chatFolderLabel("/chats/conv-1")).toBeUndefined();
  });

  it("ignores paths that are not a chat folder", () => {
    expect(chatFolderLabel("/", { sources, conversations })).toBeUndefined();
    expect(chatFolderLabel("/chats", { sources, conversations })).toBeUndefined();
    expect(
      chatFolderLabel("/chats/conv-1/draft.md", { sources, conversations }),
    ).toBeUndefined();
    expect(
      chatFolderLabel("/other/conv-1", { sources, conversations }),
    ).toBeUndefined();
  });

  it("accepts a trailing slash", () => {
    expect(
      chatFolderLabel("/chats/conv-1/", { sources, conversations }),
    ).toBe("Trip planning");
  });
});
