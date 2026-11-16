import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { pinnedStateId } from "../pinnedState";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  interrupt: vi.fn(async () => null),
  deleteSession: vi.fn(async () => null),
  status: vi.fn(async () => ({})),
  notifyError: vi.fn(),
  deleteServiceAgent: vi.fn(async () => null),
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

beforeEach(() => {
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
  localStorage.clear();
  removeAgent("agent-1");
  removeAgent("agent-2");
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

  it("marks the section with an icon beside the collapse control", () => {
    renderAgentList();

    // Two icons: the collapse chevron and the section icon, like Pinned.
    expect(
      screen.getByRole("button", { name: "Agents" }).querySelectorAll("svg"),
    ).toHaveLength(2);
  });
});
