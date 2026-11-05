import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { getExportData } from "../conversationUtils";

describe("conversation export", () => {
  beforeEach(async () => {
    await db.transaction(
      "rw",
      [db.conversations, db.messages, db.content_items, db.files_meta, db.files_data, db.folders],
      async () => {
        await Promise.all([
          db.conversations.clear(),
          db.messages.clear(),
          db.content_items.clear(),
          db.files_meta.clear(),
          db.files_data.clear(),
          db.folders.clear(),
        ]);
      },
    );
  });

  it("exports an empty database with the current version", async () => {
    const data = await getExportData();
    expect(data.conversations).toEqual([]);
    expect(data.version).toBeTruthy();
  });
});
