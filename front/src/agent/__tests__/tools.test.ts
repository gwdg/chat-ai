import { describe, expect, it } from "vitest";
import { createTools } from "../tools";

const fs = {
  readFile: async () => new Uint8Array(),
  writeFile: async () => {},
  mkdir: async () => {},
  readdir: async () => [],
  stat: async () => null,
  remove: async () => {},
};

const toolNames = (options: Parameters<typeof createTools>[1]) =>
  createTools(fs as any, options).map((tool) => tool.name);

describe("agent tools", () => {
  it("offers no file tools until browser storage is enabled", () => {
    expect(toolNames({ vision: true })).toEqual([]);
  });

  it("offers image analysis by default once browser storage is on, for models with and without vision", () => {
    expect(toolNames({ vision: true, enabled: { browser_storage: true } })).toContain("explain_image");
    expect(toolNames({ vision: false, enabled: { browser_storage: true } })).toContain("explain_image");
  });

  it("removes image analysis when the local tool is switched off", () => {
    expect(
      toolNames({ vision: true, enabled: { browser_storage: true, image_analysis: false } }),
    ).not.toContain("explain_image");
  });

  it("keeps writing opt-in even with browser storage enabled", () => {
    const names = toolNames({ vision: true, enabled: { browser_storage: true } });
    expect(names).toContain("read");
    expect(names).not.toContain("write");
    expect(toolNames({ vision: true, enabled: { browser_storage: true, write_access: true } })).toContain(
      "write",
    );
  });
});
