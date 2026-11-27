import { describe, expect, it } from "vitest";
import { isExternalModel } from "../modelExternality";

describe("isExternalModel", () => {
  it("reads the engine's data field", () => {
    expect(isExternalModel({ id: "bridge/x", name: "X", external: true })).toBe(true);
    expect(isExternalModel({ id: "x", name: "X", external: false })).toBe(false);
  });

  it("falls back to the name marker when the deployment does not report the field", () => {
    // An older engine and a plain OpenAI-compatible endpoint have no `external`.
    expect(isExternalModel({ id: "bridge/x", name: "X (External)" })).toBe(true);
    expect(isExternalModel({ id: "bridge/x", name: "X (external)" })).toBe(true);
    expect(isExternalModel({ id: "x", name: "X" })).toBe(false);
    expect(isExternalModel({ id: "x" })).toBe(false);
    expect(isExternalModel(undefined)).toBe(false);
  });

  it("lets the data field override a stale name marker", () => {
    // The engine answers false only for a model that is external by neither the marker nor
    // a bridge prefix, so an administrator who cleaned the display name is not re-marked.
    expect(isExternalModel({ id: "x", name: "X (External)", external: false })).toBe(false);
    // And a row that is external without the marker (a bridge row) is marked.
    expect(isExternalModel({ id: "bridge/x", name: "X", external: true })).toBe(true);
  });

  it("ignores non-object input", () => {
    expect(isExternalModel(null)).toBe(false);
    expect(isExternalModel("bridge/x (External)")).toBe(false);
  });
});
