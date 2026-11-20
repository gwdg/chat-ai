import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import AgentList from "../AgentList";
import {
  addAgent,
  getAgent,
  removeAgent,
  setAgentPinned,
} from "../../../agents/agentStore";
import { db } from "../../../db";
import {
  attachWorkspaceAgent,
  attachWorkspaceAgentSession,
  createWorkspace,
} from "../../../db/workspaceDb";
import { buildSessionTree } from "../../../agents/agentSessions";
import { pinnedStateId } from "../pinnedState";
import {
  agentProjectCollapseId,
  workspaceAgentCollapseId,
} from "../sessionGroupCollapse";
import { toggleTopic } from "../../../Redux/reducers/interfaceSettingsSlice";
import {
  AGENT_SESSION_DRAG_MIME,
  AGENT_SESSION_SOURCE_WORKSPACE_MIME,
  clearAgentSessionDrag,
} from "../sessionDrop";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  interrupt: vi.fn(async () => null),
  deleteSession: vi.fn(async () => null),
  status: vi.fn(async () => ({})),
  notifyError: vi.fn(),
  deleteServiceAgent: vi.fn(async () => null),
  sessionTree: { roots: [], all: [], children: new Map() },
}));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  interruptOpencodeSession: (...args) => mocks.interrupt(...args),
  deleteOpencodeSession: (...args) => mocks.deleteSession(...args),
  getOpencodeSessionStatus: (...args) => mocks.status(...args),
  opencodeDefaults: () => ({ serverUrl: "", username: "opencode", password: "" }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));
vi.mock("../../../apis/agentService", () => ({
  deleteServiceAgent: (...args) => mocks.deleteServiceAgent(...args),
}));
// The session list otherwise needs a live agent server; the tree is the part the
// grouping and the row menu read.
vi.mock("../../../agents/agentSessions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchAgentSessions: vi.fn(async () => mocks.sessionTree),
  };
});

beforeEach(async () => {
  mocks.openModal.mockReset();
  mocks.interrupt.mockReset();
  mocks.deleteSession.mockReset();
  mocks.status.mockReset();
  mocks.notifyError.mockReset();
  mocks.deleteServiceAgent.mockReset();
  mocks.interrupt.mockResolvedValue(null);
  mocks.deleteSession.mockResolvedValue(null);
  mocks.status.mockResolvedValue({});
  mocks.deleteServiceAgent.mockResolvedValue(null);
  mocks.sessionTree = { roots: [], all: [], children: new Map() };
  localStorage.clear();
  // The drag payload lives in module state until a dragend or drop clears it.
  clearAgentSessionDrag();
  removeAgent("agent-1");
  removeAgent("agent-2");
  await db.workspace_agent_sessions.clear();
  await db.workspace_agents.clear();
  await db.workspaces.clear();
  await db.workspace_sources.clear();
});

const makeStore = () =>
  configureStore({ reducer: { interface_settings: interfaceSettingsReducer } });

const renderAgentList = (store = makeStore(), variant = "all") =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentList variant={variant} />
      </MemoryRouter>
    </Provider>,
  );

