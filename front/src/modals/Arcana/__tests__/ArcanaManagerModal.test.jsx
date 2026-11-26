import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaManagerModal from "../ArcanaManagerModal";

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  listTags: vi.fn(),
  supportsTool: vi.fn(() => true),
  search: vi.fn(),
  indexCollection: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
  Trans: ({ i18nKey }) => i18nKey,
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));

vi.mock("../../../workspace/arcanas", () => ({
  arcanasProvider: () => ({
    listFiles: mocks.listFiles,
    listTags: mocks.listTags,
    supportsTool: mocks.supportsTool,
    search: mocks.search,
    indexCollection: mocks.indexCollection,
    listMembers: mocks.listMembers,
    addMember: mocks.addMember,
    removeMember: mocks.removeMember,
  }),
  arcanaDisplayName: (collection) => collection.name,
  classifyArcanaFiles: () => "current",
  isArcanaIndexed: (status) => status !== "stored" && !/fail|error/i.test(status),
  updateArcanaStatus: vi.fn(),
}));

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
});
