import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaList from "../ArcanaList";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  navigate: vi.fn(),
  pathname: "/chat",
  dispatch: vi.fn(),
  retry: vi.fn(),
  deleteCollection: vi.fn(),
  access: "available",
  arcanasEnabled: true,
  state: {
    collections: [
      {
        name: "recipes",
        collection: "alice__recipes",
        owner: "alice",
        role: "owner",
        can_write: true,
        can_manage: true,
        shared: false,
      },
      {
        name: "papers",
        collection: "bob__papers",
        owner: "bob",
        role: "reader",
        can_write: false,
        can_manage: false,
        shared: true,
      },
    ],
    loading: false,
    loaded: true,
    error: null,
    statuses: {
      alice__recipes: "current",
      bob__papers: "partial",
    },
  },
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ interface_settings: { dark_mode: false } }),
  useDispatch: () => mocks.dispatch,
}));
vi.mock("react-router", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: mocks.pathname }),
}));
vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: mocks.openModal }),
}));
vi.mock("../../../Redux/reducers/interfaceSettingsSlice", () => ({
  selectCollapsedTopics: () => [],
  toggleTopic: (id) => ({ type: "toggleTopic", id }),
}));
vi.mock("../../../hooks/useToast", () => ({
  useToast: () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }),
}));
vi.mock("../../../hooks/useSaiaRagAccess", () => ({
  SAIA_RAG_AVAILABLE: "available",
  SAIA_RAG_CHECKING: "checking",
  useSaiaRagAccess: () => mocks.access,
}));
vi.mock("../../../workspace/arcanas", () => ({
  arcanasProvider: () => ({ deleteCollection: mocks.deleteCollection }),
  arcanaDisplayName: (collection) =>
    collection.shared ? `${collection.owner}__${collection.name}` : collection.name,
  arcanaPagePath: (collection, options = {}) => {
    const params = new URLSearchParams();
    if (options.upload) params.set("upload", "1");
    if (options.tab && options.tab !== "files") params.set("tab", options.tab);
    const query = params.toString();
    return `/arcana/${encodeURIComponent(collection.collection)}${
      query ? `?${query}` : ""
    }`;
  },
  retryArcanas: mocks.retry,
  useArcanas: (enabled = true) => {
    mocks.arcanasEnabled = enabled;
    return mocks.state;
  },
}));

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.navigate.mockReset();
  mocks.pathname = "/chat";
  mocks.dispatch.mockReset();
  mocks.retry.mockReset();
  mocks.deleteCollection.mockReset();
  mocks.deleteCollection.mockResolvedValue(undefined);
  mocks.access = "available";
  mocks.arcanasEnabled = true;
  mocks.state = {
    collections: [
      {
        name: "recipes",
        collection: "alice__recipes",
        owner: "alice",
        role: "owner",
        can_write: true,
        can_manage: true,
        shared: false,
      },
      {
        name: "papers",
        collection: "bob__papers",
        owner: "bob",
        role: "reader",
        can_write: false,
        can_manage: false,
        shared: true,
      },
    ],
    loading: false,
    loaded: true,
    error: null,
    statuses: {
      alice__recipes: "current",
      bob__papers: "partial",
    },
  };
});

