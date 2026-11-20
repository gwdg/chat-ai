import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browserTargets: [],
  panelTargets: [],
}));

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceSources: () => [],
  useDeviceLocalSources: () => [],
  useWorkspaceMounts: () => [],
  useWorkspaceChats: () => [],
  useAllWorkspaceMounts: () => [],
  useAllWorkspaceChats: () => [],
  detachWorkspaceChat: vi.fn(),
  ensureSaiaFsSource: vi.fn(),
  removeWorkspaceMount: vi.fn(),
  unmountLocalFolder: vi.fn(),
}));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));

vi.mock("../../../hooks/useSaiaFsAccess", () => ({
  useSaiaFsAccess: () => "unavailable",
  SAIA_FS_AVAILABLE: "available",
}));

vi.mock("../../../workspace/addSelectionToWorkspace", () => ({
  addSelectionToWorkspace: vi.fn(),
}));

vi.mock("../../../workspace/localWorkspace", () => ({
  addLocalSourceToWorkspace: vi.fn(),
  pickDirectory: vi.fn(),
}));

vi.mock("../WorkspaceSourcesPanel", () => ({
  default: ({ activeTarget }) => {
    mocks.panelTargets.push(activeTarget);
    return <div data-testid="sources-panel" />;
  },
}));

vi.mock("../WorkspaceSourceBrowser", () => ({
  default: ({ target }) => {
    mocks.browserTargets.push(target);
    return <div data-testid="source-browser" />;
  },
}));

vi.mock("../WorkspaceStorageTree", () => ({
  default: () => <div data-testid="storage-tree" />,
}));

import WorkspaceStorageManager from "../WorkspaceStorageManager";

describe("WorkspaceStorageManager", () => {
  it("opens the browser on Your Device before a folder is picked", () => {
    render(<WorkspaceStorageManager workspaceId="ws-1" allowDetach />);

    expect(mocks.browserTargets.at(-1)).toEqual({ drive: "device" });
    expect(mocks.panelTargets.at(-1)).toEqual({ drive: "device" });
  });
});
