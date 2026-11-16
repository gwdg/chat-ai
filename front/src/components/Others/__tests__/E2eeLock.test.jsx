import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import i18n from "../../../i18n";
import { b64e } from "../../../e2ee/protocol";
import E2eeLock from "../E2eeLock";

const publicKey = b64e(x25519.getPublicKey(x25519.utils.randomSecretKey()));

const store = (user_settings) =>
  configureStore({
    reducer: (state = { user_settings }) => state,
  });

const renderLock = (user_settings, modelId = "qwen-a") =>
  render(
    <Provider store={store(user_settings)}>
      <E2eeLock modelId={modelId} />
    </Provider>,
  );

const key = { id: "node-a", name: "Node A", publicKey };

describe("E2eeLock", () => {
  it("marks a model bound to a usable key", () => {
    const { container } = renderLock({
      e2ee_keys: [key],
      e2ee_models: { "qwen-a": "node-a" },
    });

    const badge = container.querySelector(".text-success");
    expect(badge).not.toBeNull();
    expect(badge.getAttribute("aria-label")).toBe(i18n.t("e2ee.badge"));
  });

  it("renders nothing for an unkeyed model", () => {
    const { container } = renderLock({
      e2ee_keys: [key],
      e2ee_models: { "qwen-a": "node-a" },
    }, "qwen-b");

    expect(container.querySelector(".text-success")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for an unusable key", () => {
    const { container } = renderLock({
      e2ee_keys: [{ id: "broken", publicKey: "not-a-key" }],
      e2ee_models: { "qwen-a": "broken" },
    });

    expect(container.innerHTML).toBe("");
  });
});
