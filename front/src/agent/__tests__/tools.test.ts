import { describe, expect, it, vi } from "vitest";
import { createTools } from "../tools";

// The media and document tools call the chat-ai endpoints; keep the test offline.
vi.mock("../../apis/agentEndpoints", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  convertDocument: vi.fn(async () => "# Converted"),
  transcribeAudio: vi.fn(async () => "transcript"),
  generateImage: vi.fn(async () => new Uint8Array([7])),
  editImage: vi.fn(async () => new Uint8Array([9])),
  generateSpeech: vi.fn(async () => new Uint8Array([8])),
  explainImage: vi.fn(async () => "a cat"),
}));

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

const textOf = (result: any) =>
  (result?.content ?? []).map((item: any) => item.text).join("");

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

  it("always offers the Browser agent even when an old chat stored codemode:false", () => {
    const names = toolNames({ vision: true, enabled: { codemode: false } });
    expect(names).toContain("codemode");
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

  it("offers Arcana Tools tools independently of browser storage", () => {
    expect(toolNames({ vision: true })).not.toContain("list_arcanas");
    const names = toolNames({ vision: true, enabled: { arcana_tools: true } });
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

  it("keeps the old remote file access switch working as Arcana Tools", () => {
    expect(
      toolNames({ vision: true, enabled: { remote_file_access: true } }),
    ).toContain("list_arcanas");
  });

  it("keeps the old arcana_v2 switch working as Arcana Tools", () => {
    expect(
      toolNames({ vision: true, enabled: { arcana_v2: true } }),
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

  it("offers delete only when storage and writing are both on", () => {
    expect(toolNames({ vision: true, enabled: { browser_storage: true } })).not.toContain("delete");
    expect(
      toolNames({ vision: true, enabled: { browser_storage: true, write_access: true } }),
    ).toContain("delete");
    expect(toolNames({ vision: true, enabled: { write_access: true } })).not.toContain("delete");
  });

  it("deletes a path through the VFS and refuses the storage root", async () => {
    const removed: string[] = [];
    const store = {
      ...fs,
      remove: async (path: string) => {
        removed.push(path);
      },
    };
    const deleteTool = createTools(store as any, {
      vision: true,
      enabled: { browser_storage: true, write_access: true },
    }).find((item) => item.name === "delete")!;

    expect(textOf(await deleteTool.execute("call", { path: "/notes/a.txt" }))).toBe(
      "Deleted /notes/a.txt",
    );
    expect(removed).toEqual(["/notes/a.txt"]);

    expect(textOf(await deleteTool.execute("call", { path: "/" }))).toContain(
      "Refusing to delete the storage root",
    );
    expect(removed).toEqual(["/notes/a.txt"]);
  });
});

describe("media and document tools with a workspace source", () => {
  const workspaceFiles = () => ({
    enabled: true,
    describe: () => "Team files: Shared documents (src-arcana)",
    read: vi.fn(async () => new TextEncoder().encode("document")),
    write: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    exists: vi.fn(async () => true),
  });

  const toolNamed = (fs: unknown, name: string, files?: ReturnType<typeof workspaceFiles>) =>
    createTools(fs as any, {
      vision: true,
      enabled: { browser_storage: true },
      ...(files ? { files } : {}),
    }).find((item) => item.name === name)!;

  it("reads and writes through the named source instead of the virtual filesystem", async () => {
    const files = workspaceFiles();
    const convert = toolNamed(fs, "convert_document", files);

    const output = textOf(
      await convert.execute("call", {
        source: "Shared documents",
        path: "/reports/report.pdf",
      }),
    );

    expect(files.read).toHaveBeenCalledWith(
      "Shared documents",
      "/reports/report.pdf",
    );
    expect(files.write).toHaveBeenCalledWith(
      "Shared documents",
      "/reports/report.pdf.md",
      "# Converted",
    );
    expect(output).toContain(
      'Wrote /reports/report.pdf.md in the workspace source "Shared documents"',
    );
  });

  it("keeps using the virtual filesystem when no source is given", async () => {
    const store = {
      ...fs,
      readFile: vi.fn(async () => new TextEncoder().encode("document")),
      writeFile: vi.fn(async () => {}),
    };
    const files = workspaceFiles();
    const convert = toolNamed(store, "convert_document", files);

    const output = textOf(
      await convert.execute("call", { path: "/reports/report.pdf" }),
    );

    expect(store.readFile).toHaveBeenCalledWith("/reports/report.pdf");
    expect(store.writeFile).toHaveBeenCalledWith(
      "/reports/report.pdf.md",
      "# Converted",
    );
    expect(files.read).not.toHaveBeenCalled();
    expect(output).toContain("Wrote /reports/report.pdf.md");
  });

  it("refuses a source when the chat has no workspace attached", async () => {
    const convert = toolNamed(fs, "convert_document");

    await expect(
      convert.execute("call", { source: "Shared documents", path: "/a.pdf" }),
    ).rejects.toThrow(/no workspace source|Attach a workspace/);
  });

  it("writes a generated image into the source", async () => {
    const files = workspaceFiles();
    const generate = toolNamed(fs, "generate_image", files);

    const output = textOf(
      await generate.execute("call", {
        source: "Shared documents",
        prompt: "a cat",
        path: "/art/cat.png",
      }),
    );

    expect(files.write).toHaveBeenCalledWith(
      "Shared documents",
      "/art/cat.png",
      expect.any(Uint8Array),
    );
    expect(output).toContain('Wrote /art/cat.png in the workspace source "Shared documents"');
  });
});
