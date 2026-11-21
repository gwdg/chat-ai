import { describe, expect, it } from "vitest";

import { mergeSettings } from "../namespaces/settingsMerge";

/**
 * The merge is per key against the last agreed payload: a key changed on one
 * side follows that side, a key changed on both keeps the local value and is
 * reported, and an array of records additionally merges by element id.
 */
describe("mergeSettings", () => {
  it("takes the remote value of a key only the remote changed", () => {
    const result = mergeSettings(
      { advanced_mode: false, timeout: 300000 },
      { advanced_mode: false, timeout: 300000 },
      { advanced_mode: true, timeout: 300000 },
    );
    expect(result.payload.advanced_mode).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it("keeps the local value of a key only the local changed", () => {
    const result = mergeSettings(
      { html_render_mode: "off" },
      { html_render_mode: "always" },
      { html_render_mode: "off" },
    );
    expect(result.payload.html_render_mode).toBe("always");
    expect(result.conflicts).toEqual([]);
  });

  it("keeps the local value and reports a key changed on both sides", () => {
    const result = mergeSettings(
      { html_render_mode: "off" },
      { html_render_mode: "always" },
      { html_render_mode: "never" },
    );
    expect(result.payload.html_render_mode).toBe("always");
    expect(result.conflicts).toContain("html_render_mode");
  });

  it("drops a key deleted locally and untouched remotely", () => {
    const result = mergeSettings(
      { show_timestamps: true, advanced_mode: false },
      { advanced_mode: false },
      { show_timestamps: true, advanced_mode: false },
    );
    expect("show_timestamps" in result.payload).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  it("restores a key deleted locally but changed on the remote", () => {
    const result = mergeSettings(
      { show_timestamps: true },
      {},
      { show_timestamps: false },
    );
    expect(result.payload.show_timestamps).toBe(false);
    expect(result.conflicts).toContain("show_timestamps");
  });

  it("keeps a key removed remotely but changed here", () => {
    const result = mergeSettings(
      { show_timestamps: true },
      { show_timestamps: false },
      {},
    );
    expect(result.payload.show_timestamps).toBe(false);
    expect(result.conflicts).toContain("show_timestamps");
  });

  it("unions memories added independently on both devices", () => {
    const result = mergeSettings(
      { memories: [] },
      { memories: [{ id: "m1", text: "local", createdAt: 1 }] },
      { memories: [{ id: "m2", text: "remote", createdAt: 2 }] },
    );
    expect(result.payload.memories.map((memory) => memory.id)).toEqual(["m1", "m2"]);
    expect(result.conflicts).toEqual([]);
  });

  it("follows the side that changed a memory and reports a clash", () => {
    const base = {
      memories: [{ id: "m1", text: "base" }],
    };
    const remoteChange = mergeSettings(base, base, {
      memories: [{ id: "m1", text: "remote" }],
    });
    expect(remoteChange.payload.memories).toEqual([{ id: "m1", text: "remote" }]);
    expect(remoteChange.conflicts).toEqual([]);

    const clash = mergeSettings(base, { memories: [{ id: "m1", text: "local" }] }, {
      memories: [{ id: "m1", text: "remote" }],
    });
    expect(clash.payload.memories).toEqual([{ id: "m1", text: "local" }]);
    expect(clash.conflicts).toContain("memories.m1");
  });

  it("honours a deletion on one side until the other side changes the record", () => {
    const base = {
      memory_groups: [
        { id: "g1", name: "Work" },
        { id: "g2", name: "Home" },
      ],
    };
    const localDeleted = mergeSettings(
      base,
      { memory_groups: [{ id: "g1", name: "Work" }] },
      base,
    );
    expect(localDeleted.payload.memory_groups).toEqual([{ id: "g1", name: "Work" }]);

    const remoteDeletedLocallyChanged = mergeSettings(
      base,
      { memory_groups: [{ id: "g2", name: "House" }] },
      { memory_groups: [] },
    );
    expect(remoteDeletedLocallyChanged.payload.memory_groups).toEqual([
      { id: "g2", name: "House" },
    ]);
    expect(remoteDeletedLocallyChanged.conflicts).toContain("memory_groups.g2");
  });

  it("merges the e2ee_models map by key", () => {
    const result = mergeSettings(
      { e2ee_models: {} },
      { e2ee_models: { "model-a": "key-1", "model-b": "key-1" } },
      { e2ee_models: { "model-c": "key-2", "model-b": "key-2" } },
    );
    expect(result.payload.e2ee_models).toEqual({
      "model-a": "key-1",
      "model-b": "key-1",
      "model-c": "key-2",
    });
    expect(result.conflicts).toContain("e2ee_models.model-b");
  });

  it("survives a missing base on first contact between two archives", () => {
    const result = mergeSettings(undefined, { advanced_mode: true }, {
      advanced_mode: false,
      html_render_mode: "always",
    });
    expect(result.payload.advanced_mode).toBe(true);
    expect(result.payload.html_render_mode).toBe("always");
    expect(result.conflicts).toContain("advanced_mode");
  });
});
