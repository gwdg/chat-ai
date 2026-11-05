import { describe, expect, it } from "vitest";
import {
  getDateBucket,
  groupConversationsByCreationDate,
  groupConversationsByDate,
} from "../conversationDates";
import { sortConversations } from "../conversationSort";

const now = new Date("2026-06-15T12:00:00Z").getTime();
const day = 24 * 60 * 60 * 1000;

describe("conversation dates and sorting", () => {
  it("assigns date buckets", () => {
    expect(getDateBucket(now, now)).toBe("today");
    expect(getDateBucket(now - day, now)).toBe("yesterday");
    expect(getDateBucket(now - 3 * day, now)).toBe("lastWeek");
    expect(getDateBucket(now - 15 * day, now)).toBe("lastMonth");
    expect(getDateBucket(now - 40 * day, now)).toBe("older");
  });

  it("groups by modified and creation dates", () => {
    const conversations = [
      { id: "a", createdAt: now, lastModified: now - 40 * day },
      { id: "b", createdAt: now - 40 * day, lastModified: now },
    ];
    expect(groupConversationsByDate(conversations, now)[0].key).toBe("today");
    expect(groupConversationsByCreationDate(conversations, now)[0].key).toBe("today");
  });

  it("sorts by creation, update, and title", () => {
    const conversations = [
      { title: "Beta", createdAt: 1, lastModified: 3 },
      { title: "Alpha", createdAt: 2, lastModified: 1 },
    ];
    expect(sortConversations(conversations, "created_desc")[0].title).toBe("Alpha");
    expect(sortConversations(conversations, "updated_desc")[0].title).toBe("Beta");
    expect(sortConversations(conversations, "title_asc")[0].title).toBe("Alpha");
  });
});
