import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";

import userSettingsReducer from "../../../Redux/reducers/userSettingsReducer";
import { b64e } from "../../../e2ee/protocol";
import EncryptionSettings from "../EncryptionSettings";

const toast = vi.hoisted(() => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
const verify = vi.hoisted(() => ({ verifyKeyForModel: vi.fn() }));

vi.mock("../../../hooks/useToast", () => ({ useToast: () => toast }));
vi.mock("../../../e2ee/verify", () => ({
  verifyKeyForModel: verify.verifyKeyForModel,
}));
// The verification URL comes from the configured backend; the network call
// itself is mocked above.
vi.mock("../../../apis/openaiClient", () => ({
  resolveBaseURL: () => "http://localhost:8081",
}));

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
  verify.verifyKeyForModel.mockReset();
  verify.verifyKeyForModel.mockResolvedValue({ ok: true });
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
    // Every bound model is tested against the node before the key is stored.
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(2);
    expect(
      verify.verifyKeyForModel.mock.calls.map(([args]) => args.modelId),
    ).toEqual(["qwen-a", "mistral-b"]);
    expect(verify.verifyKeyForModel.mock.calls[0][0].url).toBe(
      "http://localhost:8081/chat/completions",
    );
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
    // Nothing to test the key against, so no request is made.
    expect(verify.verifyKeyForModel).not.toHaveBeenCalled();
  });

  it("keeps the key out when the node rejects it", async () => {
    verify.verifyKeyForModel.mockRejectedValue(
      new Error("Unknown key id for this node"),
    );
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
      target: { value: "Qwen A" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Unknown key id for this node/,
      );
    });
    expect(settings(store).e2ee_keys).toEqual([]);
    expect(settings(store).e2ee_models).toEqual({});
    expect(toast.notifySuccess).not.toHaveBeenCalled();
  });

  it("refuses a model list that matches no known model", async () => {
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
      target: { value: "nope-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/nope-model/);
    });
    expect(verify.verifyKeyForModel).not.toHaveBeenCalled();
    expect(settings(store).e2ee_keys).toEqual([]);
  });
});

describe("EncryptionSettings model status", () => {
  const renderWith = (store) =>
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks a bound model as encrypted and offers no per-model key picker", () => {
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k1", name: "Node A", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k1" },
    });

    renderWith(store);

    expect(screen.getByText("End-to-end encrypted")).toBeInTheDocument();
    // The key's label appears in the key list and in the model row.
    expect(screen.getAllByText("Node A").length).toBeGreaterThanOrEqual(2);
    // An unencrypted plain chat model is hidden.
    expect(screen.queryByText("Not encrypted")).toBeNull();
    // Bindings come from the key's "Applies to models" list; the table is
    // read-only, so there is no select to assign a key per model.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("marks a binding to an unusable key as blocked", () => {
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "bad", name: "Broken", publicKey: "not-a-key" },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "bad" },
    });

    renderWith(store);

    expect(screen.getByText("Key missing or invalid")).toBeInTheDocument();
    // A broken key encrypts nothing, so the model is not counted as encrypted.
    expect(screen.getByText("0 encrypted")).toBeInTheDocument();
  });

  it("does not repeat a key that is labelled with the model's own name", () => {
    const store = makeStore();
    // An import without an explicit name labels the key with the model names
    // it applies to, which used to print the row title twice.
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k2", name: "Qwen A", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k2" },
    });

    renderWith(store);

    const modelsSection = document.querySelector('[data-guide="e2ee-models"]');
    expect(within(modelsSection).getAllByText("Qwen A")).toHaveLength(1);
    // The key stays discoverable from the status badge.
    expect(screen.getByTitle(/Encrypted with/)).toBeInTheDocument();
  });

  it("still names a key that has its own label", () => {
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k3", name: "Node A", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k3" },
    });

    renderWith(store);

    const modelsSection = document.querySelector('[data-guide="e2ee-models"]');
    expect(within(modelsSection).getByText("Node A")).toBeInTheDocument();
  });

  it("lists an internal-service model and names the feature", () => {
    vi.stubEnv("VITE_MEMORY_GENERATION_MODEL", "mistral-b");
    const store = makeStore();

    renderWith(store);

    expect(screen.getByText("Mistral B")).toBeInTheDocument();
    expect(screen.getByText("Used for")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("Not encrypted")).toBeInTheDocument();
    // The plain chat model without a key stays out of the list.
    expect(screen.queryByText("Qwen A")).toBeNull();
  });

  it("shows an empty state when nothing is encrypted or used internally", () => {
    const store = makeStore();

    renderWith(store);

    expect(
      screen.getByText(/No model is encrypted yet or used by an internal feature/),
    ).toBeInTheDocument();
  });
});
