import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MCPContainer from "../MCPContainer";

const toastMocks = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
const mcpMocks = vi.hoisted(() => ({ testMcpServer: vi.fn() }));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => toastMocks,
}));
vi.mock("../../../agent/mcp", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, testMcpServer: mcpMocks.testMcpServer };
});

const makeState = (mcpServers) => ({
  settings: { mcp_servers: mcpServers },
});

const renderWith = (localState, remote = false) => {
  const setLocalState = vi.fn((updater) => updater(localState));
  render(
    <MCPContainer localState={localState} setLocalState={setLocalState} remote={remote} />,
  );
  return setLocalState;
};

describe("MCPContainer minimum server row", () => {
  it("adds a first remote server row when there are none", () => {
    const setLocalState = renderWith(makeState([]), true);

    expect(setLocalState).toHaveBeenCalled();
    expect(setLocalState.mock.results[0].value.settings.mcp_servers).toEqual([
      { id: "", enabled: true },
    ]);
  });

  it("adds a first local server row when there are none", () => {
    const setLocalState = renderWith(makeState([]));

    expect(setLocalState).toHaveBeenCalled();
    expect(setLocalState.mock.results[0].value.settings.mcp_servers).toEqual([
      { url: "", enabled: true },
    ]);
  });

  it("does not remove the first server row", () => {
    const localState = makeState([{ id: "server-1", enabled: true }]);
    const setLocalState = renderWith(localState, true);

    const remove = screen.getByRole("button", { name: /remove server/i });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(setLocalState).not.toHaveBeenCalled();
  });

  it("allows removing later rows", () => {
    const localState = makeState([
      { id: "server-1", enabled: true },
      { id: "server-2", enabled: true },
    ]);
    const setLocalState = renderWith(localState, true);

    fireEvent.click(screen.getAllByRole("button", { name: /remove server/i })[1]);

    expect(setLocalState.mock.results[0].value.settings.mcp_servers).toEqual([
      { id: "server-1", enabled: true },
    ]);
  });
});

describe("MCPContainer test button", () => {
  it("tests a local server with the stored URL and authorization", async () => {
    mcpMocks.testMcpServer.mockResolvedValue({ name: "myserver", toolCount: 3 });
    const server = {
      url: "http://localhost:9000/mcp",
      enabled: true,
      headers: { Authorization: "Bearer token" },
    };
    renderWith(makeState([server]));

    fireEvent.click(screen.getByRole("button", { name: /test the server/i }));

    await waitFor(() =>
      expect(mcpMocks.testMcpServer).toHaveBeenCalledWith({
        url: server.url,
        headers: server.headers,
      }),
    );
    await waitFor(() => expect(toastMocks.notifySuccess).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /test the server/i }).querySelector("svg"),
    ).toHaveClass("text-success");
  });

  it("reports a failed test", async () => {
    mcpMocks.testMcpServer.mockRejectedValue(new Error("401 Unauthorized"));
    renderWith(makeState([{ url: "http://localhost:9000/mcp", enabled: true }]));

    fireEvent.click(screen.getByRole("button", { name: /test the server/i }));

    await waitFor(() => expect(toastMocks.notifyError).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /test the server/i }).querySelector("svg"),
    ).toHaveClass("text-error");
  });

  it("disables the test until a URL is entered", () => {
    renderWith(makeState([{ url: "", enabled: true }]));

    expect(screen.getByRole("button", { name: /test the server/i })).toBeDisabled();
  });

  it("tests a remote server by connecting to its id", async () => {
    mcpMocks.testMcpServer.mockResolvedValue({ name: "remote", toolCount: 2 });
    const server = {
      id: "https://mcp.example.com/mcp",
      enabled: true,
      headers: { Authorization: "Bearer token" },
    };
    renderWith(makeState([server]), true);

    fireEvent.click(screen.getByRole("button", { name: /test the server/i }));

    await waitFor(() =>
      expect(mcpMocks.testMcpServer).toHaveBeenCalledWith({
        url: server.id,
        headers: server.headers,
      }),
    );
  });
});

describe("MCPContainer server name", () => {
  it("shows the tested name read-only and stores it in the per-chat setting", async () => {
    mcpMocks.testMcpServer.mockResolvedValue({ name: "My MCP Server", toolCount: 3 });
    const server = { url: "http://localhost:9000/mcp", enabled: true };
    const setLocalState = renderWith(makeState([server]));

    fireEvent.click(screen.getByRole("button", { name: /test the server/i }));

    await waitFor(() => expect(setLocalState).toHaveBeenCalled());
    const next = setLocalState.mock.results.at(-1).value;
    expect(next.settings.mcp_servers[0].name).toBe("My MCP Server");

    render(<MCPContainer localState={next} setLocalState={vi.fn()} />);
    expect(screen.getByText("My MCP Server")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("My MCP Server")).not.toBeInTheDocument();
  });
});
