import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArcanaContainer from "../ArcanaContainer";

const agentMocks = vi.hoisted(() => ({ agent: false }));

vi.mock("../../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn() }),
}));
vi.mock("../../../apis/agentEndpoints", () => ({
  isAgentEnabled: () => agentMocks.agent,
}));

beforeEach(() => {
  agentMocks.agent = false;
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
