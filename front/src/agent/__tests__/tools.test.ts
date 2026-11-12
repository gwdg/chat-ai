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
  it("offers no file tools until browser storage is enabled, but keeps codemode", () => {
    expect(toolNames({ vision: true })).toEqual(["codemode"]);
  });

  it("keeps codemode usable without file tools when browser storage is off", () => {
    const codemode = createTools(fs as any, { vision: true }).find(
      (tool) => tool.name === "codemode",
    );
    expect(codemode?.description).toContain("No file tools are available");
  });

  it("disables every file-dependent tool when browser storage is off", () => {
    const names = toolNames({
      vision: true,
      enabled: {
        browser_storage: false,
        write_access: true,
        web_search: true,
        create_docx: true,
        image_analysis: true,
        codemode: true,
      },
    });
    expect(names).toEqual(["codemode", "web_search"]);
  });

  it("offers analyze images and Word document for either storage source", () => {
    for (const options of [
      { vision: true, enabled: { browser_storage: true } },
      { vision: true, hasLocalFolder: true },
    ]) {
      const names = toolNames(options);
      expect(names).toContain("explain_image");
      expect(names).toContain("create_docx");
    }
  });

  it("enables file tools when a local folder is mounted without browser storage", () => {
    const names = toolNames({ vision: true, hasLocalFolder: true });
    expect(names).toContain("read");
    expect(names).toContain("codemode");
    expect(names).not.toContain("write");
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

  it("offers ArcanaV2 tools independently of browser storage", () => {
    expect(toolNames({ vision: true })).not.toContain("list_arcanas");
    const names = toolNames({ vision: true, enabled: { arcana_v2: true } });
    for (const name of [
      "list_arcanas",
      "create_arcana",
      "get_arcana",
      "list_arcana_files",
      "read_arcana_file",
      "start_index",
      "index_status",
      "index_job",
      "delete_index",
      "upload_arcana_file",
      "replace_arcana_file",
      "delete_arcana_file",
      "list_arcana_members",
      "add_arcana_member",
      "remove_arcana_member",
    ]) {
      expect(names).toContain(name);
    }
  });

  it("keeps the old remote file access switch working as ArcanaV2", () => {
    expect(
      toolNames({ vision: true, enabled: { remote_file_access: true } }),
    ).toContain("list_arcanas");
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
