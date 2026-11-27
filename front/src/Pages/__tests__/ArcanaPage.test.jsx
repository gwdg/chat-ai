import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  key: "initial",
  collections: [
    {
      name: "Paper pile",
      collection: "tester/papers",
      owner: "tester",
      role: "owner",
      can_write: true,
      can_manage: true,
      shared: false,
    },
  ],
  loading: false,
  loaded: true,
  error: null,
  access: "available",
  navigate: vi.fn(),
  reload: vi.fn(),
  arcanasEnabled: [],
}));

vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  // The route still resolves a link from before the form changed.
  useParams: () => ({ collection: "tester__papers" }),
  useSearchParams: () => [mocks.searchParams],
  useLocation: () => ({ pathname: "/arcana/tester__papers", key: mocks.key }),
}));
vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ user_settings: {}, interface_settings: {} }),
}));
vi.mock("../../hooks/useUpdateModelsData", () => ({
  useUpdateModelsData: () => ({}),
}));
vi.mock("../../hooks/useUpdateUserData", () => ({
  useUpdateUserData: () => ({}),
}));
vi.mock("../../hooks/useSaiaRagAccess", () => ({
  SAIA_RAG_CHECKING: "checking",
  SAIA_RAG_AVAILABLE: "available",
  SAIA_RAG_UNAVAILABLE: "unavailable",
  useSaiaRagAccessWithReload: () => ({
    access: mocks.access,
    reload: mocks.reload,
  }),
}));
vi.mock("../../utils/conversationUtils", () => ({
  getDefaultConversation: () => ({ id: "draft", settings: {}, messages: [] }),
}));
vi.mock("../../workspace/arcanas", () => ({
  useArcanas: (enabled = true) => {
    mocks.arcanasEnabled.push(enabled);
    return {
      collections: mocks.collections,
      loading: mocks.loading,
      loaded: mocks.loaded,
      error: mocks.error,
    };
  },
}));
vi.mock("../../components/Sidebar/SidebarWrapper", () => ({
  default: () => <div data-testid="sidebar" />,
}));
vi.mock("../../components/Header/AnnouncementBar", () => ({
  default: () => null,
}));
vi.mock("../../components/Header/Header", () => ({ default: () => null }));
vi.mock("../../components/Footer/CollapsibleFooter", () => ({
  default: () => null,
}));
vi.mock("../../components/Arcana/ArcanaChatPanel", () => ({
  default: ({ collection, actions, fileCount }) => (
    <div data-testid="arcana-chat" data-file-count={fileCount ?? ""}>
      {collection.name}
      {actions}
    </div>
  ),
}));
vi.mock("../../components/Arcana/ArcanaEditorPanel", () => ({
  default: ({ collection, initialTab, focus, onClose }) => (
    <div
      data-testid="arcana-editor"
      data-tab={initialTab}
      data-focus={focus ?? ""}
    >
      {collection.name}
      <button type="button" onClick={onClose}>
        Collapse
      </button>
    </div>
  ),
}));

import ArcanaPage from "../ArcanaPage";

const toggle = () => {
  const button = document.querySelector('[data-guide="arcana-editor-toggle"]');
  if (!button) throw new Error("editor toggle is not rendered");
  return button;
};

beforeEach(() => {
  window.localStorage.clear();
  mocks.searchParams = new URLSearchParams();
  mocks.key = String(Math.random());
  mocks.collections = [
    {
      name: "Paper pile",
      collection: "tester/papers",
      owner: "tester",
      role: "owner",
      can_write: true,
      can_manage: true,
      shared: false,
    },
  ];
  mocks.loading = false;
  mocks.loaded = true;
  mocks.error = null;
  mocks.access = "available";
  mocks.navigate.mockReset();
  mocks.reload.mockReset();
  mocks.arcanasEnabled = [];
});

describe("ArcanaPage", () => {
  it("waits for the service probe instead of rendering an empty column", () => {
    mocks.access = "checking";
    render(<ArcanaPage />);

    expect(screen.getByText("Loading Arcanas…")).toBeInTheDocument();
    expect(screen.queryByTestId("arcana-chat")).not.toBeInTheDocument();
    expect(mocks.arcanasEnabled).not.toContain(true);
  });

  it("says the service is not connected and offers a reload", () => {
    mocks.access = "unavailable";
    render(<ArcanaPage />);

    expect(
      screen.getByText("Not connected to the Arcana service."),
    ).toBeInTheDocument();
    // The collection list is not read from a service that did not answer.
    expect(mocks.arcanasEnabled).not.toContain(true);
    expect(screen.queryByTestId("arcana-chat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(mocks.reload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/chat");
  });

  it("puts the chat in the middle and the editor beside it", () => {
    window.localStorage.setItem("chatai.arcana.editor-open", "true");
    render(<ArcanaPage />);

    expect(screen.getByTestId("arcana-chat")).toBeInTheDocument();
    expect(screen.getByTestId("arcana-editor")).toBeInTheDocument();
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("wears one head panel, not a page bar above the chat", () => {
    window.localStorage.setItem("chatai.arcana.editor-open", "true");
    render(<ArcanaPage />);

    // The page-kind bar is gone; the Meta chat has no such row either.
    expect(screen.queryByTestId("arcana-page-header")).not.toBeInTheDocument();
    // Its controls live in the chat's head panel instead.
    expect(screen.getByTestId("arcana-chat")).toContainElement(toggle());
    // The count stays off until the editor has read the collection.
    expect(screen.getByTestId("arcana-chat")).toHaveAttribute(
      "data-file-count",
      "",
    );
  });

  it("collapses and reopens the editor from the header and the panel", () => {
    window.localStorage.setItem("chatai.arcana.editor-open", "true");
    render(<ArcanaPage />);

    fireEvent.click(toggle());
    expect(screen.queryByTestId("arcana-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("arcana-chat")).toBeInTheDocument();

    fireEvent.click(toggle());
    expect(screen.getByTestId("arcana-editor")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Collapse"));
    expect(screen.queryByTestId("arcana-editor")).not.toBeInTheDocument();
  });

  it("keeps the preference for the next visit", () => {
    window.localStorage.setItem("chatai.arcana.editor-open", "false");
    render(<ArcanaPage />);

    expect(screen.queryByTestId("arcana-editor")).not.toBeInTheDocument();
    fireEvent.click(toggle());
    expect(window.localStorage.getItem("chatai.arcana.editor-open")).toBe(
      "true",
    );
  });

  it("opens the panel for a deep link even when it was closed", () => {
    window.localStorage.setItem("chatai.arcana.editor-open", "false");
    mocks.searchParams = new URLSearchParams("tab=share&upload=1");
    render(<ArcanaPage />);

    const editor = screen.getByTestId("arcana-editor");
    expect(editor).toHaveAttribute("data-tab", "share");
    expect(editor).toHaveAttribute("data-focus", "upload");
  });

  it("reports a collection that is gone instead of an empty page", () => {
    mocks.collections = [];
    render(<ArcanaPage />);

    expect(
      screen.getByText("This Arcana is not available"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("arcana-chat")).not.toBeInTheDocument();
  });
});
