import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceChat: (...args) => mocks.attach(...args),
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

import AttachChatModal from "../AttachChatModal";

beforeEach(() => {
  mocks.attach.mockReset();
  mocks.notifyError.mockReset();
});

describe("AttachChatModal", () => {
  it("reports a failed attach and leaves the modal usable", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("attach failed"));
    const onClose = vi.fn();

    render(
      <AttachChatModal
        isOpen
        workspaceId="ws-1"
        conversations={[{ id: "chat-1", title: "Chat" }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach chat" }));

    expect(await screen.findByText("attach failed")).toBeInTheDocument();
    expect(mocks.notifyError).toHaveBeenCalledWith("attach failed");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Attach chat" })).toBeEnabled();
  });
});
