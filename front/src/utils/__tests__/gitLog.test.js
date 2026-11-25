import { describe, expect, it } from "vitest";
import { formatGitLog, GIT_LOG_LIMIT } from "../gitLog";

const reflogLine = (index) => {
  const hash = index.toString(16).padStart(40, "0");
  const short = index.toString(16).padStart(7, "0");
  return `${hash} ${short} Author <author@example.com> ${1700000000 + index} +0100\tcommit: message ${index}`;
};

describe("formatGitLog", () => {
  it("keeps only the newest commits", () => {
    const raw = Array.from({ length: 25 }, (_, index) => reflogLine(index + 1))
      .join("\n");

    const text = formatGitLog(raw);
    const entries = text.split(/\n\n(?=━━━ )/);

    expect(GIT_LOG_LIMIT).toBe(10);
    expect(entries).toHaveLength(10);
    // Newest first: the last reflog entry appears at the top.
    expect(entries[0]).toContain("message 25");
    expect(entries[9]).toContain("message 16");
    expect(text).not.toContain("message 15");
  });

  it("formats the whole log when it is shorter than the limit", () => {
    const raw = [reflogLine(1), reflogLine(2)].join("\n");

    const text = formatGitLog(raw);

    expect(text).toContain("message 2");
    expect(text).toContain("message 1");
    expect(text.indexOf("message 2")).toBeLessThan(text.indexOf("message 1"));
  });
});
