import { describe, expect, it } from "vitest";
import {
  storageAccessEnabled,
  storageToolSettings,
  writeAccessEnabled,
} from "../storageAccess";

const withTools = (tools: Record<string, boolean>) => ({ tools });

describe("storage access", () => {
  it("is on by default and only off on an explicit false", () => {
    expect(storageAccessEnabled({})).toBe(true);
    expect(storageAccessEnabled(undefined)).toBe(true);
    expect(storageAccessEnabled(withTools({}))).toBe(true);
    expect(storageAccessEnabled(withTools({ browser_storage: true }))).toBe(true);
    expect(storageAccessEnabled(withTools({ browser_storage: false }))).toBe(false);
  });

  it("always allows writing in the chat's own storage", () => {
    const options = storageToolSettings(withTools({ write_access: false }), {
      vision: true,
    });
    expect(options).toMatchObject({
      vision: true,
      hasLocalFolder: false,
      enabled: { browser_storage: true, write_access: true },
    });
  });

  it("gives an attached workspace read and write access by default", () => {
    const options = storageToolSettings(withTools({}), {
      vision: false,
      attachedWorkspace: true,
    });
    expect(options.hasLocalFolder).toBe(true);
    expect(options.enabled).toMatchObject({
      browser_storage: true,
      write_access: true,
    });
  });

  it("honours the write switch of an attached workspace", () => {
    const settings = withTools({ workspace_write_access: false });
    const options = storageToolSettings(settings, {
      attachedWorkspace: true,
    });
    expect(options.enabled.write_access).toBe(false);
    expect(writeAccessEnabled(settings, { attachedWorkspace: true })).toBe(false);
    // The same switch only applies to workspaces; the chat's own storage always writes.
    expect(writeAccessEnabled(settings)).toBe(true);
  });

  it("counts a mounted folder as local storage", () => {
    const options = storageToolSettings(withTools({}), { hasMounts: true });
    expect(options.hasLocalFolder).toBe(true);
    expect(options.enabled.write_access).toBe(true);
  });

  it("removes every storage tool once access storage is off", () => {
    const options = storageToolSettings(
      withTools({
        browser_storage: false,
        write_access: true,
        workspace_write_access: true,
      }),
      {
        vision: true,
        attachedWorkspace: true,
        hasMounts: true,
      },
    );
    // A workspace or mount must not re-enable the tools the user switched off.
    expect(options).toMatchObject({
      hasLocalFolder: false,
      enabled: { browser_storage: false, write_access: false },
    });
  });

  it("keeps unrelated tool toggles untouched", () => {
    const options = storageToolSettings(
      withTools({ arcana_tools: true, image_analysis: false }),
    );
    expect(options.enabled).toMatchObject({
      arcana_tools: true,
      image_analysis: false,
    });
  });
});
