import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportConversation } from "../useImportConversation";

const dbMocks = vi.hoisted(() => ({
  createConversation: vi.fn(async () => "new-conversation"),
  deleteConversation: vi.fn(async () => {}),
  ensureFolder: vi.fn(async () => "folder-id"),
  getFolder: vi.fn(async () => undefined),
  newId: vi.fn(() => "generated-id"),
  saveFileReady: vi.fn(async () => "file-123"),
}));

vi.mock("../../db", () => dbMocks);

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => vi.fn(),
  useSelector: (selector) =>
    selector({
      user_settings: {},
      interface_settings: { dark_mode: false },
    }),
}));

vi.mock("../useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

function importedConversation() {
  return {
    title: "Imported with file",
    messages: [
      { role: "system", content: "Be nice" },
      { role: "user", content: [{ type: "text", text: "See the file" }] },
      {
        role: "assistant",
        content: [
          {
            type: "file",
            file: {
              file_data: "data:application/pdf;base64,AAAA",
              filename: "doc",
            },
          },
        ],
      },
    ],
  };
}

describe("useImportConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("waits for imported files before creating the conversation", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(importedConversation(), true);
    });

    expect(dbMocks.saveFileReady).toHaveBeenCalledTimes(1);
    const [fileConversationId, file] = dbMocks.saveFileReady.mock.calls[0];
    expect(fileConversationId).toBe("generated-id");
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("doc.pdf");

    expect(dbMocks.createConversation).toHaveBeenCalledTimes(1);
    expect(
      dbMocks.saveFileReady.mock.invocationCallOrder[0],
    ).toBeLessThan(dbMocks.createConversation.mock.invocationCallOrder[0]);

    const params = dbMocks.createConversation.mock.calls[0][0];
    const assistant = params.messages.find(
      (message) => message.role === "assistant",
    );
    expect(assistant.content).toContainEqual({
      type: "file",
      fileId: "file-123",
    });
  });

  it("leaves an imported conversation unsorted when no topic is given", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(importedConversation(), true);
    });

    const params = dbMocks.createConversation.mock.calls[0][0];
    expect(params.folderId).toBeNull();
  });

  it("maps legacy tool names when importing a tool list", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(
        {
          title: "Old export",
          tools: [{ type: "arcana_v2" }, { type: "remote_file_access" }],
        },
        true,
      );
    });

    const params = dbMocks.createConversation.mock.calls[0][0];
    expect(params.settings.tools.arcana_tools).toBe(true);
    expect(params.settings.tools.arcana_v2).toBeUndefined();
    expect(params.settings.tools.remote_file_access).toBeUndefined();
  });

  it("maps legacy tool keys when importing a tool object", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(
        {
          title: "Old export",
          tools: { arcana_v2: true, browser_storage: true },
        },
        true,
      );
    });

    const params = dbMocks.createConversation.mock.calls[0][0];
    expect(params.settings.tools.arcana_tools).toBe(true);
    expect(params.settings.tools.browser_storage).toBe(true);
    expect(params.settings.tools.arcana_v2).toBeUndefined();
  });

  it("restores the collection binding of a chat created from a share link", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(
        {
          title: "Papers",
          arcana_share: { collection: "alice__papers", name: "Papers 2026" },
        },
        true,
      );
    });

    const params = dbMocks.createConversation.mock.calls[0][0];
    expect(params.settings.arcana_share).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "Papers 2026",
    });
    // The read tools are only offered while tools are enabled.
    expect(params.settings.enable_tools).toBe(true);
  });

  it("accepts a bare collection reference and drops an unusable one", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(
        { title: "Shared", arcana_share: "alice__papers" },
        true,
      );
    });
    expect(
      dbMocks.createConversation.mock.calls[0][0].settings.arcana_share,
    ).toEqual({
      collection: "alice__papers",
      owner: "alice",
      name: "papers",
    });

    dbMocks.createConversation.mockClear();
    await act(async () => {
      await result.current(
        { title: "Broken", arcana_share: { collection: "papers" } },
        true,
      );
    });
    expect(
      dbMocks.createConversation.mock.calls[0][0].settings.arcana_share,
    ).toBeUndefined();
  });

  it("restores the chat's list of collections with their descriptions", async () => {
    const { result } = renderHook(() => useImportConversation());

    await act(async () => {
      await result.current(
        {
          title: "Many",
          arcana_shares: [
            { collection: "alice/papers", description: " Papers " },
            { collection: "bob__notes", name: "Notes" },
            { collection: "alice__papers" },
            { collection: "papers" },
          ],
        },
        true,
      );
    });

    const params = dbMocks.createConversation.mock.calls[0][0];
    expect(params.settings.arcana_shares).toEqual([
      {
        collection: "alice__papers",
        owner: "alice",
        name: "papers",
        description: "Papers",
      },
      { collection: "bob__notes", owner: "bob", name: "Notes" },
    ]);
    expect(params.settings.enable_tools).toBe(true);
  });
});