const removeAgentThroughMenu = () => {
  fireEvent.click(screen.getByRole("button", { name: "Agent options" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove agent" }));
};

const addAgentThroughModal = () => {
  fireEvent.click(screen.getByRole("button", { name: "Spawn agent" }));
  const { onCreate } = mocks.openModal.mock.calls.at(-1)[1];
  act(() =>
    onCreate({
      id: "agent-1",
      projectId: "hpc-project-1",
      name: "HPC project 1",
      serverUrl: "http://127.0.0.1:9000",
      sessionId: "session-1",
    }),
  );
};

const addServiceAgentThroughModal = () => {
  fireEvent.click(screen.getByRole("button", { name: "Spawn agent" }));
  const { onCreate } = mocks.openModal.mock.calls.at(-1)[1];
  act(() =>
    onCreate({
      id: "agent-1",
      projectId: "hpc-project-1",
      name: "HPC project 1",
      serverUrl: "http://agent-service:8090/agents/svc-1/opencode",
      serviceAgentId: "svc-1",
      serviceManaged: true,
      sessionId: "session-1",
    }),
  );
};

describe("AgentList", () => {
  it("opens the add-agent window and lists the created agent", () => {
    renderAgentList();

    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("No agents yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spawn agent" }));

    expect(mocks.openModal).toHaveBeenCalledWith(
      "agentAdd",
      expect.objectContaining({ onCreate: expect.any(Function) }),
    );

    const { onCreate } = mocks.openModal.mock.calls[0][1];
    act(() =>
      onCreate({
        id: "agent-1",
        projectId: "hpc-project-1",
        name: "HPC project 1",
        serverUrl: "http://127.0.0.1:9000",
        sessionId: "session-1",
      }),
    );

    expect(screen.getByText("HPC project 1")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:9000")).toBeInTheDocument();
  });

  it("shows the live connection status for an agent", async () => {
    mocks.status.mockResolvedValue({ "session-1": { type: "busy" } });
    renderAgentList();
    addAgentThroughModal();

    expect(
      await screen.findByRole("status", { name: "Working" }),
    ).toBeInTheDocument();
  });

  it("shows a connection error when the status request fails", async () => {
    mocks.status.mockRejectedValue(new Error("offline"));
    renderAgentList();
    addAgentThroughModal();

    expect(
      await screen.findByRole("status", { name: "Connection issue" }),
    ).toBeInTheDocument();
  });

  it("interrupts and deletes the session before removing the agent", async () => {
    renderAgentList();
    addAgentThroughModal();

    const order = [];
    mocks.interrupt.mockImplementation(async () => {
      order.push("interrupt");
    });
    mocks.deleteSession.mockImplementation(async () => {
      order.push("delete");
    });

    removeAgentThroughMenu();

    await waitFor(() => expect(order).toEqual(["interrupt", "delete"]));
    expect(screen.queryByText("HPC project 1")).not.toBeInTheDocument();
  });

  it("deletes the service agent after its session", async () => {
    renderAgentList();
    addServiceAgentThroughModal();
    removeAgentThroughMenu();

    await waitFor(() =>
      expect(mocks.deleteServiceAgent).toHaveBeenCalledWith("svc-1"),
    );
    expect(mocks.deleteSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteServiceAgent.mock.invocationCallOrder[0],
    );
    expect(screen.queryByText("HPC project 1")).not.toBeInTheDocument();
  });

  it("keeps the agent when the session cannot be deleted", async () => {
    renderAgentList();
    addAgentThroughModal();
    mocks.deleteSession.mockRejectedValueOnce(new Error("not deleted"));

    removeAgentThroughMenu();

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(screen.getByText("HPC project 1")).toBeInTheDocument();
  });

  it("removes the agent locally when authentication fails", async () => {
    renderAgentList();
    addAgentThroughModal();
    mocks.deleteSession.mockRejectedValueOnce(
      new Error("The opencode server rejected the password."),
    );

    removeAgentThroughMenu();

    await waitFor(() =>
      expect(screen.queryByText("HPC project 1")).not.toBeInTheDocument(),
    );
    expect(mocks.notifyError).toHaveBeenCalled();
  });

  it("removes the agent locally when the server is unreachable", async () => {
    renderAgentList();
    addAgentThroughModal();
    mocks.deleteSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    removeAgentThroughMenu();

    await waitFor(() =>
      expect(screen.queryByText("HPC project 1")).not.toBeInTheDocument(),
    );
    expect(mocks.notifyError).toHaveBeenCalled();
  });

  it("pins an agent from its options menu and keeps it in the list", async () => {
    renderAgentList();
    addAgentThroughModal();

    fireEvent.click(screen.getByRole("button", { name: "Agent options" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin agent" }));

    await waitFor(() => expect(getAgent("agent-1")?.pinned).toBe(true));

    // Pinning adds a row to the pinned section; the Agents section keeps its own.
    expect(await screen.findByText("HPC project 1")).toBeInTheDocument();

    // Unpinning removes only the pinned copy.
    act(() => setAgentPinned("agent-1", false));
    expect(getAgent("agent-1")?.pinned).toBe(false);
    expect(await screen.findByText("HPC project 1")).toBeInTheDocument();
  });

  it("renders only pinned agents with their own row controls in the pinned variant", async () => {
    const full = renderAgentList();
    addAgentThroughModal();
    act(() => {
      addAgent({ id: "agent-2", name: "Unpinned agent", sessionId: "session-2" });
      setAgentPinned("agent-1", true);
    });
    expect(await screen.findByText("Unpinned agent")).toBeInTheDocument();
    full.unmount();

    renderAgentList(makeStore(), "pinned");

    expect(await screen.findByText("HPC project 1")).toBeInTheDocument();
    expect(screen.queryByText("Unpinned agent")).not.toBeInTheDocument();
    // The pinned row is the real list row, so it keeps the subtree controls.
    expect(
      screen.getByRole("button", { name: "Sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agent options" }),
    ).toBeInTheDocument();
    // The Agents section band stays in the full list only.
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Spawn agent" }),
    ).not.toBeInTheDocument();
  });

  it("expands the pinned copy without expanding the agent in its own section", async () => {
    const store = makeStore();
    const full = renderAgentList(store);
    addAgentThroughModal();
    act(() => setAgentPinned("agent-1", true));
    full.unmount();

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/chat"]}>
          <AgentList />
          <AgentList variant="pinned" />
        </MemoryRouter>
      </Provider>,
    );

    const toggles = await screen.findAllByRole("button", { name: "Sessions" });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggles[1]);

    expect(toggles[1]).toHaveAttribute("aria-expanded", "true");
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(store.getState().interface_settings.expanded_agents).toEqual([
      pinnedStateId("agent-1"),
    ]);
  });

  it("remembers an expanded agent after a remount", () => {
    const store = makeStore();
    const first = renderAgentList(store);
    addAgentThroughModal();

    const toggle = screen.getByRole("button", { name: "Sessions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(store.getState().interface_settings.expanded_agents).toContain(
      "agent-1",
    );

    first.unmount();
    renderAgentList(store);

    expect(screen.getByRole("button", { name: "Sessions" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("moves a session from Unassigned sessions into a workspace from its menu", async () => {
    const workspaceId = await createWorkspace("Research");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
      { id: "session-2", title: "Loose session", time: { updated: 10 } },
    ]);

    renderAgentList();
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(workspaceId, "agent-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));

    // The active session is seeded into the workspace, the other one has no group yet.
    expect(await screen.findByText("Unassigned sessions")).toBeInTheDocument();
    const looseRow = screen.getByText("Loose session").closest(".group");
    fireEvent.click(within(looseRow).getByLabelText("Session options"));

    // The group header carries the workspace name too, so take the checkable menu row.
    const assign = screen
      .getAllByRole("button", { name: "Research" })
      .find((element) => element.hasAttribute("aria-pressed"));
    expect(assign).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(assign);
    await waitFor(() =>
      expect(screen.queryByText("Unassigned sessions")).toBeNull(),
    );
    expect(screen.getByText("Loose session")).toBeInTheDocument();
    const links = await db.workspace_agent_sessions.toArray();
    expect(links.map((link) => link.sessionId).sort()).toEqual([
      "session-1",
      "session-2",
    ]);
  });

  it("folds the sessions of a project and remembers the fold", async () => {
    const store = makeStore();
    const workspaceId = await createWorkspace("Research");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
    ]);

    renderAgentList(store);
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(workspaceId, "agent-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    const group = screen.getByText("Research").closest("[data-session-group]");
    // The active session is seeded into the attached workspace asynchronously.
    expect(
      await within(group).findByText("Active session"),
    ).toBeInTheDocument();

    const toggle = within(group).getByRole("button", {
      name: "Sessions in Research",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(
        within(group).queryByText("Active session"),
      ).not.toBeInTheDocument(),
    );
    // The project header stays, so the group can be unfolded again, and the
    // fold is persisted in the list the sidebar already uses for collapsed
    // sections.
    expect(
      within(group).getByRole("button", { name: "Sessions in Research" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(store.getState().interface_settings.collapsed_topics).toContain(
      agentProjectCollapseId(workspaceId, "agent-1"),
    );

    fireEvent.click(
      within(group).getByRole("button", { name: "Sessions in Research" }),
    );
    expect(
      await within(group).findByText("Active session"),
    ).toBeInTheDocument();
  });

  it("keeps the Workspace section's fold out of the agent's project group", async () => {
    const store = makeStore();
    const workspaceId = await createWorkspace("Research");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
    ]);

    // The Workspace section folded this project; the Agents section is a second
    // view of the same sessions and stays open.
    act(() =>
      store.dispatch(
        toggleTopic(workspaceAgentCollapseId(workspaceId, "agent-1")),
      ),
    );

    renderAgentList(store);
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(workspaceId, "agent-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    const group = screen.getByText("Research").closest("[data-session-group]");
    expect(await within(group).findByText("Active session")).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Sessions in Research" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("drags a session with the workspace it is listed in", async () => {
    const workspaceId = await createWorkspace("Research");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
      { id: "session-2", title: "Loose session", time: { updated: 10 } },
    ]);

    renderAgentList();
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(workspaceId, "agent-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    // Wait for the attached workspace to appear as a group before reading the
    // source workspace off a row.
    await screen.findByText("Research");

    const dataTransferFor = () => {
      const data = new Map();
      return {
        get types() {
          return [...data.keys()];
        },
        getData: (type) => data.get(type) ?? "",
        setData: (type, value) => data.set(type, value),
        effectAllowed: "none",
        dropEffect: "none",
      };
    };

    // Query the row right before the drag and retry the whole thing: the live
    // queries that fill this list keep re-rendering for a tick after `Research`
    // appears, and a node captured before such a render is detached, so React
    // never delivers its dragStart and the payload stays empty.
    const drag = (label) => {
      const row = screen.getByText(label).closest("[draggable]");
      const transfer = dataTransferFor();
      fireEvent.dragStart(row, { dataTransfer: transfer });
      return transfer;
    };

    await waitFor(() => {
      const groupedTransfer = drag("Active session");
      expect(
        JSON.parse(groupedTransfer.getData(AGENT_SESSION_DRAG_MIME)),
      ).toEqual({ agentId: "agent-1", sessionId: "session-1" });
      expect(
        groupedTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME),
      ).toBe(workspaceId);
    });

    // An unassigned session has no source workspace to detach from.
    const looseTransfer = drag("Loose session");
    expect(looseTransfer.getData(AGENT_SESSION_SOURCE_WORKSPACE_MIME)).toBe("");
  });

  it("moves a session to another workspace group by drag & drop", async () => {
    const research = await createWorkspace("Research");
    const teaching = await createWorkspace("Teaching");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
      { id: "session-2", title: "Moved session", time: { updated: 10 } },
    ]);

    renderAgentList();
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(research, "agent-1");
      await attachWorkspaceAgent(teaching, "agent-1");
      // The active session is seeded into every attached workspace; this one only
      // starts out in the first workspace, so the drop has something to move.
      await attachWorkspaceAgentSession(research, "agent-1", "session-2");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    await screen.findByText("Moved session");

    const makeTransfer = () => {
      const data = new Map();
      return {
        get types() {
          return [...data.keys()];
        },
        getData: (type) => data.get(type) ?? "",
        setData: (type, value) => data.set(type, value),
        effectAllowed: "none",
        dropEffect: "none",
      };
    };

    // The whole group (header and rows) is the drop target.
    const groupFor = (name) =>
      screen.getByText(name).closest("[data-session-group]");
    const teachingGroup = groupFor("Teaching");
    const dataTransfer = makeTransfer();

    fireEvent.dragStart(
      screen.getByText("Moved session").closest("[draggable]"),
      { dataTransfer },
    );
    fireEvent.dragOver(teachingGroup, { dataTransfer });
    expect(teachingGroup.className).toContain("ring-2");

    fireEvent.drop(teachingGroup, { dataTransfer });

    await waitFor(async () => {
      const links = await db.workspace_agent_sessions.toArray();
      expect(
        links
          .filter((link) => link.sessionId === "session-2")
          .map((link) => link.workspaceId),
      ).toEqual([teaching]);
    });
    expect(teachingGroup.className).not.toContain("ring-2");
  });

  it("does not highlight a workspace group for a drag this sidebar did not start", async () => {
    const workspaceId = await createWorkspace("Research");
    mocks.sessionTree = buildSessionTree([
      { id: "session-1", title: "Active session", time: { updated: 20 } },
    ]);

    renderAgentList();
    addAgentThroughModal();
    await act(async () => {
      await attachWorkspaceAgent(workspaceId, "agent-1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sessions" }));
    await screen.findByText("Research");

    const group = screen.getByText("Research").closest("[data-session-group]");
    // A payload in the DataTransfer alone is not trusted: `getData()` is empty while
    // a real drag is over a target, so the target reads the store's active drag.
    fireEvent.dragOver(group, {
      dataTransfer: {
        types: [AGENT_SESSION_DRAG_MIME],
        getData: () =>
          JSON.stringify({ agentId: "agent-1", sessionId: "session-9" }),
        setData: () => {},
        effectAllowed: "none",
        dropEffect: "none",
      },
    });

    expect(group.className).not.toContain("ring-2");
  });

  it("marks the section with an icon, its count and the collapse control", () => {
    renderAgentList();

    const toggle = screen.getByRole("button", { name: /^Agents/ });
    // Two icons: the collapse chevron and the section icon, like Pinned.
    expect(toggle.querySelectorAll("svg")).toHaveLength(2);
    // The count closes the button, exactly like the Chats header.
    expect(toggle.lastElementChild.className).toContain("tabular-nums");
  });
});
