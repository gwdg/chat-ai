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
  it("offers image analysis by default, for models with and without vision", () => {
    expect(toolNames({ vision: true })).toContain("explain_image");
    expect(toolNames({ vision: false })).toContain("explain_image");
  });

  it("removes image analysis when the local tool is switched off", () => {
    expect(toolNames({ vision: true, enabled: { image_analysis: false } })).not.toContain(
      "explain_image",
    );
  });
});
