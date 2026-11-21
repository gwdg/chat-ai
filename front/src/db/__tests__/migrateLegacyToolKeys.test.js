import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AppDB,
  db,
  migrateLegacyToolKeys,
  preserveStorageConsent,
} from "../index";
import { storageAccessEnabled } from "../../agent/storageAccess";

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

const APP_DB_NAME = "app-conversations-db";
const version17 = db._versions.find((version) => version._cfg.version === 17);
const schema16 = Object.assign(
  {},
  ...db._versions
    .filter((version) => version._cfg.version <= 16)
    .map((version) => version._cfg.storesSource ?? {}),
);

const seedV16 = async (rows) => {
  const seed = new Dexie(APP_DB_NAME);
  seed.version(16).stores(schema16);
  await seed.open();
  await seed.table("conversations").bulkAdd(rows);
  seed.close();
};

const openUpgraded = async () => {
  const appDb = new AppDB();
  await appDb.open();
  expect(appDb.verno).toBe(18);
  return appDb;
};

describe("v17 storage consent upgrade", () => {
  beforeEach(async () => {
    await Dexie.delete(APP_DB_NAME);
  });

  afterEach(async () => {
    await Dexie.delete(APP_DB_NAME);
  });

  it("registers preserveStorageConsent as the version 17 upgrade", () => {
    expect(version17).toBeTruthy();
    expect(version17._cfg.contentUpgrade).toBe(preserveStorageConsent);
  });

  it("keeps an existing conversation's explicit opt-out", async () => {
    await seedV16([
      { id: "chat-off", settings: { tools: { browser_storage: false } } },
    ]);
    const appDb = await openUpgraded();
    const row = await appDb.table("conversations").get("chat-off");
    expect(row.settings.tools.browser_storage).toBe(false);
    expect(storageAccessEnabled(row.settings)).toBe(false);
    appDb.close();
  });

  it("does not add a tools object to a conversation that had none", async () => {
    await seedV16([
      { id: "chat-plain", settings: { temperature: 0.5 } },
    ]);
    const appDb = await openUpgraded();
    const row = await appDb.table("conversations").get("chat-plain");
    expect(row.settings).toEqual({ temperature: 0.5 });
    expect("tools" in row.settings).toBe(false);
    appDb.close();
  });

  it("leaves a fresh conversation without a stored value enabled", async () => {
    await seedV16([{ id: "chat-fresh", settings: {} }]);
    const appDb = await openUpgraded();
    const row = await appDb.table("conversations").get("chat-fresh");
    expect(row.settings).toEqual({});
    expect(storageAccessEnabled(row.settings)).toBe(true);
    appDb.close();
  });
});
