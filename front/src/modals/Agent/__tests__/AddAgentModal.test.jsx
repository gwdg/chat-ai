import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddAgentModal from "../AddAgentModal";

const apiMocks = vi.hoisted(() => ({
  getInfo: vi.fn(async () => ({})),
  createSession: vi.fn(async () => ({ id: "session-1" })),
  defaults: {
    serverUrl: "http://127.0.0.1:9000",
    username: "opencode",
    password: "secret",
  },
}));

vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../db", () => ({
  newId: () => "agent-1",
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  opencodeDefaults: () => apiMocks.defaults,
  getOpencodeInfo: (...args) => apiMocks.getInfo(...args),
  createOpencodeSession: (...args) => apiMocks.createSession(...args),
}));

beforeEach(() => {
  apiMocks.getInfo.mockReset();
  apiMocks.createSession.mockReset();
  apiMocks.getInfo.mockResolvedValue({});
  apiMocks.createSession.mockResolvedValue({ id: "session-1" });
});

describe("AddAgentModal", () => {
  it("connects to opencode and creates an agent for the selected project", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    expect(screen.getByLabelText("HPC project")).toHaveValue("hpc-project-1");
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(apiMocks.getInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: "http://127.0.0.1:9000",
        password: "secret",
      }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      id: "agent-1",
      projectId: "hpc-project-1",
      name: "HPC project 1",
      serverUrl: "http://127.0.0.1:9000",
      username: "opencode",
      password: "secret",
      sessionId: "session-1",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("uses another project when selected", async () => {
    const onCreate = vi.fn();
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText("HPC project"), {
      target: { value: "hpc-project-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "hpc-project-2",
          name: "HPC project 2",
        }),
      ),
    );
  });

  it("keeps the window open when the server rejects the connection", async () => {
    apiMocks.getInfo.mockRejectedValueOnce(new Error("unauthorized"));
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    expect(
      await screen.findByText(/Could not connect to the opencode server/),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
