import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../conversationUtils", () => ({
  getExportData: vi.fn(async () => ({ conversations: [{ id: "c1" }], version: "9.9.9" })),
}));

import { getExportData } from "../conversationUtils";
import { downloadLocalData, exportFileName } from "../dataExport";

describe("downloadLocalData", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });

  it("names the file with the username and a timestamp", () => {
    expect(exportFileName("json", "ali", new Date(2026, 10, 24, 9, 5, 7))).toBe(
      "ali-chat-ai-20261124-090507.json",
    );
  });

  it("writes the whole export and the settings into one JSON download", async () => {
    const clicked = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      clicked.push(this.download);
    };

    try {
      const name = await downloadLocalData({
        username: "ali",
        userSettings: { language: "en" },
      });

      expect(getExportData).toHaveBeenCalledTimes(1);
      expect(clicked).toEqual([name]);
      expect(name.startsWith("ali-chat-ai-")).toBe(true);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const blob = URL.createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe("application/json");
    } finally {
      HTMLAnchorElement.prototype.click = original;
    }
  });
});
