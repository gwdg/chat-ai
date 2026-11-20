import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateModelsData } from "../useUpdateModelsData";

const api = vi.hoisted(() => ({
  getModelsData: vi.fn(),
  notifyError: vi.fn(),
  openModal: vi.fn(),
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

beforeEach(() => {
  api.getModelsData.mockReset();
  api.notifyError.mockReset();
  api.openModal.mockReset();
});

describe("useUpdateModelsData", () => {
  it("keeps the chat models and drops the engine's services", async () => {
    // `/v1/models` lists a service for every user granted its access group, so
    // `saia-agent` and `saia-fs` arrive in the same list as the chat models.
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

  it("reports a list that holds nothing but services", async () => {
    api.getModelsData.mockResolvedValue([{ id: "saia-fs" }]);

    renderHook(() => useUpdateModelsData());

    await waitFor(() =>
      expect(api.notifyError).toHaveBeenCalledWith(
        "No models available or network error",
      ),
    );
  });
});
