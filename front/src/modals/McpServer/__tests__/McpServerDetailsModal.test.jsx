import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import McpServerDetailsModal from "../McpServerDetailsModal";

const mocks = vi.hoisted(() => ({ describe: vi.fn() }));

vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../agent/mcp", () => ({
  describeMcpServer: (...args) => mocks.describe(...args),
}));

const local = {
  id: "server-1",
  name: "Files",
  kind: "local",
  url: "http://127.0.0.1:9000/mcp",
};


describe("McpServerDetailsModal", () => {
  it("shows what the server reports about itself", async () => {
    mocks.describe.mockResolvedValue({
      name: "files-server",
      title: "Files",
      version: "2.1.0",
      protocolVersion: "2025-06-18",
      websiteUrl: "https://example.test/files",
      description: "Serves files",
      instructions: "Call the read tool.",
      capabilities: [{ name: "tools", detail: "listChanged" }],
      tools: [
        {
          name: "read_file",
          title: "Read file",
          description: "Reads a file",
        },
      ],
    });

    render(
      <McpServerDetailsModal isOpen onClose={vi.fn()} server={local} />,
    );

    expect(await screen.findByText("2.1.0")).toBeInTheDocument();
    expect(mocks.describe).toHaveBeenCalledWith({
      url: local.url,
      headers: undefined,
      enabled: true,
    });
    expect(screen.getByText("2025-06-18")).toBeInTheDocument();
    expect(screen.getByText("tools · listChanged")).toBeInTheDocument();
    expect(screen.getByText("Tools (1)")).toBeInTheDocument();
    expect(screen.getByText("read_file")).toBeInTheDocument();
    expect(screen.getByText(/Reads a file/)).toBeInTheDocument();
    expect(screen.getByText("Call the read tool.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /example\.test\/files/ }),
    ).toHaveAttribute("href", "https://example.test/files");
  });

  it("reports a server whose details cannot be read", async () => {
    mocks.describe.mockImplementation(() => Promise.reject(new Error("Failed to connect")));

    render(
      <McpServerDetailsModal isOpen onClose={vi.fn()} server={local} />,
    );

    expect(await screen.findByText("Failed to connect")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("explains why a gateway server has no details", () => {
    render(
      <McpServerDetailsModal
        isOpen
        onClose={vi.fn()}
        server={{ id: "remote", name: "GWDG", kind: "remote", serverId: "srv-1" }}
      />,
    );

    expect(
      screen.getByText(/cannot be read from the browser/),
    ).toBeInTheDocument();
    expect(mocks.describe).not.toHaveBeenCalled();
  });
});
