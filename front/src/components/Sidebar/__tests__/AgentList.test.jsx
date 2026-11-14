import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import AgentList from "../AgentList";
import { removeAgent } from "../../../agents/agentStore";

const mocks = vi.hoisted(() => ({ openModal: vi.fn() }));

vi.mock("react-redux", () => ({
  useSelector: () => [],
  useDispatch: () => vi.fn(),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  deleteOpencodeSession: vi.fn(async () => null),
  opencodeDefaults: () => ({ serverUrl: "", username: "opencode", password: "" }),
}));

beforeEach(() => {
  mocks.openModal.mockReset();
  localStorage.clear();
  removeAgent("agent-1");
});

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
});
