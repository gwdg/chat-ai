import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArcanaActionCard from "../ArcanaActionCard";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  revert: vi.fn(),
  t: vi.fn((key, options) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("../../../../utils/arcanaActionApply", () => ({
  applyArcanaActions: mocks.apply,
  revertArcanaActions: mocks.revert,
}));

const collection = "tester__test";

const write = {
  op: "write_text_file",
  collection,
  filename: "note.md",
  content: "hello",
  size: 5,
  existed: false,
  previousText: null,
};

const tags = {
  op: "set_file_tags",
  collection,
  filename: "a.md",
  tags: ["beta"],
  previousTags: ["alpha"],
};

const index = { op: "start_index", collection };

const makeState = (decision) => {
  let state = {
    id: `arcana-chat:${collection}`,
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "" }],
        ...(decision ? { meta: { actionDecision: decision } } : {}),
      },
    ],
  };
  const setLocalState = vi.fn((updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
  });
  return { get: () => state, setLocalState };
};

beforeEach(() => {
  mocks.apply.mockReset().mockResolvedValue({ applied: [], failures: [] });
  mocks.revert.mockReset().mockResolvedValue({ applied: [], failures: [] });
});

describe("ArcanaActionCard", () => {
  it("lists every proposed change and its accept button", () => {
    const { setLocalState } = makeState();
    render(
      <ArcanaActionCard
        actions={[write, tags]}
        localState={makeState().get()}
        setLocalState={setLocalState}
        message_index={0}
      />,
    );

    expect(screen.getByText("arcana_chat.action_title")).toBeTruthy();
    expect(
      screen.getByText(/arcana_chat\.action_write:.*note\.md/),
    ).toBeTruthy();
    expect(
      screen.getByText(/arcana_chat\.action_tags:.*a\.md/),
    ).toBeTruthy();
    const accept = screen.getByRole("button", {
      name: "meta_chat.accept_changes",
    });
    expect(accept.getAttribute("data-guide")).toBe("arcana-action-accept");
  });

  it("applies the whole list and records the decision", async () => {
    const local = makeState();
    render(
      <ArcanaActionCard
        actions={[write, tags]}
        localState={local.get()}
        setLocalState={local.setLocalState}
        message_index={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "meta_chat.accept_changes" }),
    );

    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith([write, tags]),
    );
    expect(
      await screen.findByRole("button", {
        name: "meta_chat.revert_changes",
      }),
    ).toBeTruthy();
    expect(local.get().messages[0].meta.actionDecision).toBe("accepted");
  });

  it("keeps the accept button and explains a failure", async () => {
    mocks.apply.mockResolvedValue({
      applied: [],
      failures: [{ action: write, reason: "service down" }],
    });
    const { setLocalState } = makeState();
    render(
      <ArcanaActionCard
        actions={[write]}
        localState={makeState().get()}
        setLocalState={setLocalState}
        message_index={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "meta_chat.accept_changes" }),
    );

    expect(await screen.findByText(/arcana_chat\.action_error/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "meta_chat.accept_changes" }),
    ).toBeTruthy();
    expect(setLocalState).not.toHaveBeenCalled();
  });

  it("shows the revert action for a stored accepted card", () => {
    const { setLocalState } = makeState("accepted");
    render(
      <ArcanaActionCard
        actions={[write]}
        localState={makeState("accepted").get()}
        setLocalState={setLocalState}
        message_index={0}
      />,
    );

    expect(
      screen.getByRole("button", { name: "meta_chat.revert_changes" }),
    ).toBeTruthy();
  });

  it("reverts the list and records the rejection", async () => {
    const local = makeState("accepted");
    render(
      <ArcanaActionCard
        actions={[write]}
        localState={local.get()}
        setLocalState={local.setLocalState}
        message_index={0}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "meta_chat.revert_changes" }),
    );

    await waitFor(() =>
      expect(mocks.revert).toHaveBeenCalledWith([write]),
    );
    expect(
      await screen.findByRole("button", {
        name: "meta_chat.accept_changes",
      }),
    ).toBeTruthy();
    expect(local.get().messages[0].meta.actionDecision).toBe("rejected");
  });

  it("does not offer to undo a change that captured no restore state", () => {
    const { setLocalState } = makeState("accepted");
    render(
      <ArcanaActionCard
        actions={[index]}
        localState={makeState("accepted").get()}
        setLocalState={setLocalState}
        message_index={0}
      />,
    );

    expect(
      screen.getByText("meta_chat.applied_not_reversible"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "meta_chat.revert_changes" }),
    ).toBeNull();
  });
});
