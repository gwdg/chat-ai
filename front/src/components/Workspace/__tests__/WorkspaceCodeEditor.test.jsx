import { render, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";

import WorkspaceCodeEditor from "../WorkspaceCodeEditor";

// CodeMirror renders into a real contenteditable, so the assertions read the
// editor's own DOM. The mount is the part that used to break when a wrapper was
// imported eagerly; the highlighting itself is visual and checked in a browser.
const viewOf = (container) =>
  EditorView.findFromDOM(container.querySelector(".cm-editor"));

describe("WorkspaceCodeEditor", () => {
  it("mounts the document it is given", async () => {
    const { container } = render(
      <WorkspaceCodeEditor
        value={"def hi():\n    return 1\n"}
        fileName="hello.py"
        onChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(viewOf(container)).not.toBeNull());
    expect(viewOf(container).state.doc.toString()).toBe(
      "def hi():\n    return 1\n",
    );
    expect(
      container.querySelector('[data-guide="workspace-editor"]'),
    ).not.toBeNull();
  });

  it("reports an edit with the whole document", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <WorkspaceCodeEditor value="hello" onChange={onChange} />,
    );
    await waitFor(() => expect(viewOf(container)).not.toBeNull());

    viewOf(container).dispatch({
      changes: { from: 0, to: 5, insert: "bye" },
    });

    expect(onChange).toHaveBeenCalledWith("bye");
  });

  it("replaces the document when the value changes from outside (Revert)", async () => {
    const { container, rerender } = render(
      <WorkspaceCodeEditor value="edited" onChange={vi.fn()} />,
    );
    await waitFor(() => expect(viewOf(container)).not.toBeNull());

    rerender(<WorkspaceCodeEditor value="saved" onChange={vi.fn()} />);

    expect(viewOf(container).state.doc.toString()).toBe("saved");
  });

  it("does not let a read-only file be typed into", async () => {
    const { container } = render(
      <WorkspaceCodeEditor value="locked" readOnly onChange={vi.fn()} />,
    );
    await waitFor(() => expect(viewOf(container)).not.toBeNull());

    expect(
      container.querySelector('[data-guide="workspace-editor"]'),
    ).toHaveAttribute("data-read-only", "true");
    expect(container.querySelector(".cm-content")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    // Read-only is a view setting, so the text is still there to read.
    expect(viewOf(container).state.doc.toString()).toBe("locked");
  });

  it("turns editing off again when read-only is switched on later", async () => {
    const { container, rerender } = render(
      <WorkspaceCodeEditor value="text" onChange={vi.fn()} />,
    );
    await waitFor(() => expect(viewOf(container)).not.toBeNull());

    rerender(<WorkspaceCodeEditor value="text" readOnly onChange={vi.fn()} />);

    expect(container.querySelector(".cm-content")).toHaveAttribute(
      "contenteditable",
      "false",
    );
  });
});
