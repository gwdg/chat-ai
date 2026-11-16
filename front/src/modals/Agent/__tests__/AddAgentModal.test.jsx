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

// Whether the engine lists `saia-agent` for this user. The hook itself is
// covered by its own test; here the states are set directly.
const serviceAccess = vi.hoisted(() => ({ value: "granted" }));

vi.mock("../../../hooks/useAgentServiceAccess", () => ({
  useAgentServiceAccess: () => serviceAccess.value,
  AGENT_SERVICE_CHECKING: "checking",
  AGENT_SERVICE_GRANTED: "granted",
  AGENT_SERVICE_DENIED: "denied",
  AGENT_SERVICE_UNKNOWN: "unknown",
}));

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
  serviceAccess.value = "granted";
  storeMocks.update.mockReset();
});

describe("AddAgentModal", () => {
  it("offers the GWDG service and an OpenCode server as one choice", () => {
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    const service = screen.getByRole("button", {
      name: "GWDG HPC agentic service",
    });
    const external = screen.getByRole("button", {
      name: "OpenCode server",
    });
    expect(service).toHaveAttribute("aria-pressed", "true");
    expect(external).toHaveAttribute("aria-pressed", "false");
    // The service is the default, so its HPC project list is shown and no
    // server credentials are asked for.
    expect(screen.getByLabelText("HPC project")).toHaveValue("hpc-project-1");
    expect(screen.queryByLabelText("opencode server")).toBeNull();
    expect(screen.queryByLabelText("Server password")).toBeNull();
  });

  it("shows the direct connection options instead of projects for an external server", () => {
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "OpenCode server" }),
    );

    expect(
      screen.getByRole("button", { name: "OpenCode server" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("opencode server")).toHaveValue(
      "http://127.0.0.1:9000",
    );
    expect(screen.getByLabelText("Server password")).toHaveValue("secret");
    expect(screen.queryByLabelText("HPC project")).toBeNull();
  });

  it("creates a service agent for the selected HPC project", async () => {
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-1",
      serverUrl: "/agents/svc-1/opencode",
    });
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

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
        projectId: "hpc-project-1",
        name: "HPC project 1",
        serviceAgentId: "svc-1",
        serviceManaged: true,
        serverUrl: "/agents/svc-1/opencode",
        password: "",
        sessionId: "session-1",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("uses another HPC project when selected", async () => {
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-2",
      serverUrl: "/agents/svc-2/opencode",
    });
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

  it("connects to an external opencode server without the service", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "OpenCode server" }),
    );
    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "My server" },
    });
    fireEvent.change(screen.getByLabelText("opencode server"), {
      target: { value: "http://192.168.0.5:9000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).not.toHaveBeenCalled();
    expect(apiMocks.getInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: "http://192.168.0.5:9000",
        password: "secret",
      }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      id: "agent-1",
      local: true,
      name: "My server",
      serverUrl: "http://192.168.0.5:9000",
      username: "opencode",
      password: "secret",
      passwordSource: "config",
      sessionId: "session-1",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the window open when the server rejects the connection", async () => {
    apiMocks.getInfo.mockRejectedValueOnce(new Error("unauthorized"));
    const onCreate = vi.fn();
    const onClose = vi.fn();
    render(
      <AddAgentModal isOpen onClose={onClose} onCreate={onCreate} />,
    );

    // Direct mode, so the modal verifies the opencode server itself.
    fireEvent.click(
      screen.getByRole("button", { name: "OpenCode server" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    expect(
      await screen.findByText(/Could not connect to the opencode server/),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("forces the service and hides the direct option outside local access", async () => {
    accessMocks.direct = false;
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-3",
      serverUrl: "/agents/svc-3/opencode",
    });
    const onCreate = vi.fn();
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    // No way back to a direct connection: no selector, no server fields.
    expect(
      screen.queryByRole("button", { name: "OpenCode server" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "GWDG HPC agentic service" }),
    ).toBeNull();
    expect(screen.queryByLabelText("opencode server")).toBeNull();
    expect(screen.getByText(/In a deployment agents run/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(serviceMocks.create).toHaveBeenCalledWith({ name: "HPC project 1" });
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceAgentId: "svc-3",
        serverUrl: "/agents/svc-3/opencode",
      }),
    );
  });

  it("migrates a direct agent to the service when it is saved outside local access", async () => {
    accessMocks.direct = false;
    serviceMocks.create.mockResolvedValue({
      serviceAgentId: "svc-4",
      serverUrl: "/agents/svc-4/opencode",
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
        serviceAgentId: "svc-4",
        serviceManaged: true,
        serverUrl: "/agents/svc-4/opencode",
        password: "",
        sessionId: "session-1",
      }),
    );
    expect(onCreate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("opens an existing direct agent in the external mode", () => {
    const agent = {
      id: "agent-direct",
      name: "Direct agent",
      local: true,
      serverUrl: "http://127.0.0.1:9100",
      username: "opencode",
      password: "custom",
      sessionId: "session-9",
    };
    render(
      <AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} agent={agent} />,
    );

    expect(
      screen.getByRole("button", { name: "OpenCode server" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("opencode server")).toHaveValue(
      "http://127.0.0.1:9100",
    );
    expect(screen.queryByLabelText("HPC project")).toBeNull();
  });

  it("reports a service refusal and lets the dialog be submitted again", async () => {
    serviceMocks.create.mockRejectedValueOnce(
      Object.assign(
        new Error(
          "agent service responded with 409: backend 'local-opencode' has reached its limit of 2 instance(s)",
        ),
        { status: 409, code: "capacity_exceeded" },
      ),
    );
    const onCreate = vi.fn();

    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    expect(
      await screen.findByText(/has reached its limit of 2 instance/),
    ).toBeInTheDocument();
    // The failed attempt must not leave the button stuck on "Connecting…".
    expect(screen.getByRole("button", { name: "Add agent" })).toBeEnabled();

    serviceMocks.create.mockResolvedValueOnce({
      serviceAgentId: "svc-new",
      serverUrl: "/agents/svc-new/opencode",
      status: "running",
    });
    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0].serviceAgentId).toBe("svc-new");
  });

  it("switches a service agent to an external server and drops the service id", async () => {
    const agent = {
      id: "agent-service",
      name: "Service agent",
      projectId: "hpc-project-1",
      serviceAgentId: "svc-old",
      serviceManaged: true,
      local: true,
      serverUrl: "/agents/svc-old/opencode",
      username: "opencode",
      password: "",
      passwordSource: "service",
      sessionId: "session-1",
    };
    render(
      <AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} agent={agent} />,
    );

    expect(screen.getByLabelText("HPC project")).toHaveValue("hpc-project-1");
    fireEvent.click(
      screen.getByRole("button", { name: "OpenCode server" }),
    );
    fireEvent.change(screen.getByLabelText("opencode server"), {
      target: { value: "http://127.0.0.1:9000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(storeMocks.update).toHaveBeenCalledTimes(1));
    const patch = storeMocks.update.mock.calls[0][1];
    expect(patch.serviceAgentId).toBeUndefined();
    expect(patch.serviceManaged).toBeUndefined();
    expect(patch.projectId).toBeUndefined();
    expect(patch).toEqual(
      expect.objectContaining({
        local: true,
        serverUrl: "http://127.0.0.1:9000",
        sessionId: "session-1",
      }),
    );
    expect(serviceMocks.remove).toHaveBeenCalledWith("svc-old");
  });

  it("disables the service fields and names the access request when saia-agent is missing", () => {
    // The engine lists `saia-agent` only for users granted the service's access
    // group, so a readable model list without it is an entitlement answer.
    serviceAccess.value = "denied";
    const onCreate = vi.fn();
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    expect(screen.getByLabelText("Agent name")).toBeDisabled();
    expect(screen.getByLabelText("HPC project")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add agent" })).toBeDisabled();
    expect(
      screen.getByText(/not enabled for your account/),
    ).toBeInTheDocument();
    expect(screen.getByText(/support@gwdg\.de/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add agent" }));

    expect(serviceMocks.create).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("leaves the external connection usable without the service entitlement", () => {
    serviceAccess.value = "denied";
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "OpenCode server" }));

    // Only the service is gated: an external server needs no entitlement.
    expect(screen.getByLabelText("Agent name")).toBeEnabled();
    expect(screen.getByLabelText("opencode server")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add agent" })).toBeEnabled();
    expect(screen.queryByText(/support@gwdg\.de/)).toBeNull();
  });

  it("keeps the service usable when the model list cannot be read", () => {
    // `unknown` means the check failed, not that access was refused: locking
    // the dialog there would hide a working service behind a network error.
    serviceAccess.value = "unknown";
    render(<AddAgentModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByLabelText("Agent name")).toBeEnabled();
    expect(screen.getByLabelText("HPC project")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add agent" })).toBeEnabled();
    expect(
      screen.getByText(/The agent service starts an OpenCode container/),
    ).toBeInTheDocument();
  });
});