describe("ArcanaList", () => {
  it("keeps the section visible while the service probe has not confirmed it", () => {
    for (const access of ["checking", "unavailable"]) {
      mocks.access = access;
      const { unmount } = render(<ArcanaList />);
      expect(screen.getByText("Arcanas")).toBeInTheDocument();
      expect(screen.queryByText("recipes")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "New Arcana" }),
      ).toBeDisabled();
      expect(mocks.arcanasEnabled).toBe(false);
      unmount();
    }
  });

  it("says the service is not connected instead of listing nothing", () => {
    mocks.access = "unavailable";
    render(<ArcanaList />);

    expect(
      screen.getByText("Not connected to the Arcana service."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Create your first Arcana")).not.toBeInTheDocument();
  });

  it("shows the loading line while the probe is still running", () => {
    mocks.access = "checking";
    render(<ArcanaList />);

    expect(screen.getByText("Loading Arcanas…")).toBeInTheDocument();
  });

  it("lists the collections with their role", () => {
    render(<ArcanaList />);

    expect(mocks.arcanasEnabled).toBe(true);

    expect(screen.getByText("Arcanas")).toBeInTheDocument();
    expect(screen.getByText("recipes")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("papers")).toBeInTheDocument();
    expect(screen.getByText("shared by bob · Read only")).toBeInTheDocument();
  });

  it("paints the index state as a dot instead of a collection icon", () => {
    const { container } = render(<ArcanaList />);

    const current = container.querySelector('[data-index-status="current"]');
    const partial = container.querySelector('[data-index-status="partial"]');

    expect(current).toHaveAttribute("title", "Index up to date");
    expect(current?.className).toContain("bg-success");
    expect(partial).toHaveAttribute("title", "Partially indexed");
    expect(partial?.className).toContain("bg-warning");
  });

  it("opens the page when a collection is clicked", () => {
    render(<ArcanaList />);

    fireEvent.click(screen.getByText("recipes"));

    expect(mocks.navigate).toHaveBeenCalledWith("/arcana/alice__recipes");
  });

  it("marks the open collection in the sidebar", () => {
    mocks.pathname = "/arcana/alice__recipes";
    render(<ArcanaList />);

    expect(screen.getByText("recipes").closest(".group")?.className).toContain(
      "bg-base-200 shadow-sm",
    );
    expect(screen.getByText("papers").closest(".group")?.className).not.toContain(
      "shadow-sm",
    );
  });

  it("opens the page's search tab from the options menu", async () => {
    render(<ArcanaList />);

    const row = screen.getByText("recipes").closest(".group");
    fireEvent.click(within(row).getByRole("button", { name: "Arcana options" }));
    fireEvent.click(await screen.findByText("Search"));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/arcana/alice__recipes?tab=search",
    );
  });

  it("offers the empty state when there is no collection", () => {
    mocks.state = { collections: [], loading: false, loaded: true, error: null };
    render(<ArcanaList />);

    fireEvent.click(screen.getByText("Create your first Arcana"));
    expect(mocks.openModal).toHaveBeenCalledWith("arcanaCreate");
  });

  it("deletes a shared collection under its storage name", async () => {
    // A collection can only be shared and manageable when the caller was
    // granted ownership elsewhere; the name still has to use the storage form.
    mocks.state = {
      ...mocks.state,
      collections: [
        mocks.state.collections[0],
        { ...mocks.state.collections[1], can_manage: true },
      ],
    };
    render(<ArcanaList />);

    // Open the row menu of the shared collection and pick Delete.
    const sharedRow = screen.getByText("papers").closest(".group");
    fireEvent.click(
      within(sharedRow).getByRole("button", { name: "Arcana options" }),
    );
    fireEvent.click(await screen.findByText("Delete Arcana"));

    const [, props] = mocks.openModal.mock.calls.at(-1);
    expect(props.messageValues).toEqual({ name: "papers" });

    await act(async () => {
      await props.onConfirm();
    });
    expect(mocks.deleteCollection).toHaveBeenCalledWith("bob__papers");
    expect(mocks.retry).toHaveBeenCalled();
  });

  it("does not offer Delete on a collection the caller cannot manage", async () => {
    mocks.state = {
      ...mocks.state,
      collections: [mocks.state.collections[1]],
    };
    render(<ArcanaList />);

    fireEvent.click(screen.getByRole("button", { name: "Arcana options" }));
    await waitFor(() =>
      expect(screen.getByText("Files and search")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Delete Arcana")).not.toBeInTheDocument();
  });

  it("shows a service failure and offers a retry", () => {
    mocks.state = {
      collections: [],
      loading: false,
      loaded: false,
      error: "Service unavailable",
    };
    render(<ArcanaList />);

    fireEvent.click(screen.getByText("Retry"));
    expect(mocks.retry).toHaveBeenCalled();
  });
});
