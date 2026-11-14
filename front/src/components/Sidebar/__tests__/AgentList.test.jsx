import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import AgentList from "../AgentList";
import { removeAgent } from "../../../agents/agentStore";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  interrupt: vi.fn(async () => null),
  deleteSession: vi.fn(async () => null),
  notifyError: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: () => [],
  useDispatch: () => vi.fn(),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  interruptOpencodeSession: (...args) => mocks.interrupt(...args),
  deleteOpencodeSession: (...args) => mocks.deleteSession(...args),
  opencodeDefaults: () => ({ serverUrl: "", username: "opencode", password: "" }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.interrupt.mockReset();
  mocks.deleteSession.mockReset();
  mocks.notifyError.mockReset();
  mocks.interrupt.mockResolvedValue(null);
  mocks.deleteSession.mockResolvedValue(null);
  localStorage.clear();
  removeAgent("agent-1");
});

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
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentList />
      </MemoryRouter>,
    );

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

  it("interrupts and deletes the session before removing the agent", async () => {
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentList />
      </MemoryRouter>,
    );
    addAgentThroughModal();

    const order = [];
    mocks.interrupt.mockImplementation(async () => {
      order.push("interrupt");
    });
    mocks.deleteSession.mockImplementation(async () => {
      order.push("delete");
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove agent" }));

    await waitFor(() => expect(order).toEqual(["interrupt", "delete"]));
    expect(screen.queryByText("HPC project 1")).not.toBeInTheDocument();
  });

  it("keeps the agent when the session cannot be deleted", async () => {
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentList />
      </MemoryRouter>,
    );
    addAgentThroughModal();
    mocks.deleteSession.mockRejectedValueOnce(new Error("not deleted"));

    fireEvent.click(screen.getByRole("button", { name: "Remove agent" }));

    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    expect(screen.getByText("HPC project 1")).toBeInTheDocument();
  });
});
