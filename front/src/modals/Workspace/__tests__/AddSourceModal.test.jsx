import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addSource = vi.fn();

vi.mock("../../../db/workspaceDb", () => ({
  addSource: (...args) => addSource(...args),
}));

// The modal only reads whether local MCP servers are configured.
vi.mock("react-redux", () => ({
  useSelector: () => ({ tools: { mcp: false }, mcp_servers: [] }),
}));

import AddSourceModal from "../AddSourceModal";

const stubPicker = (implementation) => {
  Object.defineProperty(window, "showDirectoryPicker", {
    value: vi.fn(implementation),
    configurable: true,
  });
};

describe("AddSourceModal local folder", () => {
  beforeEach(() => {
    addSource.mockReset();
    addSource.mockResolvedValue("source-1");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("adds the picked folder as a local source", async () => {
    const handle = { name: "project", kind: "directory" };
    stubPicker(async () => handle);

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(addSource.mock.calls[0][0]).toMatchObject({
      workspaceId: "ws-1",
      kind: "local",
      label: "project",
      handle,
    });
  });

  it("explains a picker that returns no folder instead of doing nothing", async () => {
    stubPicker(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    expect(
      await screen.findByText(/No folder was taken over/),
    ).toBeInTheDocument();
    expect(addSource).not.toHaveBeenCalled();
  });

  it("asks for read access only for a read-only source", async () => {
    const picker = vi.fn(async () => ({ name: "project", kind: "directory" }));
    Object.defineProperty(window, "showDirectoryPicker", {
      value: picker,
      configurable: true,
    });

    render(<AddSourceModal isOpen workspaceId="ws-1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(addSource).toHaveBeenCalledTimes(1));
    expect(picker).toHaveBeenCalledWith({ mode: "read" });
    expect(addSource.mock.calls[0][0]).toMatchObject({ readOnly: true });
  });
});
