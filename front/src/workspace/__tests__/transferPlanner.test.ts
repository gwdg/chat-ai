import { describe, expect, it } from "vitest";
import { planTransfer } from "../transferPlanner";

const capabilities = {
  read: true,
  write: true,
  delete: true,
  mkdir: true,
  rename: true,
  move: true,
  copy: true,
  serverSideMove: false,
  serverSideCopy: false,
  quota: false,
  watch: false,
  range: true,
};

const readOnly = {
  ...capabilities,
  write: false,
  delete: false,
  mkdir: false,
  rename: false,
  move: false,
  copy: false,
};

const entry = {
  sourceId: "a",
  path: "/notes.txt",
  name: "notes.txt",
  kind: "file",
  size: 120,
};

const base = {
  intent: "auto" as const,
  sameSource: false,
  sourceKind: "browser",
  targetKind: "browser",
  entries: [entry],
  sourcePath: "/notes.txt",
  targetPath: "/docs/notes.txt",
  sourceCapabilities: capabilities,
  targetCapabilities: capabilities,
  freeBytes: 1000,
  existingNames: new Set<string>(),
};

describe("planTransfer", () => {
  it("moves within one source without confirmation", () => {
    const plan = planTransfer({ ...base, sameSource: true });
    expect(plan.strategy).toBe("move");
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.requiresDelete).toBe(true);
  });

  it("moves across sources by default", () => {
    const plan = planTransfer({ ...base });
    expect(plan.strategy).toBe("move");
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("copies only with an explicit copy intent", () => {
    const plan = planTransfer({ ...base, intent: "copy" });
    expect(plan.strategy).toBe("copy");
    expect(plan.requiresDelete).toBe(false);
  });

  it("always confirms an explicit move", () => {
    const plan = planTransfer({ ...base, intent: "move" });
    expect(plan.strategy).toBe("move");
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("blocks read-only targets and folders moved into themselves", () => {
    expect(
      planTransfer({ ...base, targetCapabilities: readOnly }).blocked,
    ).toBe(true);
    expect(
      planTransfer({
        ...base,
        sourcePath: "/docs",
        targetPath: "/docs/sub",
      }).blocked,
    ).toBe(true);
  });

  it("warns about conflicts and missing space", () => {
    const conflicts = planTransfer({
      ...base,
      existingNames: new Set(["notes.txt"]),
    });
    expect(conflicts.requiresConfirmation).toBe(true);
    expect(conflicts.warnings.length).toBe(1);

    const space = planTransfer({ ...base, freeBytes: 10 });
    expect(space.blocked).toBe(true);
  });
});
