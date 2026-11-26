import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaManagerModal from "../ArcanaManagerModal";

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  listTags: vi.fn(),
  supportsTool: vi.fn(() => true),
  search: vi.fn(),
  indexCollection: vi.fn(),
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
});
