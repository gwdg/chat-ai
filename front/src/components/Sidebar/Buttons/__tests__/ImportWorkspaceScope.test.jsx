import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importConversation = vi.fn(async () => {});
const openModal = vi.fn();

vi.mock("../../../../hooks/useImportConversation", () => ({
  useImportConversation: () => importConversation,
}));

vi.mock("../../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));

vi.mock("../../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal }),
}));

vi.mock("../../ShortcutTooltip", () => ({
  default: ({ children }) => children,
}));

import ImportChatButton from "../ImportChatButton";
import ImportPersonaButton from "../ImportPersonaButton";

describe("sidebar import buttons and the selected workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports a chat into the selected workspace", async () => {
    const { container } = render(
      <ImportChatButton variant="button" topicId="topic-1" workspaceId="ws-1" />,
    );

    const input = container.querySelector('input[type="file"]');
    const file = new File(['{"title":"Imported"}'], "chat.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(importConversation).toHaveBeenCalledWith(
        { title: "Imported" },
        false,
        "topic-1",
        { workspaceId: "ws-1" },
      ),
    );
  });

  it("keeps an import unassigned when no workspace is selected", async () => {
    const { container } = render(<ImportChatButton variant="button" />);

    const input = container.querySelector('input[type="file"]');
    const file = new File(['{"title":"Imported"}'], "chat.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(importConversation).toHaveBeenCalledWith(
        { title: "Imported" },
        false,
        null,
        { workspaceId: null },
      ),
    );
  });

  it("passes the selected workspace on to the persona dialog", () => {
    render(<ImportPersonaButton variant="sidebar" workspaceId="ws-1" />);

    fireEvent.click(screen.getByRole("button"));

    expect(openModal).toHaveBeenCalledWith("importPersona", {
      topicId: null,
      workspaceId: "ws-1",
    });
  });
});
