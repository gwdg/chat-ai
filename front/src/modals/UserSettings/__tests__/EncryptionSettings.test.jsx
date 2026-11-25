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
    // The import records the sealed test, so the key list can show it as green
    // instead of "not tested".
    expect(key.testedModels).toEqual(["qwen-a", "mistral-b"]);
    expect(key.testedAt).toEqual(expect.any(String));
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

  it("binds only the models whose test request succeeded", async () => {
    verify.verifyKeyForModel.mockImplementation(async ({ modelId }) => {
      if (modelId === "mistral-b") throw new Error("Unknown key id");
      return { ok: true };
    });
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
      target: { value: "Qwen A, Mistral B" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add key/ }));

    await waitFor(() => {
      expect(settings(store).e2ee_keys).toHaveLength(1);
    });

    const key = settings(store).e2ee_keys[0];
    // The working model is bound, the failing one is left unencrypted instead
    // of being bound to a key the node does not know.
    expect(settings(store).e2ee_models).toEqual({ "qwen-a": key.id });
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(2);
    expect(toast.notifyError).toHaveBeenCalledTimes(1);
    expect(toast.notifyError.mock.calls[0][0]).toContain("Mistral B");
    expect(toast.notifyError.mock.calls[0][0]).toContain("Unknown key id");
    expect(toast.notifySuccess).not.toHaveBeenCalled();
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

  it("counts encrypted models and keeps them out of the unencrypted list", () => {
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

    expect(screen.getByText("1 encrypted")).toBeInTheDocument();
    // Only unencrypted function models are listed, so the encrypted chat model
    // has no row and the section reports that nothing is missing.
    expect(
      screen.getByText(/No model used by an internal feature is missing a key/),
    ).toBeInTheDocument();
    // Bindings come from the key's "Applies to models" list; there is no
    // per-model key picker.
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("counts a binding for a model this deployment does not list", () => {
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k5", name: "Node A", publicKey },
    });
    // A plain id while the deployment lists only the bridged copy: the model is
    // still encrypted, so the header must not say "0 encrypted".
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: {
        modelId: "deepseek-v4.1-flash-1017",
        keyId: "k5",
      },
    });

    renderWith(store);

    expect(screen.getByText("1 encrypted")).toBeInTheDocument();
    expect(screen.queryByText("Not encrypted")).toBeNull();
  });

  it("lists a model an internal feature uses without a key", () => {
    vi.stubEnv("VITE_MEMORY_GENERATION_MODEL", "mistral-b");
    const store = makeStore();

    renderWith(store);

    expect(screen.getByText("Mistral B")).toBeInTheDocument();
    expect(screen.getByText("Used for")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("Not encrypted")).toBeInTheDocument();
    // A chat model without a key is not a function model, so it stays out.
    expect(screen.queryByText("Qwen A")).toBeNull();
  });

  it("keeps a feature model visible when the deployment does not offer it", () => {
    // The vision model of the browser agent: configured (or the built-in
    // fallback), but this model list does not contain it. It must not vanish
    // from the table, because then nothing would show that its requests are
    // unprotected.
    vi.stubEnv("VITE_MODULE_AGENT", "true");
    vi.stubEnv("VITE_EXPLAIN_IMAGE_MODEL", "gemma-4-31b-it");

    renderWith(makeStore());

    expect(screen.getByText("gemma-4-31b-it")).toBeInTheDocument();
    expect(screen.getByText("Image analysis")).toBeInTheDocument();
    expect(screen.getByText("Not in model list")).toBeInTheDocument();
    expect(screen.queryByText("Not encrypted")).toBeNull();
  });

  it("marks a listed feature model as unencrypted instead", () => {
    // The same function with the model in the list: the row is the normal
    // unencrypted one and carries no "not in model list" badge.
    vi.stubEnv("VITE_MODULE_AGENT", "true");
    vi.stubEnv("VITE_EXPLAIN_IMAGE_MODEL", "mistral-b");

    renderWith(makeStore());

    expect(screen.getByText("Mistral B")).toBeInTheDocument();
    expect(screen.getByText("Image analysis")).toBeInTheDocument();
    expect(screen.getByText("Not encrypted")).toBeInTheDocument();
    expect(screen.queryByText("Not in model list")).toBeNull();
  });

  it("hides an internal model once its key works", () => {
    vi.stubEnv("VITE_MEMORY_GENERATION_MODEL", "mistral-b");
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "k1", name: "Node A", publicKey },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "mistral-b", keyId: "k1" },
    });

    renderWith(store);

    expect(screen.queryByText("Mistral B")).toBeNull();
    expect(screen.getByText("1 encrypted")).toBeInTheDocument();
  });

  it("marks an internal model whose key is unusable as blocked", () => {
    vi.stubEnv("VITE_MEMORY_GENERATION_MODEL", "mistral-b");
    const store = makeStore();
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id: "bad", name: "Broken", publicKey: "not-a-key" },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "mistral-b", keyId: "bad" },
    });

    renderWith(store);

    expect(screen.getByText("Key missing or invalid")).toBeInTheDocument();
    // A broken key encrypts nothing, so the model counts as unencrypted.
    expect(screen.getByText("0 encrypted")).toBeInTheDocument();
  });

  it("puts the add-key controls above the unencrypted list and the keys below it", () => {
    renderWith(makeStore());

    const order = [...document.querySelectorAll("[data-guide^='e2ee-']")]
      .map((element) => element.getAttribute("data-guide"))
      // The published-key loader is part of the add-key section.
      .filter((id) => id !== "e2ee-published");
    expect(order).toEqual(["e2ee-add", "e2ee-models", "e2ee-keys"]);
  });

  it("removes every key and binding after confirmation", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Remove all keys" }));
    expect(
      screen.getByText("Remove every key and model binding?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove all keys" }));

    expect(settings(store).e2ee_keys).toEqual([]);
    expect(settings(store).e2ee_models).toEqual({});
    expect(toast.notifySuccess).toHaveBeenCalled();
  });

  it("shows an empty state when no unencrypted function model exists", () => {
    renderWith(makeStore());

    expect(
      screen.getByText(/No model used by an internal feature is missing a key/),
    ).toBeInTheDocument();
  });
});

