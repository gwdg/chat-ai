import { describe, expect, it } from "vitest";
import {
  formatCompactDate,
  formatFullTimestamp,
  formatMessageTimestamp,
  formatModifiedTime,
  formatRelativeTime,
  getDateBucket,
  groupConversationsByCreationDate,
  groupConversationsByDate,
} from "../conversationDates";
import { DEFAULT_CONVERSATION_SORT, sortConversations } from "../conversationSort";

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
      { createdAt: 0 },
    ];
    expect(sortConversations(conversations, "created_desc")[0].title).toBe("Alpha");
    expect(sortConversations(conversations, "created_asc")[0].title).toBeUndefined();
    expect(sortConversations(conversations, "updated_desc")[0].title).toBe("Beta");
    expect(sortConversations(conversations, "title_asc")[0].title).toBe("Alpha");
    expect(DEFAULT_CONVERSATION_SORT).toBe("created_desc");
  });

  it("formats dates for compact, modified, relative, and full views", () => {
    expect(formatCompactDate(0)).toBe("");
    expect(formatCompactDate(now, "en")).not.toBe("");
    expect(formatModifiedTime(0, "en", now)).toBe("");
    expect(formatModifiedTime(now, "en", now)).not.toBe("");
    expect(formatModifiedTime(now - 3 * day, "en", now)).not.toBe("");
    expect(formatModifiedTime(now - 15 * day, "en", now)).not.toBe("");
    expect(formatRelativeTime(0, "en", now)).toBe("");
    expect(formatRelativeTime(now - 10 * 1000, "en", now)).not.toBe("");
    expect(formatRelativeTime(now - 5 * 60 * 1000, "en", now)).not.toBe("");
    expect(formatRelativeTime(now - 2 * day, "en", now)).not.toBe("");
    expect(formatRelativeTime(now - 30 * day, "en", now)).not.toBe("");
    expect(formatFullTimestamp(0, "en")).toBe("");
    expect(formatFullTimestamp(now, "en")).not.toBe("");
    expect(formatMessageTimestamp(0, "en")).toBe("");
    expect(formatMessageTimestamp(now, "en")).toContain("2026");
  });
});
