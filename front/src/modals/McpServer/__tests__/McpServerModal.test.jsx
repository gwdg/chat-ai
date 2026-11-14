import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpServerModal from "../McpServerModal";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useDispatch: () => mocks.dispatch,
}));
vi.mock("../../BaseModal", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../db", () => ({
  newId: () => "server-id",
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

  it("saves a local server with a valid address", () => {
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
