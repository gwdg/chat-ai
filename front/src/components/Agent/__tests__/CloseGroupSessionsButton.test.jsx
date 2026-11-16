import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  closeSessions: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({
    notifySuccess: mocks.notifySuccess,
    notifyError: mocks.notifyError,
  }),
}));
vi.mock("../../../agents/agentSessions", () => ({
  closeAgentSessions: (...args) => mocks.closeSessions(...args),
}));

import CloseGroupSessionsButton from "../CloseGroupSessionsButton";

const agent = { id: "agent-1", sessionId: "session-1" };

const openConfirm = () => {
  fireEvent.click(screen.getByTestId("close-group-sessions"));
  return mocks.openModal.mock.calls.at(-1);
};

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.closeSessions.mockReset();
  mocks.notifySuccess.mockReset();
  mocks.notifyError.mockReset();
  mocks.closeSessions.mockResolvedValue({ closed: [], failed: [] });
});

describe("CloseGroupSessionsButton", () => {
  it("renders nothing for an empty group", () => {
    const { container } = render(
      <CloseGroupSessionsButton agent={agent} sessionIds={[]} groupName="Group" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("always asks for confirmation, without a 'don't show again' option", () => {
    render(
      <CloseGroupSessionsButton
        agent={agent}
        sessionIds={["session-1", "child-1"]}
        groupName="Example project"
      />,
    );

    const [type, props] = openConfirm();

    expect(type).toBe("confirmAction");
    expect(props).toMatchObject({
      messageKey: "alert.close_agent_group_sessions",
      messageValues: { count: 2, group: "Example project" },
      confirmKey: "alert.close_agent_group_sessions_yes",
      showDontShowAgain: false,
      danger: true,
      onConfirm: expect.any(Function),
    });
  });

  it("closes every listed session and reports the count", async () => {
    mocks.closeSessions.mockResolvedValue({
      closed: ["session-1", "child-1"],
      failed: [],
    });
    render(
      <CloseGroupSessionsButton
        agent={agent}
        sessionIds={["session-1", "child-1"]}
        groupName="Example project"
      />,
    );

    const [, props] = openConfirm();
    await act(() => props.onConfirm());

    expect(mocks.closeSessions).toHaveBeenCalledWith(agent, [
      { id: "session-1" },
      { id: "child-1" },
    ]);
    expect(mocks.notifySuccess).toHaveBeenCalledWith("2 sessions closed.");
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });

  it("reports sessions that could not be closed", async () => {
    mocks.closeSessions.mockResolvedValue({
      closed: ["session-1"],
      failed: [{ sessionId: "child-1", reason: new Error("server is busy") }],
    });
    render(
      <CloseGroupSessionsButton
        agent={agent}
        sessionIds={["session-1", "child-1"]}
        groupName="Not in a workspace"
      />,
    );

    const [, props] = openConfirm();
    await act(() => props.onConfirm());

    expect(mocks.notifyError).toHaveBeenCalledWith(
      "1 session could not be closed: server is busy",
    );
  });
});
