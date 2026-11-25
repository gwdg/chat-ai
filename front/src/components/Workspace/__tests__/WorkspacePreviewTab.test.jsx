import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Describe button only depends on this hook; its own behaviour is covered by
// DescribeImageButton.test.jsx. Here it answers "no vision model", so the button
// must be present (greyed out) rather than asking the network.
vi.mock("../../../hooks/useVisionModelAvailable", () => ({
  useVisionModelAvailable: () => false,
}));

// The shared Describe button reads the toast helper from Redux; only its disabled
// state matters here, so the toast is stubbed out.
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

// CodeMirror needs a real layout engine, so the tab tests drive the wrapper's
// contract instead: the value it is given, the edits it reports and the
// read-only flag. The editor's own rendering is exercised in the browser.
vi.mock("../WorkspaceCodeEditor", () => ({
  default: ({ value, fileName, readOnly, onChange }) => (
    <textarea
      data-testid="code-editor"
      data-file={fileName}
      data-read-only={readOnly ? "true" : "false"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

// Typst rendering pulls in the compiler, its consent prompt and the shared SVG
// cache; the offer is what the tab owns, so the document itself is a stub here.
vi.mock("../../Conversation/MessageAssistant/TypstDocument", () => ({
  default: ({ content, resolveFile, onDecline }) => (
    <div
      data-testid="typst-document"
      data-resolver={resolveFile ? "true" : "false"}
    >
      <span data-testid="typst-source">{content}</span>
      <button type="button" onClick={onDecline}>
        decline
      </button>
    </div>
  ),
}));

import WorkspacePreviewTab from "../WorkspacePreviewTab";
import {
  getEditorDraft,
  resetEditorDrafts,
} from "../../../workspace/editorDrafts";

const preview = {
  entry: { name: "notes.txt", mime: "text/plain", size: 5 },
  text: "hello",
  loading: false,
};

const codePreview = (overrides = {}) => ({
  entry: { name: "main.py", mime: "text/x-python", size: 12 },
  text: "print('hi')\n",
  editor: {
    draftKey: "ws-1|root|/main.py",
    readOnly: false,
    save: vi.fn(async () => 15),
  },
  ...overrides,
});

const renderTab = (props = {}) =>
  render(
    <WorkspacePreviewTab
      preview={preview}
      onClose={vi.fn()}
      {...props}
    />
  );

const openEditor = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));

beforeEach(() => {
  resetEditorDrafts();
});

describe("WorkspacePreviewTab", () => {
  it("renders the file name and the mime and size subtitle", () => {
    renderTab();

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("text/plain · 5 B")).toBeInTheDocument();
  });

  it("shows the file's own content, not just its name", () => {
    renderTab();

    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    const onClose = vi.fn();
    renderTab({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hands the entry to onDownload", () => {
    const onDownload = vi.fn();
    renderTab({ onDownload });

    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(onDownload).toHaveBeenCalledWith(preview.entry);
  });

  it("omits the download button when no onDownload is given", () => {
    renderTab();

    expect(
      screen.queryByRole("button", { name: "Download" }),
    ).not.toBeInTheDocument();
  });

  it("offers Describe left of Download for an image", () => {
    renderTab({
      preview: {
        entry: { name: "chart.png", mime: "image/png", size: 12 },
        url: "blob:chart",
      },
      onDownload: vi.fn(),
    });

    const describe = screen.getByTestId("describe-image");
    const download = screen.getByRole("button", { name: "Download" });
    expect(
      describe.compareDocumentPosition(download) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No vision model in this deployment, so the action stays greyed out.
    expect(describe).toBeDisabled();
  });

  it("offers no Describe action for a text file", () => {
    renderTab();

    expect(screen.queryByTestId("describe-image")).not.toBeInTheDocument();
  });
});

describe("WorkspacePreviewTab preview and edit", () => {
  it("opens a code file as a read-only preview", async () => {
    renderTab({ preview: codePreview() });

    const editor = await screen.findByTestId("code-editor");
    expect(editor).toHaveValue("print('hi')\n");
    expect(editor).toHaveAttribute("data-file", "main.py");
    // Clicking a file shows it; it must not hand the user a document to type in.
    expect(editor).toHaveAttribute("data-read-only", "true");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("All changes saved")).not.toBeInTheDocument();
  });

  it("ignores an edit in the preview and keeps the file unchanged", async () => {
    renderTab({ preview: codePreview() });

    fireEvent.change(await screen.findByTestId("code-editor"), {
      target: { value: "typed by accident\n" },
    });

    expect(getEditorDraft("ws-1|root|/main.py")).toBeUndefined();
    expect(screen.getByTestId("code-editor")).toHaveValue("print('hi')\n");
  });

  it("makes the text editable through Edit, beside Preview", async () => {
    renderTab({ preview: codePreview() });

    openEditor();

    const editor = await screen.findByTestId("code-editor");
    expect(editor).toHaveAttribute("data-read-only", "false");
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
  });

  it("saves the edited text and clears the draft", async () => {
    const preview = codePreview();
    renderTab({ preview });
    openEditor();

    fireEvent.change(await screen.findByTestId("code-editor"), {
      target: { value: "print('bye')\n" },
    });

    // An edit is a draft before it is a file, so the store holds it at once.
    expect(getEditorDraft("ws-1|root|/main.py")).toEqual({
      text: "print('bye')\n",
      base: "print('hi')\n",
    });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(preview.editor.save).toHaveBeenCalledWith("print('bye')\n"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument(),
    );
    expect(getEditorDraft("ws-1|root|/main.py")).toBeUndefined();
    // The header follows the size the provider reported back.
    expect(screen.getByText("text/x-python · 15 B")).toBeInTheDocument();
  });

  it("saves with Ctrl+S while editing", async () => {
    const preview = codePreview();
    renderTab({ preview });
    openEditor();

    fireEvent.change(await screen.findByTestId("code-editor"), {
      target: { value: "x = 1\n" },
    });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    await waitFor(() =>
      expect(preview.editor.save).toHaveBeenCalledWith("x = 1\n"),
    );
  });

  it("reverts to the saved text and drops the draft", async () => {
    renderTab({ preview: codePreview() });
    openEditor();

    const editor = await screen.findByTestId("code-editor");
    fireEvent.change(editor, { target: { value: "changed\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Revert changes" }));

    expect(editor).toHaveValue("print('hi')\n");
    expect(getEditorDraft("ws-1|root|/main.py")).toBeUndefined();
  });

  it("keeps a draft that a later visit restores", async () => {
    const preview = codePreview();
    const { unmount } = renderTab({ preview });
    openEditor();
    fireEvent.change(await screen.findByTestId("code-editor"), {
      target: { value: "draft\n" },
    });
    unmount();

    renderTab({ preview });

    // The read-only preview shows the unsaved text, and the header says so.
    expect(await screen.findByTestId("code-editor")).toHaveValue("draft\n");
    expect(screen.getByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.getByLabelText("Unsaved changes")).toBeInTheDocument();
  });

  it("reports a failed save and keeps the unsaved text", async () => {
    const preview = codePreview();
    preview.editor.save = vi.fn(async () => {
      throw new Error("disk full");
    });
    renderTab({ preview });
    openEditor();

    fireEvent.change(await screen.findByTestId("code-editor"), {
      target: { value: "too much\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("Could not save: disk full"),
    ).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(getEditorDraft("ws-1|root|/main.py")?.text).toBe("too much\n");
  });

  it("opens Markdown, HTML and CSV rendered and toggles to the editor", async () => {
    renderTab({
      preview: {
        entry: { name: "people.csv", mime: "text/csv", size: 20 },
        text: "name,age\nada,36\n",
        editor: {
          draftKey: "ws-1|root|/people.csv",
          readOnly: false,
          save: vi.fn(async () => 20),
        },
      },
    });

    // The table is the default view, and the toggle is offered beside it.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();

    openEditor();

    expect(await screen.findByTestId("code-editor")).toHaveValue(
      "name,age\nada,36\n",
    );
    expect(screen.getByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("offers no Edit at all for a read-only file", async () => {
    renderTab({
      preview: codePreview({
        editor: {
          draftKey: "ws-1|dev-1|/notes.txt",
          readOnly: true,
        },
      }),
    });

    // The highlighted, read-only view is still there — only writing is not.
    expect(await screen.findByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revert changes" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the plain preview for a file that has no editor", () => {
    renderTab({
      preview: {
        entry: { name: "huge.log", mime: "text/plain", size: 9e6 },
        text: "one line",
      },
    });

    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    expect(screen.getByText("one line")).toBeInTheDocument();
  });

  it("does not hand the request's key to the preview body", () => {
    // `key` is the mount identity the pane already used; spreading it into
    // FilePreviewContent is a React warning and would suppress the read.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    renderTab({ preview: { ...preview, key: "ws-1|root|/notes.txt#1" } });

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(
      error.mock.calls.some((call) => String(call[0]).includes("key")),
    ).toBe(false);
    error.mockRestore();
  });

  it("offers Typst rendering even for a file too large for the editor", () => {
    renderTab({
      preview: {
        entry: { name: "huge.typ", mime: "text/x-typst", size: 9e6 },
        text: "#set text(size: 12pt)\nHello",
      },
    });

    // Even without an editor, the Typst source is text: rendering it is still on
    // offer, while Edit never is.
    expect(
      screen.getByRole("button", { name: "Render Typst" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));

    // Without a source view there is no second pane to put beside it.
    expect(screen.getByTestId("typst-document")).toBeInTheDocument();
    expect(
      document.querySelector('[data-guide="workspace-typst-source"]'),
    ).toBeNull();
  });
});

describe("WorkspacePreviewTab Typst rendering", () => {
  const typstPreview = () => ({
    entry: { name: "report.typ", mime: "text/x-typst", size: 24 },
    text: "#set text(size: 12pt)\nHello",
    editor: {
      draftKey: "ws-1|root|/report.typ",
      readOnly: false,
      save: vi.fn(async () => 24),
    },
  });

  it("opens a Typst file as read-only source and offers to render it", async () => {
    renderTab({ preview: typstPreview() });

    // The source is the default view, highlighted and read-only like any code.
    expect(await screen.findByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.getByTestId("code-editor")).toHaveValue(
      "#set text(size: 12pt)\nHello",
    );
    expect(screen.queryByTestId("typst-document")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Render Typst" }),
    ).toBeInTheDocument();
  });

  it("renders the document in a second pane beside the source", async () => {
    renderTab({ preview: typstPreview() });
    await screen.findByTestId("code-editor");

    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));

    expect(screen.getByTestId("typst-document")).toBeInTheDocument();
    expect(screen.getByTestId("typst-source")).toHaveTextContent(
      "#set text(size: 12pt) Hello",
    );
    // The document does not replace the source: rendering opens a pane beside it,
    // which is what makes the two usable together.
    expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    expect(document.querySelector('[data-guide="workspace-typst-panel"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show source" }));

    expect(screen.queryByTestId("typst-document")).not.toBeInTheDocument();
    expect(await screen.findByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
  });

  it("goes back to the source when the renderer download is declined", async () => {
    renderTab({ preview: typstPreview() });
    await screen.findByTestId("code-editor");

    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));
    fireEvent.click(screen.getByRole("button", { name: "decline" }));

    expect(screen.queryByTestId("typst-document")).not.toBeInTheDocument();
    expect(await screen.findByTestId("code-editor")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Render Typst" }),
    ).toBeInTheDocument();
  });

  it("keeps the render offer while editing and follows the typed text", async () => {
    renderTab({ preview: typstPreview() });
    await screen.findByTestId("code-editor");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    // The watch pane is exactly what an edit is for: the offer stays.
    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));

    const editor = screen.getByTestId("code-editor");
    expect(editor).toHaveAttribute("data-read-only", "false");
    expect(screen.getByTestId("typst-document")).toBeInTheDocument();

    fireEvent.change(editor, { target: { value: "= Live\n\nText" } });

    // The document is handed the draft, not the saved file, so it re-renders as
    // the user types (the compiler debounces the burst).
    expect(screen.getByTestId("typst-source")).toHaveTextContent("= Live Text");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByTestId("code-editor")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.getByTestId("typst-document")).toBeInTheDocument();
  });

  it("offers no Typst render for a file that is not Typst", async () => {
    renderTab({ preview: codePreview() });
    await screen.findByTestId("code-editor");

    expect(
      screen.queryByRole("button", { name: "Render Typst" }),
    ).not.toBeInTheDocument();
  });

  it("hands the document the resolver for the files it includes", async () => {
    // `#include`/`#image` siblings are read through the tree's resolver; without
    // it the compiler sees only the main source and denies every reference.
    const resolveFile = vi.fn(async () => new Uint8Array());
    renderTab({
      preview: { ...typstPreview(), typst: { resolveFile } },
    });
    await screen.findByTestId("code-editor");

    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));

    expect(screen.getByTestId("typst-document")).toHaveAttribute(
      "data-resolver",
      "true",
    );
    expect(resolveFile).not.toHaveBeenCalled();
  });

  it("renders a Typst document with no resolver as before", async () => {
    renderTab({ preview: typstPreview() });
    await screen.findByTestId("code-editor");

    fireEvent.click(screen.getByRole("button", { name: "Render Typst" }));

    expect(screen.getByTestId("typst-document")).toHaveAttribute(
      "data-resolver",
      "false",
    );
  });
});
