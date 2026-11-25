import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../db/workspaceDb", () => ({
  attachWorkspaceAgent: (...args) => mocks.attach(...args),
}));

vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));

import AttachAgentModal from "../AttachAgentModal";

beforeEach(() => {
  mocks.attach.mockReset();
  mocks.notifyError.mockReset();
});

describe("AttachAgentModal", () => {
  it("reports a failed attach and leaves the modal usable", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("attach failed"));
    const onClose = vi.fn();

    render(
      <AttachAgentModal
        isOpen
        workspaceId="ws-1"
        agents={[{ id: "agent-1", name: "Agent" }]}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach agent" }));

    expect(await screen.findByText("attach failed")).toBeInTheDocument();
    expect(mocks.notifyError).toHaveBeenCalledWith("attach failed");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Attach agent" })).toBeEnabled();
  });
});
