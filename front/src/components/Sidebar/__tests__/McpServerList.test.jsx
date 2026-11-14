import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServerList from "../McpServerList";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  dispatch: vi.fn(),
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
  useSelector: (selector) => selector(),
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

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.dispatch.mockReset();
});

describe("McpServerList", () => {
  it("does not open the editor when the server row is clicked", () => {
    render(<McpServerList />);

    fireEvent.click(screen.getByText("Test server"));

    expect(mocks.openModal).not.toHaveBeenCalled();
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
