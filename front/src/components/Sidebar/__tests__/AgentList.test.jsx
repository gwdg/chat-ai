import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import AgentList from "../AgentList";
import { removeAgent } from "../../../agents/agentStore";
import interfaceSettingsReducer from "../../../Redux/reducers/interfaceSettingsSlice";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  interrupt: vi.fn(async () => null),
  deleteSession: vi.fn(async () => null),
  status: vi.fn(async () => ({})),
  notifyError: vi.fn(),
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

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.interrupt.mockReset();
  mocks.deleteSession.mockReset();
  mocks.status.mockReset();
  mocks.notifyError.mockReset();
  mocks.interrupt.mockResolvedValue(null);
  mocks.deleteSession.mockResolvedValue(null);
  mocks.status.mockResolvedValue({});
  localStorage.clear();
  removeAgent("agent-1");
});

const makeStore = () =>
  configureStore({ reducer: { interface_settings: interfaceSettingsReducer } });

const renderAgentList = (store = makeStore()) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentList />
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
});
