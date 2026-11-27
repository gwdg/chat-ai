import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaManagerModal from "../ArcanaManagerModal";

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  listTags: vi.fn(),
  supportsTool: vi.fn(() => true),
  search: vi.fn(),
  indexCollection: vi.fn(),
  uploadFile: vi.fn(),
  uploadTextFile: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  t: vi.fn((key) => key),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  Trans: ({ i18nKey }) => i18nKey,
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));

vi.mock("../../../workspace/arcanas", () => {
  // One provider object for the lifetime of the module, like the real
  // singleton: a fresh object per render would change the modal's `reload`
  // callback on every render and spin the reload effect forever.
  const provider = {
    listFiles: (...args) => mocks.listFiles(...args),
    listTags: (...args) => mocks.listTags(...args),
    supportsTool: (...args) => mocks.supportsTool(...args),
    search: (...args) => mocks.search(...args),
    indexCollection: (...args) => mocks.indexCollection(...args),
    uploadFile: (...args) => mocks.uploadFile(...args),
    uploadTextFile: (...args) => mocks.uploadTextFile(...args),
    listMembers: (...args) => mocks.listMembers(...args),
    addMember: (...args) => mocks.addMember(...args),
    removeMember: (...args) => mocks.removeMember(...args),
  };
  return {
    arcanasProvider: () => provider,
    arcanaDisplayName: (collection) => collection.name,
    classifyArcanaFiles: () => "current",
    isArcanaIndexed: (status) => status !== "stored" && !/fail|error/i.test(status),
    updateArcanaStatus: vi.fn(),
  };
});

const collection = {
  name: "recipes",
  collection: "alice__recipes",
  owner: "alice",
  role: "owner",
  can_write: true,
  can_manage: true,
  shared: false,
};

const files = [
  { name: "a.md", status: "indexed", chunks: 1, tags: ["alpha"] },
  { name: "b.md", status: "indexed", chunks: 1, tags: ["beta"] },
];

