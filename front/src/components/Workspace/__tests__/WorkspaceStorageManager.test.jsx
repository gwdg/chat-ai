import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  browserTargets: [],
  panelTargets: [],
  deviceSources: [],
  openModal: vi.fn(),
}));

vi.mock("../../../db/workspaceDb", () => ({
  useWorkspaceSources: () => [],
  useDeviceLocalSources: () => mocks.deviceSources,
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
  useModal: () => ({ openModal: mocks.openModal }),
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
  default: ({ activeTarget, onOpenDevice }) => {
    mocks.panelTargets.push(activeTarget);
    return (
      <button
        type="button"
        data-testid="sources-panel"
        onClick={() => onOpenDevice?.()}
      />
    );
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
  beforeEach(() => {
    mocks.deviceSources = [];
    mocks.openModal.mockClear();
  });

  it("opens the browser on Your Device before a folder is picked", () => {
    render(<WorkspaceStorageManager workspaceId="ws-1" allowDetach />);

    expect(mocks.browserTargets.at(-1)).toEqual({ drive: "device" });
    expect(mocks.panelTargets.at(-1)).toEqual({ drive: "device" });
  });

  it("opens Add source on Local folder from the device card", () => {
    render(<WorkspaceStorageManager workspaceId="ws-1" />);

    fireEvent.click(screen.getByTestId("sources-panel"));

    expect(mocks.openModal).toHaveBeenCalledWith("workspaceAddSource", {
      workspaceId: "ws-1",
      initialKind: "local",
    });
    expect(mocks.browserTargets.at(-1)).toEqual({ drive: "device" });
  });

  // This dialog is where a workspace's folders are picked, so the card asks for a
  // folder even when the browser already holds granted ones.
  it("opens the add-source dialog even when device folders are known", () => {
    mocks.deviceSources = [
      { id: "dev-1", kind: "local", label: "Phone", deviceId: "d" },
    ];

    render(<WorkspaceStorageManager workspaceId="ws-1" />);

    fireEvent.click(screen.getByTestId("sources-panel"));

    expect(mocks.openModal).toHaveBeenCalledWith("workspaceAddSource", {
      workspaceId: "ws-1",
      initialKind: "local",
    });
    expect(mocks.browserTargets.at(-1)).toEqual({ drive: "device" });
  });
});
