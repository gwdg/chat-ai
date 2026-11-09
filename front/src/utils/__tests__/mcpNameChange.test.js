import { describe, expect, it, vi } from "vitest";
import { confirmMcpNameChange } from "../mcpNameChange";

const server = {
  url: "http://localhost:9000/mcp",
  enabled: true,
  name: "Old Name",
};

const stateWith = () => ({
  id: "conversation",
  settings: {
    mcp_servers: [
      { url: "http://localhost:9000/mcp", enabled: true, name: "Old Name" },
      { url: "http://localhost:9001/mcp", enabled: true },
    ],
  },
});

describe("confirmMcpNameChange", () => {
  it("asks the user and updates the stored name when accepted", async () => {
    let state = stateWith();
    const setLocalState = vi.fn((updater) => {
      state = updater(state);
    });
    let modal;
    const openModal = vi.fn((type, props) => {
      modal = { type, props };
    });

    const accepted = confirmMcpNameChange({
      openModal,
      setLocalState,
      conversationId: "conversation",
      server,
      actualName: "New Name",
    });

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(modal.type).toBe("mcpNameChange");
    expect(modal.props).toMatchObject({
      serverUrl: server.url,
      previousName: "Old Name",
      actualName: "New Name",
    });

    modal.props.onConfirm();

    await expect(accepted).resolves.toBe(true);
    expect(state.settings.mcp_servers).toEqual([
      { url: "http://localhost:9000/mcp", enabled: true, name: "New Name" },
      { url: "http://localhost:9001/mcp", enabled: true },
    ]);
    expect(state.flush).toBe(true);
  });

  it("does not update the name when the user declines", async () => {
    const setLocalState = vi.fn();
    let modal;
    const openModal = vi.fn((type, props) => {
      modal = { type, props };
    });

    const accepted = confirmMcpNameChange({
      openModal,
      setLocalState,
      conversationId: "conversation",
      server,
      actualName: "New Name",
    });

    modal.props.onCancel();

    await expect(accepted).resolves.toBe(false);
    expect(setLocalState).not.toHaveBeenCalled();
  });
});