describe("ArcanaManagerModal", () => {
  beforeEach(() => {
    mocks.listFiles.mockReset();
    mocks.listTags.mockReset();
    mocks.search.mockReset();
    mocks.indexCollection.mockReset();
    mocks.uploadFile.mockReset();
    mocks.uploadTextFile.mockReset();
    mocks.listMembers.mockReset();
    mocks.addMember.mockReset();
    mocks.removeMember.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
    mocks.listFiles.mockResolvedValue(files);
    mocks.listTags.mockResolvedValue([
      { name: "alpha", count: 1 },
      { name: "beta", count: 1 },
    ]);
    mocks.search.mockResolvedValue({
      results: [{ filename: "a.md", score: 0.9, text: "hit" }],
      raw: "",
    });
    mocks.indexCollection.mockResolvedValue("job-1");
    mocks.uploadFile.mockResolvedValue(undefined);
    mocks.uploadTextFile.mockResolvedValue(undefined);
    mocks.listMembers.mockResolvedValue([
      { user: "alice", role: "owner", kind: "user" },
      { user: "bob", role: "editor", kind: "user" },
    ]);
    mocks.addMember.mockResolvedValue(undefined);
    mocks.removeMember.mockResolvedValue(undefined);
  });

  it("filters the file list by tag and clears that filter again", async () => {
    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    expect(screen.getByText("b.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /alpha/ }));
    await waitFor(() => expect(screen.queryByText("b.md")).not.toBeInTheDocument());
    expect(screen.getByText("a.md")).toBeInTheDocument();

    fireEvent.click(screen.getByText("arcanas.clear_filter"));
    await waitFor(() => expect(screen.getByText("b.md")).toBeInTheDocument());
  });

  it("re-runs a search when the tag filter is cleared", async () => {
    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    fireEvent.click(screen.getByRole("button", { name: /alpha/ }));

    fireEvent.click(screen.getByText("arcanas.tab_search"));
    fireEvent.change(
      screen.getByPlaceholderText("arcanas.search_placeholder"),
      { target: { value: "water" } },
    );
    fireEvent.click(screen.getByText("arcanas.search"));
    await waitFor(() =>
      expect(mocks.search).toHaveBeenLastCalledWith(
        "recipes",
        "water",
        "previews",
        5,
        ["alpha"],
      ),
    );

    fireEvent.click(screen.getByText("arcanas.clear_filter"));
    await waitFor(() =>
      expect(mocks.search).toHaveBeenLastCalledWith(
        "recipes",
        "water",
        "previews",
        5,
        [],
      ),
    );
  });

  it("lists, adds and removes people on the Share tab", async () => {
    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    // The member list is only read when the tab is opened.
    expect(mocks.listMembers).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("arcanas.tab_share"));
    await screen.findByText("bob");
    expect(mocks.listMembers).toHaveBeenCalledWith("recipes");
    expect(screen.getByText("alice")).toBeInTheDocument();
    // The owner row cannot be removed, so only bob has a remove control.
    expect(screen.getAllByTitle("arcanas.share_remove")).toHaveLength(1);

    fireEvent.change(
      screen.getByPlaceholderText("arcanas.share_placeholder"),
      { target: { value: " Carol@Example.org " } },
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "reader" },
    });
    fireEvent.click(screen.getByRole("button", { name: "arcanas.share_add" }));

    await waitFor(() =>
      expect(mocks.addMember).toHaveBeenCalledWith(
        "recipes",
        "Carol@Example.org",
        "reader",
      ),
    );
    expect(mocks.notifySuccess).toHaveBeenCalledWith("arcanas.share_added");

    fireEvent.click(screen.getByTitle("arcanas.share_remove"));
    fireEvent.click(
      screen.getAllByRole("button", { name: "arcanas.share_remove" })[1],
    );
    await waitFor(() =>
      expect(mocks.removeMember).toHaveBeenCalledWith("recipes", "bob"),
    );
  });

  it("offers a chat link for the collection on the Share tab", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    fireEvent.click(screen.getByText("arcanas.tab_share"));
    await screen.findByText("bob");

    const expected = `${window.location.origin}/chat?arcana_share=alice__recipes`;
    const field = screen.getByLabelText("arcanas.share_link_title");
    expect(field).toHaveValue(expected);
    // The link opens a new chat rather than navigating this tab.
    expect(
      screen.getByRole("link", { name: "arcanas.share_link_open" }),
    ).toHaveAttribute("href", expected);

    fireEvent.click(
      screen.getByRole("button", { name: "arcanas.share_link_copy" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
    expect(
      await screen.findByText("arcanas.share_link_copied"),
    ).toBeInTheDocument();
  });

  it("shows a shared Arcana read-only and offers no sharing controls", async () => {
    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={{
          ...collection,
          owner: "bob",
          role: "reader",
          can_write: false,
          can_manage: false,
          shared: true,
        }}
      />,
    );

    await screen.findByText("a.md");
    fireEvent.click(screen.getByText("arcanas.tab_share"));

    await screen.findByText("alice");
    expect(screen.getByText("arcanas.share_owner_only")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("arcanas.share_placeholder"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle("arcanas.share_remove")).not.toBeInTheDocument();
  });

  it("shows the progress line immediately, before the first chunk", async () => {
    // A large document is several tool calls. The label has to move on the
    // click, otherwise the button looks dead until the first chunk is stored,
    // and then it moves per chunk.
    let report;
    let finish;
    mocks.uploadFile.mockImplementation((_display, _file, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    render(
      <ArcanaManagerModal isOpen onClose={() => {}} collection={collection} />,
    );
    await screen.findByText("a.md");

    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: {
        files: [new File(["payload"], "big.pdf", { type: "application/pdf" })],
      },
    });

    // Nothing has been accepted yet: 0 % is the immediate feedback.
    await waitFor(() =>
      expect(mocks.t).toHaveBeenCalledWith("arcanas.uploading_progress", {
        sent: 0,
        total: 1,
        percent: 0,
      }),
    );
    // The tooltip names the file, so a multi-file drop says which one is busy.
    expect(mocks.t).toHaveBeenCalledWith("arcanas.uploading_name", {
      name: "big.pdf",
    });

    act(() => report(512, 1024));
    await waitFor(() =>
      expect(mocks.t).toHaveBeenCalledWith("arcanas.uploading_progress", {
        sent: 0,
        total: 1,
        percent: 50,
      }),
    );
    finish();
    await waitFor(() => expect(mocks.notifySuccess).toHaveBeenCalled());
  });

  it("reports a failed upload instead of claiming it was stored", async () => {
    mocks.uploadFile.mockRejectedValue(new Error("MCP error -32001: Request timed out"));
    render(
      <ArcanaManagerModal isOpen onClose={() => {}} collection={collection} />,
    );
    await screen.findByText("a.md");

    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: {
        files: [new File(["payload"], "big.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(mocks.notifyError.mock.calls[0][0]).toContain("big.pdf");
    await waitFor(() => expect(mocks.listFiles).toHaveBeenCalledTimes(2));
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
  });
});
