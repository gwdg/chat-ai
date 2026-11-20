import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServerModal from "../McpServerModal";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  servers: [],
  scan: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
  useSelector: () => mocks.servers,
}));
vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../db", () => ({
  newId: (() => {
    let counter = 0;
    return () => `server-${++counter}`;
  })(),
}));
vi.mock("../../../agent/mcpScan", () => ({
  LOCAL_MCP_SCAN_FIRST_PORT: 5001,
  LOCAL_MCP_SCAN_LAST_PORT: 5002,
  scanLocalMcpServers: mocks.scan,
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifyError: mocks.notifyError,
    notifySuccess: mocks.notifySuccess,
  }),
}));

beforeEach(() => {
  mocks.dispatch.mockReset();
  mocks.notifyError.mockReset();
  mocks.notifySuccess.mockReset();
  mocks.servers = [];
  mocks.scan.mockReset();
});

describe("McpServerModal URL validation", () => {
  it("does not save a local server whose address is not a URL", () => {
    const onClose = vi.fn();
    render(<McpServerModal isOpen onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("http://localhost:3000/mcp"), {
      target: { value: "julian_kunkel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mocks.notifyError).toHaveBeenCalledWith(
      "Enter a valid MCP server URL first.",
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("offers only a server URL, with no gateway option", () => {
    render(<McpServerModal isOpen onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText("http://localhost:3000/mcp")).toBeTruthy();
    expect(screen.queryByText("GWDG gateway")).toBeNull();
    expect(screen.queryByText("Gateway server id")).toBeNull();
    expect(document.querySelector("select")).toBeNull();
  });

  it("saves a server with a valid address", () => {
    const onClose = vi.fn();
    render(<McpServerModal isOpen onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText("http://localhost:3000/mcp"), {
      target: { value: "localhost:9000/mcp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mocks.notifyError).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("McpServerModal local scan", () => {
  it("offers the scan when a server is added, not when one is edited", () => {
    const { unmount } = render(<McpServerModal isOpen onClose={vi.fn()} />);
    expect(screen.getByText("Scan for local MCP servers")).toBeTruthy();
    unmount();

    render(
      <McpServerModal
        isOpen
        onClose={vi.fn()}
        server={{ id: "existing", url: "localhost:9000/mcp" }}
      />,
    );
    expect(screen.queryByText("Scan for local MCP servers")).toBeNull();
  });

  it("adds a found server that is not configured yet and skips configured ones", async () => {
    mocks.servers = [
      { id: "existing", url: "http://localhost:5002/mcp" },
    ];
    mocks.scan.mockImplementation(async ({ onFound }) => {
      onFound({ port: 5001, url: "http://localhost:5001/mcp" });
      onFound({ port: 5002, url: "http://localhost:5002/mcp" });
      return [
        { port: 5001, url: "http://localhost:5001/mcp" },
        { port: 5002, url: "http://localhost:5002/mcp" },
      ];
    });

    render(<McpServerModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Scan" }));

    await waitFor(() => expect(mocks.scan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledTimes(1));

    const payload = mocks.dispatch.mock.calls[0][0].payload;
    expect(payload).toMatchObject({
      url: "http://localhost:5001/mcp",
      name: "Local MCP server (port 5001)",
    });
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      "Added 1 local MCP server(s).",
    );
  });

  it("reports an empty scan without adding anything", async () => {
    mocks.scan.mockResolvedValue([]);

    render(<McpServerModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Scan" }));

    await waitFor(() =>
      expect(mocks.notifyError).toHaveBeenCalledWith(
        "No local MCP server found on ports above 5000.",
        { autoClose: 4000 },
      ),
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
