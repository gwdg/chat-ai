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
  downloadFile: vi.fn(),
  listMembers: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  downloadBlob: vi.fn(),
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

vi.mock("../../../utils/download", () => ({
  downloadBlob: (...args) => mocks.downloadBlob(...args),
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
    downloadFile: (...args) => mocks.downloadFile(...args),
    listMembers: (...args) => mocks.listMembers(...args),
    addMember: (...args) => mocks.addMember(...args),
    removeMember: (...args) => mocks.removeMember(...args),
  };
  return {
    arcanasProvider: () => provider,
    arcanaDisplayName: (collection) => collection.name,
    arcanaFailureReason: (status) =>
      status && status !== "stored" && /fail|error/i.test(status)
        ? status.replace(/^failed:\s*/i, "").trim()
        : null,
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
  { name: "a.md", status: "indexed", chunks: 1, tags: ["alpha"], markdown: false },
  { name: "b.md", status: "indexed", chunks: 1, tags: ["beta"], markdown: false },
];

describe("ArcanaManagerModal", () => {
  beforeEach(() => {
    mocks.listFiles.mockReset();
    mocks.listTags.mockReset();
    mocks.search.mockReset();
    mocks.indexCollection.mockReset();
    mocks.uploadFile.mockReset();
    mocks.uploadTextFile.mockReset();
    mocks.downloadFile.mockReset();
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
    mocks.downloadFile.mockResolvedValue({
      name: "Wasserwerksschulung.md",
      blob: new Blob(["# Wasserwerksschulung"], {
        type: "text/markdown;charset=utf-8",
      }),
    });
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

    const expected = `${window.location.origin}/chat?arcana=alice/recipes&enable_tools=true`;
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

  it("shows why a file failed instead of only the badge", async () => {
    const reason =
      "conversion: Unexpected error during API request: Unexpected status code 404 from http://localhost:10000/public/v1/documents/convert";
    mocks.listFiles.mockResolvedValue([
      ...files,
      {
        name: "Wasserwerksschulung.pdf",
        status: `Failed: ${reason}`,
        chunks: 1,
        tags: [],
      },
    ]);

    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("Wasserwerksschulung.pdf");
    // The badge stays short, but the row carries the service's own reason.
    expect(screen.getByText("arcanas.status_failed")).toBeInTheDocument();
    expect(screen.getByText(reason)).toBeInTheDocument();
    expect(screen.getAllByTitle(`Failed: ${reason}`).length).toBeGreaterThan(0);
  });

  it("downloads the converted Markdown of a PDF from the file row", async () => {
    mocks.listFiles.mockResolvedValue([
      {
        name: "Wasserwerksschulung.pdf",
        status: "indexed",
        chunks: 12,
        tags: [],
        markdown: true,
      },
    ]);

    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("Wasserwerksschulung.pdf");
    // The tooltip says which of the two contents this saves.
    fireEvent.click(
      screen.getByRole("button", { name: "arcanas.download_markdown" }),
    );

    await waitFor(() =>
      expect(mocks.downloadFile).toHaveBeenCalledWith(
        "recipes",
        expect.objectContaining({
          name: "Wasserwerksschulung.pdf",
          markdown: true,
        }),
      ),
    );
    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Wasserwerksschulung.md",
    );
  });

  it("names a plain upload by its own name when it is downloaded", async () => {
    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    fireEvent.click(screen.getAllByRole("button", { name: "arcanas.download" })[0]);

    await waitFor(() =>
      expect(mocks.downloadFile).toHaveBeenCalledWith(
        "recipes",
        expect.objectContaining({ name: "a.md", markdown: false }),
      ),
    );
  });

  it("keeps the dialog usable when a download fails", async () => {
    mocks.downloadFile.mockRejectedValue(new Error("collection is unavailable"));

    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("a.md");
    fireEvent.click(screen.getAllByRole("button", { name: "arcanas.download" })[0]);

    await waitFor(() =>
      expect(mocks.notifyError).toHaveBeenCalledWith(
        "collection is unavailable",
      ),
    );
    expect(mocks.downloadBlob).not.toHaveBeenCalled();
  });

  it("reports the reason when a single file fails to index", async () => {
    const reason = "conversion: docling is unreachable";
    mocks.listFiles
      .mockResolvedValueOnce([
        { name: "Wasserwerksschulung.pdf", status: "stored", chunks: 0, tags: [] },
      ])
      .mockResolvedValue([
        {
          name: "Wasserwerksschulung.pdf",
          status: `Failed: ${reason}`,
          chunks: 0,
          tags: [],
        },
      ]);

    render(
      <ArcanaManagerModal
        isOpen
        onClose={() => {}}
        collection={collection}
      />,
    );

    await screen.findByText("Wasserwerksschulung.pdf");
    fireEvent.click(screen.getByText("arcanas.index"));

    // The dialog polls every 2.5 s, so this one waits for the real interval.
    await waitFor(
      () =>
        expect(mocks.t).toHaveBeenCalledWith(
          "arcanas.index_done_failed_one",
          { name: "Wasserwerksschulung.pdf", reason },
        ),
      { timeout: 6000 },
    );
    expect(mocks.notifyError).toHaveBeenCalledWith(
      "arcanas.index_done_failed_one",
      { autoClose: 8000 },
    );
  });

  it("shows the progress line immediately, before the first chunk", async () => {
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

  it("follows the index job an upload starts instead of keeping a stale failure", async () => {
    // The row was left over from an earlier attempt, and the service indexes
    // the new upload in the background: the listing right after the upload (and
    // the first poll) still carry the old text, which is not this run's result.
    const stale = {
      name: "doc.pdf",
      status: "Failed: conversion: 404",
      chunks: 0,
      tags: [],
    };
    const done = { ...stale, status: "Success", chunks: 12 };
    mocks.listFiles
      .mockResolvedValueOnce(files)
      .mockResolvedValueOnce([...files, stale])
      .mockResolvedValueOnce([...files, stale])
      .mockResolvedValue([...files, done]);

    // The poll sleeps 2.5 s per attempt; fake timers keep that deterministic.
    vi.useFakeTimers();
    try {
      render(
        <ArcanaManagerModal
          isOpen
          onClose={() => {}}
          collection={collection}
        />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByText("a.md")).toBeInTheDocument();

      fireEvent.change(document.querySelector('input[type="file"]'), {
        target: {
          files: [new File(["payload"], "doc.pdf", { type: "application/pdf" })],
        },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Storing it is reported; the old failure is not reported as this run's.
      expect(mocks.notifySuccess).toHaveBeenCalledWith("arcanas.upload_done");
      expect(mocks.t).toHaveBeenCalledWith("arcanas.upload_done", { count: 1 });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(mocks.listFiles).toHaveBeenCalledTimes(3);
      expect(mocks.notifyError).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2500);
      });
      expect(mocks.listFiles).toHaveBeenCalledTimes(4);
      expect(mocks.notifyError).not.toHaveBeenCalled();
      expect(screen.queryByText("conversion: 404")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
