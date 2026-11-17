import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceFilesPanel from "../WorkspaceFilesPanel";

const mocks = vi.hoisted(() => {
  const empty = [];
  const providers = new Map();
  const entriesByWorkspace = {};
  const providerFor = (workspaceId) => {
    let provider = providers.get(workspaceId);
    if (!provider) {
      provider = {
        sourceId: `workspace-root:${workspaceId}`,
        kind: "browser",
        status: "connected",
        capabilities: {},
        connect: vi.fn(async () => {}),
        list: vi.fn(async (path) => ({
          entries: entriesByWorkspace[workspaceId]?.[path] ?? [],
        })),
      };
      providers.set(workspaceId, provider);
    }
    return provider;
  };
  return {
    empty,
    providers,
    entriesByWorkspace,
    providerFor,
    workspaces: [],
    mountsByWorkspace: {},
    sourcesByWorkspace: {},
    conversations: [],
  };
});

vi.mock("../../../db", () => ({
  useConversationList: () => mocks.conversations,
}));
vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceList: () => mocks.workspaces,
  useWorkspaceMounts: (workspaceId) =>
    mocks.mountsByWorkspace[workspaceId] ?? mocks.empty,
  useWorkspaceSources: (workspaceId) =>
    mocks.sourcesByWorkspace[workspaceId] ?? mocks.empty,
}));
vi.mock("../../../workspace/workspaceRoot", () => ({
  createWorkspaceRootProvider: (workspaceId) => mocks.providerFor(workspaceId),
  workspaceRootSourceId: (workspaceId) => `workspace-root:${workspaceId}`,
}));

const entry = (workspaceId, path, name, kind = "file") => ({
  sourceId: `workspace-root:${workspaceId}`,
  path,
  name,
  kind,
});

const mount = (workspaceId, id, path, sourceId = `chat-storage:${workspaceId}:${id}`) => ({
  id,
  workspaceId,
  sourceId,
  sourcePath: "/",
  path,
  createdAt: 1,
  lastModified: 1,
});

beforeEach(() => {
  mocks.workspaces = [];
  mocks.mountsByWorkspace = {};
  mocks.sourcesByWorkspace = {};
  mocks.conversations = [];
  mocks.providers.clear();
  for (const workspaceId of Object.keys(mocks.entriesByWorkspace)) {
    delete mocks.entriesByWorkspace[workspaceId];
  }
});

describe("WorkspaceFilesPanel", () => {
  it("renders the root rows of two workspaces with one heading each", async () => {
    mocks.workspaces = [
      { id: "ws-1", name: "Research" },
      { id: "ws-2", name: "Notes" },
    ];
    mocks.entriesByWorkspace["ws-1"] = {
      "/": [entry("ws-1", "/readme.md", "readme.md")],
    };
    mocks.entriesByWorkspace["ws-2"] = {
      "/": [entry("ws-2", "/plan.md", "plan.md")],
    };

    render(<WorkspaceFilesPanel workspaceIds={["ws-1", "ws-2"]} />);

    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    expect(await screen.findByText("plan.md")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(2);
  });

  it("renders no heading for a single workspace", async () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.entriesByWorkspace["ws-1"] = {
      "/": [entry("ws-1", "/readme.md", "readme.md")],
    };

    render(<WorkspaceFilesPanel workspaceIds={["ws-1"]} />);

    expect(await screen.findByText("readme.md")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("shows a chat's conversation title instead of its id", async () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.entriesByWorkspace["ws-1"] = { "/": [] };
    mocks.mountsByWorkspace["ws-1"] = [
      mount("ws-1", "cf44c4a8-1b1d-4e4e-9d9e-111111111111", "/chats/cf44c4a8-1b1d-4e4e-9d9e-111111111111"),
    ];
    mocks.conversations = [
      { id: "cf44c4a8-1b1d-4e4e-9d9e-111111111111", title: "Trip planning" },
    ];

    render(<WorkspaceFilesPanel workspaceIds={["ws-1"]} />);

    fireEvent.click(await screen.findByText("chats"));

    expect(await screen.findByText("Trip planning")).toBeInTheDocument();
    expect(
      screen.queryByText("cf44c4a8-1b1d-4e4e-9d9e-111111111111"),
    ).toBeNull();
  });

  it("shows the empty text for an untouched workspace", async () => {
    mocks.workspaces = [{ id: "ws-empty", name: "Empty" }];
    mocks.entriesByWorkspace["ws-empty"] = { "/": [] };

    render(<WorkspaceFilesPanel workspaceIds={["ws-empty"]} />);

    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders rows without remove or trash buttons", async () => {
    mocks.workspaces = [{ id: "ws-1", name: "Research" }];
    mocks.entriesByWorkspace["ws-1"] = {
      "/": [entry("ws-1", "/notes.md", "notes.md")],
    };
    mocks.mountsByWorkspace["ws-1"] = [
      mount("ws-1", "mount-1", "/vendor", "local-1"),
    ];

    render(<WorkspaceFilesPanel workspaceIds={["ws-1"]} />);

    expect(await screen.findByText("notes.md")).toBeInTheDocument();
    expect(await screen.findByText("vendor")).toBeInTheDocument();
    expect(screen.queryByLabelText("Remove folder")).toBeNull();
    expect(screen.queryByLabelText("Make writable")).toBeNull();
  });
});
