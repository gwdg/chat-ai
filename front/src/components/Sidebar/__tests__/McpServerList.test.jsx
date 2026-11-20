import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServerList from "../McpServerList";
import { reportMcpServerStatus } from "../../../agent/mcp";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  dispatch: vi.fn(),
  testMcp: vi.fn(),
  servers: [
    {
      id: "server-1",
      name: "Test server",
      url: "http://127.0.0.1:9000",
    },
  ],
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ interface_settings: { dark_mode: false } }),
  useDispatch: () => mocks.dispatch,
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../Redux/reducers/userSettingsReducer", () => ({
  selectGlobalMcpServers: () => mocks.servers,
  removeMcpServer: (id) => ({ type: "removeMcpServer", id }),
}));
vi.mock("../../../Redux/reducers/interfaceSettingsSlice", () => ({
  selectCollapsedTopics: () => [],
  toggleTopic: (id) => ({ type: "toggleTopic", id }),
}));
vi.mock("../../../agent/mcp", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    testMcpServer: (...args) => mocks.testMcp(...args),
  };
});

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.dispatch.mockReset();
  mocks.testMcp.mockReset();
  mocks.testMcp.mockResolvedValue({ name: "Test server", toolCount: 2 });
});

describe("McpServerList", () => {
  it("does not open the editor when the server row is clicked", () => {
    render(<McpServerList />);

    fireEvent.click(screen.getByText("Test server"));

    expect(mocks.openModal).not.toHaveBeenCalled();
  });

  it("tests an MCP server when its status light is clicked", async () => {
    render(<McpServerList />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Test server: Not tested — click to test",
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Test server: Connected" }),
    ).toBeInTheDocument();
    expect(mocks.testMcp).toHaveBeenCalledWith({
      url: "http://127.0.0.1:9000/",
      headers: undefined,
      enabled: true,
    });
  });

  it("starts green for a server that was tested elsewhere", () => {
    reportMcpServerStatus("http://127.0.0.1:9000", "ready");

    render(<McpServerList />);

    expect(
      screen.getByRole("button", { name: "Test server: Connected" }),
    ).toBeInTheDocument();
  });

  it("follows a status announced for the server URL", () => {
    render(<McpServerList />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("chatai:mcp-status", {
          detail: { url: "http://127.0.0.1:9000/", status: "error" },
        }),
      );
    });
    expect(
      screen.getByRole("button", {
        name: "Test server: Not reachable — click to retry",
      }),
    ).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("chatai:mcp-status", {
          detail: { url: "http://127.0.0.1:9000/", status: "ready" },
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: "Test server: Connected" }),
    ).toBeInTheDocument();
  });

  it("opens the editor from the options menu", () => {
    render(<McpServerList />);

    fireEvent.click(screen.getByRole("button", { name: "MCP server options" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(mocks.openModal).toHaveBeenCalledWith("mcpServerEdit", {
      server: mocks.servers[0],
    });
  });

  it("removes the server from the options menu", () => {
    render(<McpServerList />);

    fireEvent.click(screen.getByRole("button", { name: "MCP server options" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: "removeMcpServer",
      id: "server-1",
    });
  });

  it("opens the server details on a double click instead of testing it", () => {
    vi.useFakeTimers();
    try {
      render(<McpServerList />);
      const row = screen.getByText("Test server");

      // A real double click is two clicks followed by dblclick.
      fireEvent.click(row);
      fireEvent.click(row);
      fireEvent.doubleClick(row);

      expect(mocks.openModal).toHaveBeenCalledWith("mcpServerDetails", {
        server: mocks.servers[0],
      });
      vi.advanceTimersByTime(500);
      expect(mocks.testMcp).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the server details from the options menu", () => {
    render(<McpServerList />);

    fireEvent.click(screen.getByRole("button", { name: "MCP server options" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(mocks.openModal).toHaveBeenCalledWith("mcpServerDetails", {
      server: mocks.servers[0],
    });
  });

  it("marks the section with an icon, its count and the collapse control", () => {
    render(<McpServerList />);

    const toggle = screen.getByRole("button", { name: /^MCP Servers/ });
    // Two icons: the collapse chevron and the section icon, like Pinned.
    expect(toggle.querySelectorAll("svg")).toHaveLength(2);
    // The count closes the button, exactly like the Chats header.
    expect(toggle.lastElementChild).toHaveTextContent("1");
    expect(toggle.lastElementChild.className).toContain("tabular-nums");
  });
});
