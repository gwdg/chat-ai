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

const serviceMocks = vi.hoisted(() => ({
  available: false,
  create: vi.fn(),
  remove: vi.fn(),
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
vi.mock("../../../apis/agentService", () => ({
  hasAgentService: () => serviceMocks.available,
  createServiceAgent: (...args) => serviceMocks.create(...args),
  deleteServiceAgent: (...args) => serviceMocks.remove(...args),
}));

beforeEach(() => {
  apiMocks.getInfo.mockReset();
  apiMocks.createSession.mockReset();
  apiMocks.getInfo.mockResolvedValue({});
  apiMocks.createSession.mockResolvedValue({ id: "session-1" });
  serviceMocks.available = false;
  serviceMocks.create.mockReset();
  serviceMocks.remove.mockReset();
});

describe("AddAgentModal", () => {
  it("connects to opencode and creates an agent for the selected project", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByLabelText("Local agent"));
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
      local: false,
      projectId: "hpc-project-1",
      name: "HPC project 1",
      serverUrl: "http://127.0.0.1:9000",
      username: "opencode",
      password: "secret",
      passwordSource: "config",
      sessionId: "session-1",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("uses another project when selected", async () => {
    const onCreate = vi.fn();
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    fireEvent.click(screen.getByLabelText("Local agent"));
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

  it("creates a service-managed agent and uses its proxy URL", async () => {
    serviceMocks.available = true;
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-1",
      serverUrl: "http://agent-service:8090/agents/svc-1/opencode",
    });
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    // The service is the default when it is configured, and no server URL or
    // password is asked for.
    expect(
      screen.getByLabelText("Run through the agent service"),
    ).toBeChecked();
    expect(screen.queryByLabelText("opencode server")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).toHaveBeenCalledWith({ name: "HPC project 1" });
    expect(apiMocks.getInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: "http://agent-service:8090/agents/svc-1/opencode",
        password: "",
      }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceAgentId: "svc-1",
        serviceManaged: true,
        serverUrl: "http://agent-service:8090/agents/svc-1/opencode",
        password: "",
        sessionId: "session-1",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });
});
