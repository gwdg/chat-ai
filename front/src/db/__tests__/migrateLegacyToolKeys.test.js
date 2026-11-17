import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateLegacyToolKeys, preserveStorageConsent } from "../index";
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

const created = [];
let counter = 0;

const newDbName = () => {
  const name = `v17-storage-consent-${counter++}`;
  created.push(name);
  return name;
};

const seedV16 = async (name, rows) => {
  const db = new Dexie(name);
  db.version(1).stores({ conversations: "id" });
  await db.open();
  await db.table("conversations").bulkAdd(rows);
  db.close();
  return name;
};

const openUpgraded = async (name) => {
  const db = new Dexie(name);
  db.version(1).stores({ conversations: "id" });
  db.version(2).stores({}).upgrade(preserveStorageConsent);
  await db.open();
  return db;
};

describe("v17 storage consent upgrade", () => {
  beforeEach(() => {
    created.length = 0;
  });

  afterEach(async () => {
    await Promise.all(created.map((name) => Dexie.delete(name)));
    created.length = 0;
  });

  it("keeps an existing conversation's explicit opt-out", async () => {
    const db = await openUpgraded(
      await seedV16(newDbName(), [
        { id: "chat-off", settings: { tools: { browser_storage: false } } },
      ]),
    );
    const row = await db.table("conversations").get("chat-off");
    expect(row.settings.tools.browser_storage).toBe(false);
    expect(storageAccessEnabled(row.settings)).toBe(false);
    db.close();
  });

  it("does not add a tools object to a conversation that had none", async () => {
    const db = await openUpgraded(
      await seedV16(newDbName(), [
        { id: "chat-plain", settings: { temperature: 0.5 } },
      ]),
    );
    const row = await db.table("conversations").get("chat-plain");
    expect(row.settings).toEqual({ temperature: 0.5 });
    expect("tools" in row.settings).toBe(false);
    db.close();
  });

  it("leaves a fresh conversation without a stored value enabled", async () => {
    const db = await openUpgraded(
      await seedV16(newDbName(), [
        { id: "chat-fresh", settings: {} },
      ]),
    );
    const row = await db.table("conversations").get("chat-fresh");
    expect(row.settings).toEqual({});
    expect(storageAccessEnabled(row.settings)).toBe(true);
    db.close();
  });
});
