import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DeleteUnsortedChatsModal from "../DeleteUnsortedChatsModal";

const dbMocks = vi.hoisted(() => ({
  deleteConversation: vi.fn(async () => {}),
}));
const toast = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
const router = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: "/chat/c1",
}));

vi.mock("../../../../db", () => dbMocks);
vi.mock("../../../../hooks/useToast", () => ({ useToast: () => toast }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ pathname: router.pathname }),
}));

const conversations = [
  { id: "c1", title: "First loose chat" },
  { id: "c2", title: "Second loose chat" },
];

beforeEach(() => {
  dbMocks.deleteConversation.mockClear();
  toast.notifySuccess.mockClear();
  toast.notifyError.mockClear();
  router.navigate.mockClear();
  router.pathname = "/chat/c1";
});

describe("DeleteUnsortedChatsModal", () => {
  it("names every chat it will delete", () => {
    render(
      <DeleteUnsortedChatsModal
        isOpen
        onClose={vi.fn()}
        conversations={conversations}
        currentConversationId="other"
      />,
    );

    expect(
      screen.getByText(/delete all 2 chats that are not in a topic/i),
    ).toBeInTheDocument();
  });

  it("deletes every unsorted chat only after confirmation", async () => {
    const onClose = vi.fn();
    render(
      <DeleteUnsortedChatsModal
        isOpen
        onClose={onClose}
        conversations={conversations}
        currentConversationId={null}
      />,
    );

    expect(dbMocks.deleteConversation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove all chats" }));

    await waitFor(() =>
      expect(dbMocks.deleteConversation).toHaveBeenCalledTimes(2),
    );
    expect(dbMocks.deleteConversation).toHaveBeenNthCalledWith(1, "c1");
    expect(dbMocks.deleteConversation).toHaveBeenNthCalledWith(2, "c2");
    expect(onClose).toHaveBeenCalled();
    expect(toast.notifySuccess).toHaveBeenCalledWith(
      "Removed 2 unsorted chats.",
    );
  });

  it("leaves the open chat page when it was one of the deleted chats", async () => {
    render(
      <DeleteUnsortedChatsModal
        isOpen
        onClose={vi.fn()}
        conversations={conversations}
        currentConversationId="c2"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove all chats" }));

    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith("/chat/"),
    );
  });

  it("does nothing on cancel", () => {
    render(
      <DeleteUnsortedChatsModal
        isOpen
        onClose={vi.fn()}
        conversations={conversations}
        currentConversationId={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(dbMocks.deleteConversation).not.toHaveBeenCalled();
  });
});
