import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateModelsData } from "../useUpdateModelsData";

const api = vi.hoisted(() => ({
  getModelsData: vi.fn(),
  notifyError: vi.fn(),
  openModal: vi.fn(),
  brand: { value: null },
  defaultModel: { value: null },
  dispatch: vi.fn(),
  setDefaultModel: vi.fn((payload) => ({ type: "user_settings/setDefaultModel", payload })),
}));

vi.mock("../../apis/getModelsData", () => ({
  getModelsData: (...args) => api.getModelsData(...args),
}));
vi.mock("../useToast", () => ({
  useToast: () => ({ notifyError: api.notifyError }),
}));
vi.mock("../../modals/ModalContext", () => ({
  useModal: () => ({ openModal: api.openModal }),
}));
vi.mock("../../config/BrandProvider", () => ({
  useBrand: () => ({ brand: api.brand.value }),
}));
// The hook reads and heals the persisted default model; the other cases here
// render without a Provider, so the two selectors are answered directly.
vi.mock("react-redux", () => ({
  useDispatch: () => api.dispatch,
  useSelector: (selector) => selector({ user_settings: { model: api.defaultModel.value } }),
}));
vi.mock("../../Redux/reducers/userSettingsReducer", () => ({
  selectDefaultModel: (state) => state.user_settings.model,
  setDefaultModel: (payload) => api.setDefaultModel(payload),
}));

beforeEach(() => {
  api.getModelsData.mockReset();
  api.notifyError.mockReset();
  api.openModal.mockReset();
  api.dispatch.mockReset();
  api.setDefaultModel.mockReset();
  api.brand.value = null;
  api.defaultModel.value = null;
});

describe("useUpdateModelsData", () => {
  it("keeps the chat models and drops only the filesystem service", async () => {
    // `saia-agent` answers `/chat/completions`, so it belongs in the selector;
    // `saia-fs` is an MCP server and never does.
    api.getModelsData.mockResolvedValue([
      { id: "qwen3.8-27b" },
      { id: "saia-agent" },
      { id: "llama-4" },
      { id: "saia-fs" },
    ]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(result.current.map((model) => model.id)).toEqual([
        "qwen3.8-27b",
        "saia-agent",
        "llama-4",
      ]),
    );
    expect(api.notifyError).not.toHaveBeenCalled();
  });

  it("keeps a model whose id merely starts like a service", async () => {
    api.getModelsData.mockResolvedValue([{ id: "saia-agent-preview" }]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(result.current.map((model) => model.id)).toEqual([
        "saia-agent-preview",
      ]),
    );
  });

  it("reports a list that holds nothing but the filesystem service", async () => {
    api.getModelsData.mockResolvedValue([{ id: "saia-fs" }]);

    renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(api.notifyError).toHaveBeenCalledWith(
        "No models available or network error",
      ),
    );
  });

  it("narrows the selector to a model the brand fixes", async () => {
    api.brand.value = { restrictions: { models: { fixed: "llama-4" } } };
    api.getModelsData.mockResolvedValue([
      { id: "qwen3.8-27b" },
      { id: "llama-4" },
    ]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(result.current.map((model) => model.id)).toEqual(["llama-4"]),
    );
  });

  it("drops models the brand treats as external", async () => {
    api.brand.value = {
      restrictions: { external: { external_models: false } },
    };
    api.getModelsData.mockResolvedValue([
      { id: "local-1" },
      { id: "gpt-external", name: "GPT (External)" },
      { id: "vendor-2", external: true },
    ]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(result.current.map((model) => model.id)).toEqual(["local-1"]),
    );
  });

  it("refreshes the stored default model when the deployment corrects it", async () => {
    // The default model was picked while the bridge still copied "(External)"
    // into an in-house model's name; `/models` now answers the same id without
    // the marker and with `external: false`.
    api.defaultModel.value = {
      id: "bridge/deepseek-v4.1-flash-1017",
      name: "DeepSeek V4.1 Flash 1017 (External)",
    };
    api.getModelsData.mockResolvedValue([
      {
        id: "bridge/deepseek-v4.1-flash-1017",
        name: "DeepSeek V4.1 Flash 1017",
        external: false,
      },
    ]);

    renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(api.setDefaultModel).toHaveBeenCalledWith({
        id: "bridge/deepseek-v4.1-flash-1017",
        name: "DeepSeek V4.1 Flash 1017",
        external: false,
      }),
    );
    expect(api.dispatch).toHaveBeenCalledWith({
      type: "user_settings/setDefaultModel",
      payload: {
        id: "bridge/deepseek-v4.1-flash-1017",
        name: "DeepSeek V4.1 Flash 1017",
        external: false,
      },
    });
  });

  it("leaves a default model that already matches alone", async () => {
    // A rewrite would autosave (and re-persist) on every 30 s refresh.
    api.defaultModel.value = {
      id: "llama-4",
      name: "Llama 4",
      external: false,
    };
    api.getModelsData.mockResolvedValue([
      { id: "llama-4", name: "Llama 4", external: false },
    ]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() => expect(result.current.map((model) => model.id)).toEqual(["llama-4"]));
    expect(api.setDefaultModel).not.toHaveBeenCalled();
  });

  it("does not invent a label for a default model the deployment does not list", async () => {
    // An imported profile can name a model this deployment does not serve; there
    // is nothing truthful to replace the snapshot with.
    api.defaultModel.value = { id: "gone", name: "Gone (External)" };
    api.getModelsData.mockResolvedValue([{ id: "llama-4", external: false }]);

    const { result } = renderHook(() => useUpdateModelsData());

    await waitFor(() => expect(result.current.map((model) => model.id)).toEqual(["llama-4"]));
    expect(api.setDefaultModel).not.toHaveBeenCalled();
  });

  it("drops a stored `external` the deployment no longer sends", async () => {
    // This deployment expresses externality only in the name, so a stored
    // `external: true` has to go: `isExternalModel` gives the field precedence
    // over the name, and the row itself now uses a clean name.
    api.defaultModel.value = {
      id: "bridge/deepseek-v4.1-flash-1017",
      name: "DeepSeek V4.1 Flash 1017 (External)",
      external: true,
    };
    api.getModelsData.mockResolvedValue([
      { id: "bridge/deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017" },
    ]);

    renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(api.setDefaultModel).toHaveBeenCalledWith({
        id: "bridge/deepseek-v4.1-flash-1017",
        name: "DeepSeek V4.1 Flash 1017",
      }),
    );
    expect(api.setDefaultModel.mock.calls.at(-1)[0]).not.toHaveProperty("external");
  });
});
