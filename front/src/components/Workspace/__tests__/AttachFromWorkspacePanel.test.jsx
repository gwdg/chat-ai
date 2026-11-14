import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttachFromWorkspacePanel from "../AttachFromWorkspacePanel";

const mocks = vi.hoisted(() => ({
  addAttachments: vi.fn(),
  notifyError: vi.fn(),
}));

const providers = new Map();
const sources = [];
const mounts = [];

const rootProvider = {
  sourceId: "workspace-root:workspace-1",
  kind: "browser",
  status: "connected",
  capabilities: {},
  connect: vi.fn(async () => {}),
  list: vi.fn(async (path) => ({
    entries:
      path === "/"
        ? [
            { sourceId: rootProvider.sourceId, path: "/docs", name: "docs", kind: "dir" },
            { sourceId: rootProvider.sourceId, path: "/notes.md", name: "notes.md", kind: "file", mime: "text/markdown", size: 5 },
          ]
        : [
            { sourceId: rootProvider.sourceId, path: `${path}/readme.txt`, name: "readme.txt", kind: "file", mime: "text/plain", size: 5 },
          ],
  })),
  read: vi.fn(async () => {
    const bytes = new TextEncoder().encode("hello");
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }),
};

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspace: () => ({ id: "workspace-1", name: "Research" }),
  useWorkspaceSources: () => sources,
  useWorkspaceMounts: () => mounts,
}));
vi.mock("../../../workspace/useWorkspaceProviders", () => ({
  useWorkspaceProviders: () => ({ providers, reconnect: vi.fn() }),
}));
vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: () => rootProvider,
  workspaceRootSourceId: (workspaceId) => `workspace-root:${workspaceId}`,
}));
vi.mock("../../../hooks/useAttachments", () => ({
  useAttachments: () => ({ addAttachments: mocks.addAttachments }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

const localState = {
  id: "conversation",
  messages: [{ role: "user", content: [{ type: "text", text: "" }] }],
  settings: { model: { id: "test-model" } },
};

beforeEach(() => {
  mocks.addAttachments.mockReset();
  mocks.notifyError.mockReset();
  rootProvider.list.mockClear();
  rootProvider.read.mockClear();
});

describe("AttachFromWorkspacePanel", () => {
  it("attaches a file read from the workspace tree", async () => {
    const onClose = vi.fn();
    render(
      <AttachFromWorkspacePanel
        workspaceIds={["workspace-1"]}
        localState={localState}
        setLocalState={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(await screen.findByText("Research")).toBeInTheDocument();
    fireEvent.click(await screen.findByText("notes.md"));

    await waitFor(() => expect(mocks.addAttachments).toHaveBeenCalledTimes(1));
    const [request] = mocks.addAttachments.mock.calls[0];
    const [file] = request.selectedFiles;
    expect(file.name).toBe("notes.md");
    expect(file.type).toBe("text/markdown");
    expect(await file.text()).toBe("hello");
    expect(onClose).toHaveBeenCalled();
  });

  it("loads files from an expanded folder", async () => {
    render(
      <AttachFromWorkspacePanel
        workspaceIds={["workspace-1"]}
        localState={localState}
        setLocalState={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText("docs"));
    fireEvent.click(await screen.findByText("readme.txt"));

    await waitFor(() => expect(mocks.addAttachments).toHaveBeenCalledTimes(1));
    const [file] = mocks.addAttachments.mock.calls[0][0].selectedFiles;
    expect(file.name).toBe("readme.txt");
    expect(await file.text()).toBe("hello");
  });
});
