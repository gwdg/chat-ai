import { describe, expect, it } from "vitest";
import { enableStorageAccess, migrateLegacyToolKeys } from "../index";

describe("migrateLegacyToolKeys", () => {
  it("renames arcana_v2 to arcana_tools", () => {
    const settings = { tools: { arcana_v2: true, browser_storage: true } };
    expect(migrateLegacyToolKeys(settings).tools).toEqual({
      arcana_tools: true,
      browser_storage: true,
    });
  });

  it("renames remote_file_access to arcana_tools", () => {
    const settings = { tools: { remote_file_access: true } };
    expect(migrateLegacyToolKeys(settings).tools).toEqual({ arcana_tools: true });
  });

  it("keeps an explicit arcana_tools value over a legacy one", () => {
    const settings = { tools: { arcana_tools: false, arcana_v2: true } };
    expect(migrateLegacyToolKeys(settings).tools).toEqual({ arcana_tools: false });
  });

  it("leaves settings without a tools object alone", () => {
    expect(migrateLegacyToolKeys(undefined)).toBeUndefined();
    expect(migrateLegacyToolKeys({ temperature: 0.5 })).toEqual({
      temperature: 0.5,
    });
    const withArray = { tools: ["arcana_v2"] };
    expect(migrateLegacyToolKeys(withArray)).toEqual(withArray);
  });
});

describe("enableStorageAccess", () => {
  it("turns the old opt-in default into the new default", () => {
    const settings = { tools: { browser_storage: false } };
    expect(enableStorageAccess(settings).tools.browser_storage).toBe(true);
  });

  it("adds the switch when it was never stored", () => {
    const settings = { tools: { codemode: true } };
    expect(enableStorageAccess(settings).tools).toEqual({
      codemode: true,
      browser_storage: true,
    });
  });

  it("keeps an explicit true", () => {
    const settings = { tools: { browser_storage: true } };
    expect(enableStorageAccess(settings).tools.browser_storage).toBe(true);
  });

  it("leaves settings without a usable tools object alone", () => {
    expect(enableStorageAccess(undefined)).toBeUndefined();
    const withoutTools = { temperature: 0.5 };
    expect(enableStorageAccess(withoutTools)).toEqual({ temperature: 0.5 });
    const withArray = { tools: [] };
    expect(enableStorageAccess(withArray)).toEqual({ tools: [] });
  });
});
