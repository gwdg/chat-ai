import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServerList from "../McpServerList";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  dispatch: vi.fn(),
  testMcp: vi.fn(),
  servers: [
    {
      id: "server-1",
      name: "Test server",
      kind: "local",
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
});
