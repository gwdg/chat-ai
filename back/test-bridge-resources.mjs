// Unit tests for the bridge's MCP resources. The two hosts that serve the
// browser bridge (`back` here, and the SAIA agent service in Python) must list
// and read the same way; the Python twin is
// `agent-service/tests/test_bridge_resources.py`.
import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_FILES,
  RESOURCE_TEMPLATE,
  listWorkspaceResources,
  readWorkspaceResource,
  resourceMime,
  resourcePath,
  resourceUri,
} from "./bridge-resources.mjs";

const folder = (name) => ({ name, dir: true });
const file = (name) => ({ name, dir: false });

const treeCall = (directories, { failing = new Set() } = {}) => {
  const asked = [];
  const call = async (name, args = {}) => {
    const path = String(args.path ?? "/");
    asked.push(`${name}:${path}`);
    if (name === "workspace_list") {
      if (failing.has(path)) return { ok: false, error: "PERMISSION_DENIED" };
      return { ok: true, result: directories[path] ?? [] };
    }
    if (name === "workspace_read") {
      return { ok: true, result: { path, content: "hello" } };
    }
    return { ok: false, error: `unexpected ${name}` };
  };
  call.asked = asked;
  return call;
};

test("a uri round-trips through the workspace path", () => {
  assert.equal(
    resourceUri("/docs/meeting notes.md"),
    "chatai-workspace:///docs/meeting%20notes.md",
  );
  assert.equal(
    resourcePath("chatai-workspace:///docs/meeting%20notes.md"),
    "/docs/meeting notes.md",
  );
  // `#` and `?` must be encoded, or the rest would parse as a fragment or query.
  assert.equal(resourceUri("/a#b.md"), "chatai-workspace:///a%23b.md");
  assert.equal(resourcePath(resourceUri("/a?b.md")), "/a?b.md");
  assert.equal(resourceUri("/"), "chatai-workspace:///");
  // Another scheme is not ours, so nothing may be read for it.
  assert.equal(resourcePath("file:///etc/passwd"), null);
});

test("the mime type follows the extension", () => {
  assert.equal(resourceMime("/a/b.md"), "text/markdown");
  assert.equal(resourceMime("/a/b.PNG"), "image/png");
  assert.equal(resourceMime("/a/b.unknown"), "text/plain");
  assert.equal(resourceMime("/a/b.bin", { binary: true }), "application/octet-stream");
});

test("the listing walks folders and names files by path", async () => {
  const call = treeCall({
    "/": [file("readme.md"), folder("docs")],
    "/docs": [file("guide.md"), folder("deep")],
    "/docs/deep": [file("note.txt")],
  });

  const listed = await listWorkspaceResources(call);

  assert.deepEqual(
    listed.resources.map((item) => item.uri),
    [
      "chatai-workspace:///readme.md",
      "chatai-workspace:///docs/guide.md",
      "chatai-workspace:///docs/deep/note.txt",
    ],
  );
  assert.deepEqual(
    listed.resources.map((item) => item.name),
    ["readme.md", "docs/guide.md", "docs/deep/note.txt"],
  );
  assert.equal(listed.resources[0].mimeType, "text/markdown");
});

test("a folder the browser refuses does not fail the listing", async () => {
  // A provider that needs permission must not make the whole bridge look broken.
  const call = treeCall(
    { "/": [file("a.txt"), folder("locked")], "/locked": [file("secret.txt")] },
    { failing: new Set(["/locked"]) },
  );

  const listed = await listWorkspaceResources(call);

  assert.deepEqual(
    listed.resources.map((item) => item.uri),
    ["chatai-workspace:///a.txt"],
  );
});

test("the walk is bounded so one list is not hundreds of round trips", async () => {
  const directories = {};
  for (let depth = 0; depth < 6; depth += 1) {
    const path = depth ? `/${Array.from({ length: depth }, (_, i) => `d${i}`).join("/")}` : "/";
    directories[path] = [folder(`d${depth}`)];
  }
  const call = treeCall(directories);

  await listWorkspaceResources(call);

  const walked = call.asked.filter((entry) => entry.startsWith("workspace_list:"));
  assert.ok(walked.length < 6); // depth is capped
});

test("the file count is capped", async () => {
  const call = treeCall({
    "/": Array.from({ length: MAX_FILES + 25 }, (_, index) => file(`f${index}.txt`)),
  });

  const listed = await listWorkspaceResources(call);

  assert.equal(listed.resources.length, MAX_FILES);
});

test("the template covers paths the listing did not reach", () => {
  assert.equal(RESOURCE_TEMPLATE.uriTemplate, "chatai-workspace:///{path}");
  assert.ok(RESOURCE_TEMPLATE.name);
});

test("a text resource is returned as text", async () => {
  const call = treeCall({});

  const answer = await readWorkspaceResource(call, "chatai-workspace:///docs/a.md");

  assert.deepEqual(answer, {
    contents: [
      {
        uri: "chatai-workspace:///docs/a.md",
        mimeType: "text/markdown",
        text: "hello",
      },
    ],
  });
  assert.ok(call.asked.includes("workspace_read:/docs/a.md"));
});

test("a binary resource is returned as a blob", async () => {
  const call = async (name, args) => ({
    ok: true,
    result: { path: args.path, encoding: "base64", content: "AAEC" },
  });

  const answer = await readWorkspaceResource(call, "chatai-workspace:///img/photo.png");

  assert.equal(answer.contents[0].blob, "AAEC");
  assert.equal(answer.contents[0].mimeType, "image/png");
  assert.equal(answer.contents[0].text, undefined);
});

test("a refused file is an error, not an empty resource", async () => {
  const tooLarge = async (name, args) => ({
    ok: true,
    result: { path: args.path, message: "File is too large." },
  });
  assert.deepEqual(await readWorkspaceResource(tooLarge, "chatai-workspace:///big.bin"), {
    error: "File is too large.",
  });

  const refused = async () => ({ ok: false, error: "BRIDGE_OFFLINE" });
  assert.deepEqual(await readWorkspaceResource(refused, "chatai-workspace:///a.txt"), {
    error: "BRIDGE_OFFLINE",
  });
});

test("a foreign uri is refused without calling the browser", async () => {
  const call = treeCall({});

  const answer = await readWorkspaceResource(call, "file:///etc/passwd");

  assert.match(answer.error, /workspace resource/);
  assert.deepEqual(call.asked, []);
});
