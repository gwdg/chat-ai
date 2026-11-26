import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaList from "../ArcanaList";

const mocks = vi.hoisted(() => ({
  openModal: vi.fn(),
  dispatch: vi.fn(),
  retry: vi.fn(),
  deleteCollection: vi.fn(),
  access: "available",
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
  },
}));

vi.mock("react-redux", () => ({
  useSelector: (selector) =>
    selector({ interface_settings: { dark_mode: false } }),
  useDispatch: () => mocks.dispatch,
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
  useSaiaRagAccess: () => mocks.access,
}));
vi.mock("../../../workspace/arcanas", () => ({
  arcanasProvider: () => ({ deleteCollection: mocks.deleteCollection }),
  arcanaDisplayName: (collection) =>
    collection.shared ? `${collection.owner}__${collection.name}` : collection.name,
  retryArcanas: mocks.retry,
  useArcanas: () => mocks.state,
}));

beforeEach(() => {
  mocks.openModal.mockReset();
  mocks.dispatch.mockReset();
  mocks.retry.mockReset();
  mocks.deleteCollection.mockReset();
  mocks.deleteCollection.mockResolvedValue(undefined);
  mocks.access = "available";
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
  };
});

describe("ArcanaList", () => {
  it("renders nothing until the service probe confirms it is there", () => {
    for (const access of ["checking", "unavailable"]) {
      mocks.access = access;
      const { container, unmount } = render(<ArcanaList />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("lists the collections with their role", () => {
    render(<ArcanaList />);

    expect(screen.getByText("Arcanas")).toBeInTheDocument();
    expect(screen.getByText("recipes")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("papers")).toBeInTheDocument();
    expect(screen.getByText("shared by bob · Read only")).toBeInTheDocument();
  });

  it("opens the manager when a collection is clicked", () => {
    render(<ArcanaList />);

    fireEvent.click(screen.getByText("recipes"));

    expect(mocks.openModal).toHaveBeenCalledWith("arcanaManager", {
      collection: mocks.state.collections[0],
    });
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
