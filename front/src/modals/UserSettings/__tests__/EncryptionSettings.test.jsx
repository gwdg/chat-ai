import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import { b64e } from "../../../e2ee/protocol";
import EncryptionSettings from "../EncryptionSettings";

const toast = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../../hooks/useToast", () => ({ useToast: () => toast }));

const publicKey = b64e(x25519.getPublicKey(x25519.utils.randomSecretKey()));
const modelsData = [
  { id: "qwen-a", name: "Qwen A" },
  { id: "mistral-b", name: "Mistral B" },
];

const makeStore = () =>
  configureStore({ reducer: { user_settings: userSettingsReducer } });

const settings = (store) => store.getState().user_settings;

beforeEach(() => {
  toast.notifySuccess.mockReset();
  toast.notifyError.mockReset();
});

describe("EncryptionSettings key import", () => {
  it("binds the imported key to the models typed by id or name", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText("Public key"), {
      target: { value: publicKey },
    });
    fireEvent.change(screen.getByLabelText(/Applies to models/), {
      target: { value: "Qwen A, mistral-b" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    const key = settings(store).e2ee_keys[0];
    // The key label comes from the models it applies to.
    expect(key.name).toBe("Qwen A, Mistral B");
    expect(settings(store).e2ee_models).toEqual({
      "qwen-a": key.id,
      "mistral-b": key.id,
    });
    expect(toast.notifySuccess).toHaveBeenCalled();
  });

  it("still adds the key but reports unknown models", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText("Public key"), {
      target: { value: publicKey },
    });
    fireEvent.change(screen.getByLabelText(/Applies to models/), {
      target: { value: "Qwen A, nope-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    const key = settings(store).e2ee_keys[0];
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": key.id });
    expect(toast.notifySuccess).not.toHaveBeenCalled();
    expect(toast.notifyError).toHaveBeenCalledTimes(1);
    expect(toast.notifyError.mock.calls[0][0]).toContain("nope-model");
  });

  it("falls back to a fingerprint name when no model is given", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText("Public key"), {
      target: { value: publicKey },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    expect(settings(store).e2ee_keys[0].name).toMatch(/^Key /);
    expect(settings(store).e2ee_models).toEqual({});
  });
});