describe("EncryptionSettings key test", () => {
  const renderWith = (store) =>
    render(
      <Provider store={store}>
        <EncryptionSettings modelsData={modelsData} />
      </Provider>,
    );

  const seedKey = (store, id = "k1", name = "Node A", key = publicKey) =>
    store.dispatch({
      type: "user_settings/addE2eeKey",
      payload: { id, name, publicKey: key },
    });

  it("re-tests a bound key and marks it green", async () => {
    const store = makeStore();
    seedKey(store);
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k1" },
    });

    renderWith(store);

    // A key restored from a backup has no test record, so it starts untested
    // even though it parses.
    expect(screen.getByText("Not tested")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(screen.getByText("Works")).toBeInTheDocument();
    });
    expect(verify.verifyKeyForModel).toHaveBeenCalledTimes(1);
    expect(verify.verifyKeyForModel.mock.calls[0][0].modelId).toBe("qwen-a");
    expect(settings(store).e2ee_keys[0].testedModels).toEqual(["qwen-a"]);
    expect(settings(store).e2ee_keys[0].testedAt).toEqual(expect.any(String));
    expect(toast.notifySuccess).toHaveBeenCalled();
  });

  it("marks a key red when its test request fails", async () => {
    verify.verifyKeyForModel.mockRejectedValue(
      new Error("This request was sealed for a different model key."),
    );
    const store = makeStore();
    seedKey(store);
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k1" },
    });

    renderWith(store);

    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(screen.getByText("Test failed")).toBeInTheDocument();
    });
    expect(settings(store).e2ee_keys[0].testedAt).toEqual(expect.any(String));
    expect(settings(store).e2ee_keys[0].testedModels).toEqual([]);
    expect(toast.notifyError).toHaveBeenCalledTimes(1);
    expect(toast.notifyError.mock.calls[0][0]).toContain(
      "sealed for a different model key",
    );
    expect(toast.notifySuccess).not.toHaveBeenCalled();
  });

  it("does not test a key that is bound to no model", () => {
    const store = makeStore();
    seedKey(store);

    renderWith(store);

    const button = screen.getByRole("button", { name: "Test" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Bind this key to a model before testing it",
    );
  });

  it("tests every key from the section header", async () => {
    const store = makeStore();
    seedKey(store);
    seedKey(
      store,
      "k2",
      "Node B",
      b64e(x25519.getPublicKey(x25519.utils.randomSecretKey())),
    );
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "qwen-a", keyId: "k1" },
    });
    store.dispatch({
      type: "user_settings/setE2eeModelKey",
      payload: { modelId: "mistral-b", keyId: "k2" },
    });

    renderWith(store);

    fireEvent.click(screen.getByRole("button", { name: "Test all" }));

    await waitFor(() => {
      expect(toast.notifySuccess).toHaveBeenCalledWith(
        "2 of 2 tested keys work.",
      );
    });
    expect(settings(store).e2ee_keys.map((key) => key.testedModels)).toEqual([
      ["qwen-a"],
      ["mistral-b"],
    ]);
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
        // Mirrors a real FileSystemFileHandle: getFile(), no text().
        yield {
          kind: "file",
          name: "qwen-a.pub",
          getFile: async () => ({ text: async () => `${key}\n` }),
        };
        yield {
          kind: "file",
          name: "notes.txt",
          getFile: async () => ({ text: async () => key }),
        };
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
          getFile: async () => ({ text: async () => key }),
        };
        yield {
          kind: "file",
          name: "broken.pub",
          getFile: async () => ({ text: async () => "not a key" }),
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
