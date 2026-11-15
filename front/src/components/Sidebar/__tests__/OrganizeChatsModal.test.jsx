import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizeChatsModal from "../Modals/OrganizeChatsModal";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) => selector({ interface_settings: {} }),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifyError: mocks.notifyError }),
}));
vi.mock("../../../db", () => ({
  assignConversationToFolder: vi.fn(),
  deleteConversation: vi.fn(),
  ensureFolder: vi.fn(),
  renameFolder: vi.fn(),
  setFolderColor: vi.fn(),
  setFolderIcon: vi.fn(),
  setFolderOrder: vi.fn(),
  updateConversationMeta: vi.fn(),
}));
vi.mock("../../../apis/generateConversationOrganization", () => ({
  default: (...args) => mocks.request(...args),
}));

const conversations = [
  {
    id: "c1",
    title: "Sprint notes",
    folderId: null,
    messages: [],
    lastModified: 1,
  },
  {
    id: "c2",
    title: "Tax documents",
    folderId: null,
    messages: [],
    lastModified: 2,
  },
];

describe("OrganizeChatsModal model progress", () => {
  beforeEach(() => {
    mocks.request.mockReset();
  });

  it("shows how much of the answer has arrived while the model works", async () => {
    let resolveRequest;
    let pushProgress;
    mocks.request.mockImplementation(
      ({ onProgress }) =>
        new Promise((resolve) => {
          pushProgress = onProgress;
          resolveRequest = resolve;
        }),
    );

    render(
      <OrganizeChatsModal
        isOpen
        onClose={() => {}}
        conversations={conversations}
        folders={[]}
      />,
    );

    expect(screen.getAllByText(/Analyzing your chats/).length).toBeGreaterThan(0);
    // Before any chunk arrives only the elapsed time is shown.
    expect(screen.queryByText(/Received/)).not.toBeInTheDocument();

    act(() => {
      pushProgress({ words: 3, reasoningWords: 0, chars: 20 });
    });
    expect(screen.getByText(/Received 3 words/)).toBeInTheDocument();

    act(() => {
      pushProgress({ words: 24, reasoningWords: 0, chars: 180 });
    });
    expect(screen.getByText(/Received 24 words/)).toBeInTheDocument();

    await act(async () => {
      resolveRequest({
        assessment: "Two unrelated chats.",
        tree: [],
        titles: [],
        deletions: [],
        analyzedCount: 2,
        totalCount: 2,
      });
    });

    expect(screen.queryByText(/Received 24 words/)).not.toBeInTheDocument();
    expect(screen.getByText("Two unrelated chats.")).toBeInTheDocument();
  });

  it("shows reasoning words while the answer is still empty", async () => {
    let pushProgress;
    mocks.request.mockImplementation(
      ({ onProgress }) =>
        new Promise(() => {
          pushProgress = onProgress;
        }),
    );

    render(
      <OrganizeChatsModal
        isOpen
        onClose={() => {}}
        conversations={conversations}
        folders={[]}
      />,
    );

    act(() => {
      pushProgress({ words: 0, reasoningWords: 7, chars: 0 });
    });

    expect(screen.getByText(/reasoning — 7 words/)).toBeInTheDocument();
    expect(screen.queryByText(/Received/)).not.toBeInTheDocument();
  });
});
