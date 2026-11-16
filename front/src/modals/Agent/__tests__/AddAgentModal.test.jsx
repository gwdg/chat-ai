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
  create: vi.fn(),
  remove: vi.fn(),
}));

// jsdom runs on localhost, which allows direct connections. A deployment is
// simulated by flipping this for the hosted cases below.
const accessMocks = vi.hoisted(() => ({ direct: true }));

const storeMocks = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../db", () => ({
  newId: () => "agent-1",
}));
vi.mock("../../../agents/agentStore", () => ({
  updateAgent: (...args) => storeMocks.update(...args),
}));
vi.mock("../../../apis/agentAccess", () => ({
  directAgentAccessAllowed: () => accessMocks.direct,
}));
vi.mock("../../../apis/opencodeAgents", () => ({
  opencodeDefaults: () => apiMocks.defaults,
  getOpencodeInfo: (...args) => apiMocks.getInfo(...args),
  createOpencodeSession: (...args) => apiMocks.createSession(...args),
}));
vi.mock("../../../apis/agentService", () => ({
  createServiceAgent: (...args) => serviceMocks.create(...args),
  deleteServiceAgent: (...args) => serviceMocks.remove(...args),
}));

beforeEach(() => {
  apiMocks.getInfo.mockReset();
  apiMocks.createSession.mockReset();
  apiMocks.getInfo.mockResolvedValue({});
  apiMocks.createSession.mockResolvedValue({ id: "session-1" });
  serviceMocks.create.mockReset();
  serviceMocks.remove.mockReset();
  accessMocks.direct = true;
  storeMocks.update.mockReset();
});

describe("AddAgentModal", () => {
  it("connects to opencode and creates an agent for the selected project", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    fireEvent.click(screen.getByLabelText("Run through the agent service"));
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

    fireEvent.click(screen.getByLabelText("Run through the agent service"));
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

    // Direct mode, so the modal verifies the opencode server itself.
    fireEvent.click(screen.getByLabelText("Run through the agent service"));
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    expect(
      await screen.findByText(/Could not connect to the opencode server/),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("creates a service-managed agent and uses its proxy URL", async () => {
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-1",
      serverUrl: "/agents/svc-1/opencode",
    });
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    // The service is the default, and no server URL or password is asked for.
    expect(
      screen.getByLabelText("Run through the agent service"),
    ).toBeChecked();
    expect(screen.queryByLabelText("opencode server")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).toHaveBeenCalledWith({ name: "HPC project 1" });
    expect(apiMocks.getInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: "/agents/svc-1/opencode",
        password: "",
      }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceAgentId: "svc-1",
        serviceManaged: true,
        serverUrl: "/agents/svc-1/opencode",
        password: "",
        sessionId: "session-1",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("forces the service and hides the direct option outside local access", async () => {
    accessMocks.direct = false;
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-2",
      serverUrl: "/agents/svc-2/opencode",
    });
    const onCreate = vi.fn();
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    // No way back to a direct connection: no toggle, no server fields.
    expect(
      screen.queryByLabelText("Run through the agent service"),
    ).toBeNull();
    expect(screen.queryByLabelText("opencode server")).toBeNull();
    expect(screen.getByText(/In a deployment agents run/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).toHaveBeenCalledWith({ name: "HPC project 1" });
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceAgentId: "svc-2",
        serverUrl: "/agents/svc-2/opencode",
      }),
    );
  });

  it("migrates a direct agent to the service when it is saved outside local access", async () => {
    accessMocks.direct = false;
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-3",
      serverUrl: "/agents/svc-3/opencode",
    });
    const agent = {
      id: "agent-direct",
      name: "Direct agent",
      projectId: "hpc-project-1",
      local: true,
      serverUrl: "http://127.0.0.1:9000",
      username: "opencode",
      password: "custom",
      passwordSource: "custom",
      sessionId: "old-session",
    };
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        agent={agent}
      />,
    );

    expect(screen.queryByLabelText("opencode server")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(storeMocks.update).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).toHaveBeenCalledWith({ name: "Direct agent" });
    expect(storeMocks.update).toHaveBeenCalledWith(
      "agent-direct",
      expect.objectContaining({
        serviceAgentId: "svc-3",
        serviceManaged: true,
        serverUrl: "/agents/svc-3/opencode",
        password: "",
        sessionId: "session-1",
      }),
    );
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
