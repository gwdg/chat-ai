import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArcanaContainer from "../ArcanaContainer";

const agentMocks = vi.hoisted(() => ({ agent: false, tools: true }));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => agentMocks.agent,
  modelSupportsTools: () => agentMocks.tools,
}));

beforeEach(() => {
  agentMocks.agent = false;
  agentMocks.tools = true;
});

const stateWith = (settings) => ({
  settings: {
    enable_tools: true,
    model: { id: "test-model", name: "Test Model" },
    tools: { arcana: true },
    ...settings,
  },
});

const list = () => document.querySelector('[data-guide="tools-arcana-list"]');

describe("ArcanaContainer list of arcanas in use", () => {
  it("shows a share link's collection once, with both bindings", () => {
    render(
      <ArcanaContainer
        localState={stateWith({
          arcana: { id: "alice/papers" },
          arcana_share: {
            collection: "alice__papers",
            owner: "alice",
            name: "papers",
          },
        })}
        setLocalState={vi.fn()}
        configurable
      />,
    );

    expect(list()).toBeInTheDocument();
    expect(screen.getAllByText("alice/papers")).toHaveLength(1);
    expect(screen.getByText("Arcana tool")).toBeInTheDocument();
    expect(screen.getByText("Read-only tools")).toBeInTheDocument();
  });

  it("shows a bare Arcana id as the tool's own binding", () => {
    render(
      <ArcanaContainer
        localState={stateWith({ arcana: { id: "papers" } })}
        setLocalState={vi.fn()}
        configurable
      />,
    );

    expect(screen.getByText("papers")).toBeInTheDocument();
    expect(screen.getByText("Arcana tool")).toBeInTheDocument();
    expect(screen.queryByText("Read-only tools")).not.toBeInTheDocument();
  });

  it("keeps a share binding visible while the tool is off", () => {
    render(
      <ArcanaContainer
        localState={stateWith({
          arcana: { id: "" },
          arcana_share: {
            collection: "alice__papers",
            owner: "alice",
            name: "papers",
          },
        })}
        setLocalState={vi.fn()}
        configurable={false}
      />,
    );

    expect(screen.getByText("alice/papers")).toBeInTheDocument();
    expect(screen.getByText("Read-only tools")).toBeInTheDocument();
    // The editable field stays hidden while the tool cannot be configured.
    expect(
      screen.queryByPlaceholderText("Arcana id"),
    ).not.toBeInTheDocument();
  });

  it("removes the Arcana tool binding", () => {
    const localState = stateWith({ arcana: { id: "papers" } });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove papers" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana.id).toBe("");
  });

  it("removes a share binding without touching the Arcana tool field", () => {
    const localState = stateWith({
      arcana: { id: "own_collection" },
      arcana_share: {
        collection: "alice__papers",
        owner: "alice",
        name: "papers",
      },
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove alice/papers" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana_share).toBeUndefined();
    expect(next.settings.arcana.id).toBe("own_collection");
  });

  it("removes both bindings of one collection at once", () => {
    const localState = stateWith({
      arcana: { id: "alice/papers" },
      arcana_share: {
        collection: "alice__papers",
        owner: "alice",
        name: "papers",
      },
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove alice/papers" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana.id).toBe("");
    expect(next.settings.arcana_share).toBeUndefined();
  });

  it("renders no list when the chat is not wired to a collection", () => {
    render(
      <ArcanaContainer
        localState={stateWith({ arcana: { id: "" } })}
        setLocalState={vi.fn()}
        configurable
      />,
    );

    expect(list()).toBeNull();
  });
});

describe("ArcanaContainer adding collections", () => {
  // The browser agent is the default workflow; that is where the read tools
  // and therefore the add form live.
  beforeEach(() => {
    agentMocks.agent = true;
  });

  it("keeps the add field while the Arcana tool is switched off", () => {
    render(
      <ArcanaContainer
        localState={stateWith({})}
        setLocalState={vi.fn()}
        configurable={false}
      />,
    );

    expect(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("hides the add field for a model that cannot run tools", () => {
    agentMocks.tools = false;
    render(
      <ArcanaContainer
        localState={stateWith({})}
        setLocalState={vi.fn()}
        configurable
      />,
    );

    expect(
      screen.queryByPlaceholderText("owner/arcana, e.g. alice/papers"),
    ).not.toBeInTheDocument();
  });

  it("adds a typed owner/arcana with a description and turns tools on", () => {
    const localState = stateWith({ enable_tools: false, arcana: { id: "" } });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
      { target: { value: "alice/papers" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Short description for the agent (optional)"),
      { target: { value: " Peer-reviewed papers " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.enable_tools).toBe(true);
    expect(next.settings.arcana_shares).toEqual([
      {
        collection: "alice__papers",
        owner: "alice",
        name: "papers",
        description: "Peer-reviewed papers",
      },
    ]);
  });

  it("keeps existing collections when another is added", () => {
    const localState = stateWith({
      arcana_shares: [
        { collection: "alice__papers", owner: "alice", name: "papers" },
      ],
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
      { target: { value: "bob/notes" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana_shares.map((item) => item.collection)).toEqual([
      "alice__papers",
      "bob__notes",
    ]);
  });

  it("refuses a value that is not owner/arcana", () => {
    const setLocalState = vi.fn();
    render(
      <ArcanaContainer
        localState={stateWith({ arcana: { id: "" } })}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
      { target: { value: "papers" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(setLocalState).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Enter an Arcana as owner/arcana, e.g. alice/papers.",
      ),
    ).toBeInTheDocument();
  });

  it("refuses a collection that is already in the chat", () => {
    const setLocalState = vi.fn();
    render(
      <ArcanaContainer
        localState={stateWith({
          arcana_shares: [
            { collection: "alice__papers", owner: "alice", name: "papers" },
          ],
        })}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
      { target: { value: "alice/papers" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(setLocalState).not.toHaveBeenCalled();
    expect(
      screen.getByText("This Arcana is already in the chat."),
    ).toBeInTheDocument();
  });

  it("edits the description of an added collection", () => {
    const localState = stateWith({
      arcana_shares: [
        { collection: "alice__papers", owner: "alice", name: "papers" },
      ],
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Description of alice/papers"),
      { target: { value: "Only the 2026 papers" } },
    );

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana_shares[0].description).toBe(
      "Only the 2026 papers",
    );
  });

  it("removes one collection and keeps the others", () => {
    const localState = stateWith({
      arcana_shares: [
        { collection: "alice__papers", owner: "alice", name: "papers" },
        { collection: "bob__notes", owner: "bob", name: "notes" },
      ],
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove alice/papers" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana_shares.map((item) => item.collection)).toEqual([
      "bob__notes",
    ]);
  });

  it("folds a link binding into the list when the list is edited", () => {
    const localState = stateWith({
      arcana_share: {
        collection: "alice__papers",
        owner: "alice",
        name: "papers",
      },
    });
    const setLocalState = vi.fn((updater) => updater(localState));
    render(
      <ArcanaContainer
        localState={localState}
        setLocalState={setLocalState}
        configurable
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("owner/arcana, e.g. alice/papers"),
      { target: { value: "bob/notes" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const next = setLocalState.mock.results[0].value;
    expect(next.settings.arcana_share).toBeUndefined();
    expect(next.settings.arcana_shares.map((item) => item.collection)).toEqual([
      "alice__papers",
      "bob__notes",
    ]);
  });
});
