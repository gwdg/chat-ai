import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apis/agentEndpoints", () => ({
  agentEndpoint: () => "http://backend.test",
}));

import {
  addArcanaMember,
  createArcana,
  getArcanaIndexStatus,
  listArcanas,
  readArcanaFile,
  removeArcanaMember,
  uploadArcanaFile,
} from "../arcanaV2";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArcanaV2 API", () => {
  it("lists arcanas through the backend", async () => {
    const fetchMock = vi.fn(async () => json([{ name: "notes" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listArcanas()).resolves.toEqual([{ name: "notes" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/arcana-v2/arcanas",
      undefined
    );
  });

  it("creates an arcana through the backend", async () => {
    const fetchMock = vi.fn(async () => json({ message: "created" }));
    vi.stubGlobal("fetch", fetchMock);

    await createArcana("notes", "embed-model");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/arcana-v2/arcanas",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "notes", embedding_model: "embed-model" }),
      }
    );
  });

  it("reads a file with an encoded name and encoding", async () => {
    const fetchMock = vi.fn(async () => json({ content: "hello" }));
    vi.stubGlobal("fetch", fetchMock);

    await readArcanaFile("my arcana", "notes/a b.md", "base64");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/arcana-v2/arcanas/my%20arcana/files/notes%2Fa%20b.md/download?encoding=base64",
      undefined
    );
  });

  it("uploads a file as JSON", async () => {
    const fetchMock = vi.fn(async () => json({ uploaded: true }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadArcanaFile("notes", "a.md", "hello", "utf8");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/arcana-v2/arcanas/notes/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "a.md",
          content: "hello",
          encoding: "utf8",
        }),
      }
    );
  });

  it("combines index status and running state", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      json(
        url.endsWith("/running")
          ? { running: true }
          : { index_status: "INDEXED" }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getArcanaIndexStatus("notes")).resolves.toEqual({
      status: { index_status: "INDEXED" },
      running: { running: true },
    });
  });

  it("adds and removes members", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await addArcanaMember("notes", "alice", "editor");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://backend.test/arcana-v2/arcanas/notes/members",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: "alice", role: "editor" }),
      }
    );

    await removeArcanaMember("notes", "alice@example.org");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://backend.test/arcana-v2/arcanas/notes/members/alice%40example.org",
      { method: "DELETE" }
    );
  });
});
