import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateModelsData } from "../useUpdateModelsData";

const api = vi.hoisted(() => ({
  getModelsData: vi.fn(),
  notifyError: vi.fn(),
  openModal: vi.fn(),
  brand: { value: null },
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

beforeEach(() => {
  api.getModelsData.mockReset();
  api.notifyError.mockReset();
  api.openModal.mockReset();
  api.brand.value = null;
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
});
