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

// The published-key loader is the default tab; the manual import lives one tab
// to the right.
const openPasteTab = () =>
  fireEvent.click(screen.getByRole("button", { name: "Paste or file" }));

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

    openPasteTab();
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

    openPasteTab();
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

    openPasteTab();
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

    openPasteTab();
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

    openPasteTab();
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

describe("EncryptionSettings published keys", () => {
  const freshKey = () =>
    b64e(x25519.getPublicKey(x25519.utils.randomSecretKey()));
  const answered = (body) => ({
    ok: true,
    status: 200,
    text: async () => body,
  });
  const notFound = { ok: false, status: 404, text: async () => "" };

  const renderSettings = (store) =>
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("opens on the published keys with the configured base URL", () => {
    renderSettings(makeStore());

    expect(screen.getByLabelText("Key base URL")).toHaveValue(
      "https://docs.ai.gwdg.de/technical/saia-platform/keys/",
    );
    expect(
      screen.getByRole("button", { name: /Load keys for all models/ }),
    ).toBeInTheDocument();
  });

  it("imports and binds every published key, treating a 404 as no key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        String(url) === "https://keys.example/qwen-a.pub"
          ? answered(freshKey())
          : notFound,
      ),
    );
    const store = makeStore();
    renderSettings(store);

    fireEvent.change(screen.getByLabelText("Key base URL"), {
      target: { value: "https://keys.example" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Load keys for all models/ }),
    );

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    const key = settings(store).e2ee_keys[0];
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": key.id });
    // Only the published model is verified; the 404 for the other is not.
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(1);
    expect(verify.verifyKeyForModel.mock.calls[0][0]).toMatchObject({
      modelId: "qwen-a",
      url: "http://localhost:8081/chat/completions",
    });
    expect(toast.notifySuccess).toHaveBeenCalled();
    expect(screen.getByText(/1 imported/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 without a published key/),
    ).toBeInTheDocument();
  });

  it("keeps a model out when its key does not verify, but imports the rest", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answered(freshKey())));
    verify.verifyKeyForModel.mockImplementation(async ({ modelId }) => {
      if (modelId === "mistral-b") throw new Error("Unknown key id");
      return { ok: true };
    });
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(
      screen.getByRole("button", { name: /Load keys for all models/ }),
    );

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    expect(Object.keys(settings(store).e2ee_models)).toEqual(["qwen-a"]);
    expect(screen.getByText(/Not imported:/)).toBeInTheDocument();
    expect(document.body.textContent).toContain("Unknown key id");
    expect(document.body.textContent).toContain("Mistral B");
  });

  it("opens the directory tab on the manifest URL and imports it", async () => {
    const document = {
      keys: [
        {
          id: "key-1",
          name: "Node",
          publicKey: freshKey(),
          models: ["qwen-a"],
        },
      ],
      models: { "qwen-a": "key-1" },
    };
    const fetchImpl = vi.fn(async () => answered(JSON.stringify(document)));
    vi.stubGlobal("fetch", fetchImpl);
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(screen.getByRole("button", { name: "Key directory" }));
    const input = screen.getByLabelText("Directory URL");
    expect(input).toHaveValue(
      "https://docs.ai.gwdg.de/technical/saia-platform/keys/keys.json",
    );

    fireEvent.click(screen.getByRole("button", { name: "Import directory" }));

    await waitFor(() => {
      expect(toast.notifySuccess).toHaveBeenCalled();
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://docs.ai.gwdg.de/technical/saia-platform/keys/keys.json",
    );
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(1);
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": "key-1" });
    expect(settings(store).e2ee_keys.map((key) => key.id)).toEqual(["key-1"]);
  });

  it("imports the .pub files of a chosen folder and binds them by file name", async () => {
    const key = freshKey();
    const handle = {
      values: async function* values() {
        yield {
          kind: "file",
          name: "qwen-a.pub",
          text: async () => `${key}\n`,
        };
        yield { kind: "file", name: "notes.txt", text: async () => key };
      },
    };
    const picker = vi.fn(async () => handle);
    vi.stubGlobal("showDirectoryPicker", picker);
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(screen.getByRole("button", { name: "Key directory" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Choose key folder/ }),
    );

    await waitFor(() => {
      expect(toast.notifySuccess).toHaveBeenCalled();
    });
    expect(picker).toHaveBeenCalledWith({ mode: "read" });

    const keys = settings(store).e2ee_keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({
      publicKey: key,
      name: "Qwen A",
      source: "folder",
    });
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": keys[0].id });
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(1);
    expect(verify.verifyKeyForModel).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "qwen-a" }),
    );
    // notes.txt is not a .pub file, so it is neither imported nor reported.
    expect(toast.notifyError).not.toHaveBeenCalled();
  });

  it("skips and reports a .pub file that is not a valid key", async () => {
    const key = freshKey();
    const handle = {
      values: async function* values() {
        yield {
          kind: "file",
          name: "qwen-a.pub",
          text: async () => key,
        };
        yield {
          kind: "file",
          name: "broken.pub",
          text: async () => "not a key",
        };
      },
    };
    vi.stubGlobal("showDirectoryPicker", vi.fn(async () => handle));
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(screen.getByRole("button", { name: "Key directory" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Choose key folder/ }),
    );

    await waitFor(() => {
      expect(toast.notifyError).toHaveBeenCalled();
    });

    // The valid file still imports; the broken one is named in the message.
    const keys = settings(store).e2ee_keys;
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ publicKey: key, source: "folder" });
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": keys[0].id });
    expect(toast.notifyError).toHaveBeenCalledWith(
      expect.stringContaining("broken.pub"),
      8000,
    );
    expect(toast.notifySuccess).not.toHaveBeenCalled();
  });

  it("explains when the browser cannot open a folder", async () => {
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(screen.getByRole("button", { name: "Key directory" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Choose key folder/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /cannot open a folder/,
      );
    });
    expect(settings(store).e2ee_keys).toEqual([]);
  });

  it("reports a directory that publishes no usable key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => notFound));
    const store = makeStore();
    renderSettings(store);

    fireEvent.click(
      screen.getByRole("button", { name: /Load keys for all models/ }),
    );

    await waitFor(() => {
      expect(toast.notifyError).toHaveBeenCalled();
    });

    expect(settings(store).e2ee_keys).toEqual([]);
    expect(screen.getByText(/0 imported/)).toBeInTheDocument();
    expect(
      screen.getByText(/2 without a published key/),
    ).toBeInTheDocument();
  });

  it("does not re-download a model that already has a usable key", async () => {
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k1", name: "Node", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k1" },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "mistral-b", keyId: "k1" },
    });
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    renderSettings(store);

    fireEvent.click(
      screen.getByRole("button", { name: /Load keys for all models/ }),
    );

    await waitFor(() => {
      expect(toast.notifySuccess).toHaveBeenCalled();
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(settings(store).e2ee_keys).toHaveLength(1);
  });
});
