import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import { b64e } from "../../../e2ee/protocol";
import WarningExternalModel, { DataSafetyText } from "../WarningExternalModel";

const brand = vi.hoisted(() => ({ externalWarningVisible: true }));

vi.mock("../../../config/brandPolicy", async (importOriginal) => ({
  ...(await importOriginal()),
  isBrandUiVisible: (key) =>
    key === "external_warning" ? brand.externalWarningVisible : true,
}));

const localState = (settings) => ({ settings });
const publicKey = b64e(x25519.getPublicKey(x25519.utils.randomSecretKey()));

// `boundModel` binds a key to that model id, which turns the safety lock blue.
const makeStore = (boundModel) => {
  const store = configureStore({
    reducer: { user_settings: userSettingsReducer },
  });
  if (boundModel) {
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k1", name: "Node A", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: boundModel, keyId: "k1" },
    });
  }
  return store;
};

const renderSafety = (store, settings) =>
  render(
    <Provider store={store}>
      <WarningExternalModel localState={localState(settings)} userData={{}} />
    </Provider>,
  );

describe("data safety warning", () => {
  beforeEach(() => {
    brand.externalWarningVisible = true;
  });

  it("is removed for a brand that hides the indicator", () => {
    brand.externalWarningVisible = false;
    const { container } = renderSafety(makeStore(), {
      model: { name: "External" },
      tools: {},
    });
    expect(container).toBeEmptyDOMElement();
    // The inline notice in the chat settings panel follows the same flag.
    const text = render(
      <DataSafetyText
        localState={localState({ model: { name: "External" }, tools: {} })}
        userData={{}}
      />,
    );
    expect(text.container).toBeEmptyDOMElement();
  });
  it("warns for external models", () => {
    render(
      <DataSafetyText
        localState={localState({
          model: { name: "OpenAI External" },
          enable_tools: true,
          tools: {},
        })}
        userData={{}}
      />,
    );
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
  });

  it("warns when MCP is enabled", () => {
    render(
      <DataSafetyText
        localState={localState({ model: { name: "Internal" }, tools: { mcp: true } })}
        userData={{}}
      />,
    );
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
  });

  it("stays silent for safe local settings", () => {
    const { container } = render(
      <DataSafetyText
        localState={localState({
          model: { name: "Internal" },
          enable_tools: false,
          tools: { mcp: false, web_search: false },
        })}
        userData={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the warning popover", () => {
    renderSafety(makeStore(), { model: { name: "External" }, tools: {} });
    expect(screen.getByText(/external model or external tools/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("keeps the safe notice closed until the lock is hovered", () => {
    const { container } = renderSafety(makeStore(), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });

    expect(
      screen.queryByText(/processed securely within our servers/i),
    ).toBeNull();

    fireEvent.mouseEnter(container.firstChild);

    expect(
      screen.getByText(/processed securely within our servers/i),
    ).toBeInTheDocument();
  });

  it("does not reopen the safe notice when another safe model is selected", () => {
    const { container, rerender } = renderSafety(makeStore(), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });
    fireEvent.mouseEnter(container.firstChild);
    expect(
      screen.getByText(/processed securely within our servers/i),
    ).toBeInTheDocument();
    fireEvent.mouseLeave(container.firstChild);

    rerender(
      <Provider store={makeStore()}>
        <WarningExternalModel
          localState={localState({
            model: { id: "gemma-4-31b-it", name: "Internal" },
            tools: {},
          })}
          userData={{}}
        />
      </Provider>,
    );

    expect(
      screen.queryByText(/processed securely within our servers/i),
    ).toBeNull();
  });

  it("keeps the green lock for a model without a key", () => {
    renderSafety(makeStore(), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });

    const button = screen.getByRole("button");
    expect(button.className).toMatch(/text-success/);
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });

  it("turns the lock blue and adds a chain for an encrypted model", () => {
    renderSafety(makeStore("qwen-a"), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });

    const button = screen.getByRole("button");
    expect(button.className).toMatch(/text-info/);
    expect(button.className).not.toMatch(/text-success/);
    // The lock plus the chain overlay.
    expect(button.querySelectorAll("svg")).toHaveLength(2);
  });

  it("mentions the additional end-to-end encryption in the notice", () => {
    const { container } = renderSafety(makeStore("qwen-a"), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });

    fireEvent.mouseEnter(container.firstChild);

    expect(
      screen.getByText(/additionally end-to-end encrypted/i),
    ).toBeInTheDocument();
  });

  it("keeps the plain notice for an unencrypted model", () => {
    const { container } = renderSafety(makeStore(), {
      model: { id: "qwen-a", name: "Internal" },
      tools: {},
    });

    fireEvent.mouseEnter(container.firstChild);

    expect(screen.getByText(/processed securely within our servers/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/additionally end-to-end encrypted/i),
    ).toBeNull();
  });
});
