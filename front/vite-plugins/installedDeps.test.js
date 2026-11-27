import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertInstalledDependencies,
  missingPackages,
  requiredPackagePaths,
} from "./installedDeps.js";

const lock = {
  packages: {
    "": { name: "front" },
    "node_modules/present": { version: "1.0.0" },
    "node_modules/@scope/missing": { version: "2.0.0" },
    "node_modules/present/node_modules/nested": { version: "1.1.0" },
    "node_modules/platform-only": { version: "3.0.0", optional: true },
    "node_modules/linked": { link: true },
  },
};

const scratch = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "chat-ai-deps-"));
  for (const rel of files) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{}");
  }
  return root;
};

describe("installed dependencies", () => {
  it("asks for every non-optional package path in the lockfile", () => {
    expect(requiredPackagePaths(lock)).toEqual([
      "node_modules/present",
      "node_modules/@scope/missing",
      "node_modules/present/node_modules/nested",
    ]);
  });

  it("reports only packages that are really missing", () => {
    const root = scratch([
      "node_modules/present/package.json",
      "node_modules/present/node_modules/nested/package.json",
    ]);
    expect(missingPackages(lock, root)).toEqual(["node_modules/@scope/missing"]);
  });

  it("ignores a platform-optional package that npm pruned", () => {
    const root = scratch([
      "node_modules/present/package.json",
      "node_modules/present/node_modules/nested/package.json",
      "node_modules/@scope/missing/package.json",
    ]);
    expect(missingPackages(lock, root)).toEqual([]);
  });

  it("fails the build with the missing names and the way out", () => {
    const root = scratch([
      "package-lock.json",
      "node_modules/present/package.json",
    ]);
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock));
    expect(() => assertInstalledDependencies(root)).toThrow(
      /@scope\/missing[\s\S]*npm ci/,
    );
  });

  it("passes when the tree matches the lockfile", () => {
    const root = scratch([
      "package-lock.json",
      "node_modules/present/package.json",
      "node_modules/present/node_modules/nested/package.json",
      "node_modules/@scope/missing/package.json",
    ]);
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock));
    expect(assertInstalledDependencies(root)).toBe(3);
  });
});
