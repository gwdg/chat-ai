// Run with: node --test encryption/
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createPrivateKey, createPublicKey, diffieHellman } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  generatePair,
  keyId,
  main,
  parseModelsPayload,
} from "./generate-model-keys.mjs";
import { publishedKeyFileName } from "../front/src/e2ee/publishedKeys.js";

const BASE64URL = /^[A-Za-z0-9_-]+$/;

describe("key pairs", () => {
  it("derives the published public key from the private scalar", () => {
    const pair = generatePair();
    assert.match(pair.privateKey, BASE64URL);
    assert.match(pair.publicKey, BASE64URL);
    assert.equal(Buffer.from(pair.privateKey, "base64url").length, 32);
    assert.equal(Buffer.from(pair.publicKey, "base64url").length, 32);

    // A node reconstructs the public key from the private scalar; the two must
    // be the same pair. X25519's public key is the scalar multiplied by the
    // base point u=9, so a Diffie-Hellman against that point reproduces it.
    const basePoint = Buffer.alloc(32);
    basePoint[0] = 9;
    const derived = diffieHellman({
      privateKey: createPrivateKey({
        key: {
          kty: "OKP",
          crv: "X25519",
          d: pair.privateKey,
          x: pair.publicKey,
        },
        format: "jwk",
      }),
      publicKey: createPublicKey({
        key: {
          kty: "OKP",
          crv: "X25519",
          x: basePoint.toString("base64url"),
        },
        format: "jwk",
      }),
    });
    assert.equal(derived.toString("base64url"), pair.publicKey);
    assert.equal(pair.keyId, keyId(pair.publicKey));
    assert.equal(pair.keyId.length, 16);
  });

  it("mints a different pair every time", () => {
    assert.notEqual(generatePair().privateKey, generatePair().privateKey);
  });
});

describe("model payload", () => {
  it("accepts the OpenAI envelope and a plain array", () => {
    assert.deepEqual(parseModelsPayload({ data: [{ id: "a" }, { id: "b" }] }), [
      { id: "a", name: "" },
      { id: "b", name: "" },
    ]);
    assert.deepEqual(parseModelsPayload([{ id: "a", name: "A" }]), [
      { id: "a", name: "A" },
    ]);
  });

  it("skips duplicates and empty ids, keeping the display name", () => {
    assert.deepEqual(
      parseModelsPayload({
        data: [{ id: "a", name: "Alpha" }, { id: "a" }, { name: "" }, {}],
      }),
      [{ id: "a", name: "Alpha" }],
    );
  });

  it("rejects a body without a model list", () => {
    assert.throws(() => parseModelsPayload({ message: "Unauthorized" }));
  });
});

describe("file names", () => {
  it("flat-maps an id with a slash and keeps dots inside", () => {
    assert.equal(
      publishedKeyFileName("bridge/deepseek-v4.1-flash-1017"),
      "bridge-deepseek-v4.1-flash-1017.pub",
    );
  });

  it("collapses punctuation runs and trims leading dots", () => {
    assert.equal(publishedKeyFileName("ACME Model (beta)"), "ACME-Model-beta.pub");
    assert.equal(publishedKeyFileName("../etc/passwd"), "etc-passwd.pub");
  });
});

describe("main", () => {
  let server;
  let url;
  let outDir;

  before(async () => {
    server = http.createServer((request, response) => {
      if (request.headers.authorization !== "Bearer test-key") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          data: [
            { id: "qwen-a", name: "Qwen A" },
            { id: "bridge/b-model", name: "B" },
          ],
        }),
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    url = `http://127.0.0.1:${port}/models`;
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), "model-keys-"));
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const quietly = async (run) => {
    const logs = [];
    const original = console.log;
    const originalError = console.error;
    console.log = (...args) => logs.push(args.join(" "));
    console.error = (...args) => logs.push(args.join(" "));
    try {
      return { code: await run(), output: logs.join("\n") };
    } finally {
      console.log = original;
      console.error = originalError;
    }
  };

  it("writes one pair per model and leaves existing pairs alone", async () => {
    const first = await quietly(() =>
      main(["--models-url", url, "--api-key", "test-key", "--out", outDir]),
    );
    assert.equal(first.code, 0);
    assert.match(first.output, /2 key pair\(s\) written/);

    for (const name of ["qwen-a", "bridge-b-model"]) {
      const publicPath = path.join(outDir, `${name}.pub`);
      const privatePath = path.join(outDir, `${name}.key`);
      assert.equal(fs.readFileSync(publicPath, "utf8").trim().length, 43);
      assert.equal(
        fs.statSync(privatePath).mode & 0o777,
        0o600,
        `${name}.key must not be world-readable`,
      );
    }

    const second = await quietly(() =>
      main(["--models-url", url, "--api-key", "test-key", "--out", outDir]),
    );
    assert.equal(second.code, 0);
    assert.match(second.output, /0 key pair\(s\) written, 2 left alone/);
  });

  it("reports an upstream error instead of writing keys", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "model-keys-"));
    try {
      const result = await quietly(() =>
        main(["--models-url", url, "--out", empty]),
      );
      assert.equal(result.code, 1);
      assert.match(result.output, /Unauthorized/);
      assert.deepEqual(fs.readdirSync(empty), []);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("writes nothing on a dry run", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "model-keys-"));
    try {
      const result = await quietly(() =>
        main([
          "--models-url",
          url,
          "--api-key",
          "test-key",
          "--out",
          empty,
          "--dry-run",
        ]),
      );
      assert.equal(result.code, 0);
      assert.match(result.output, /Dry run: 2 key pair/);
      assert.deepEqual(fs.readdirSync(empty), []);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("reports existing pairs on a dry run instead of planning to overwrite", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-keys-"));
    try {
      const args = ["--models-url", url, "--api-key", "test-key", "--out", dir];
      await quietly(() => main(args));
      const result = await quietly(() => main([...args, "--dry-run"]));
      assert.equal(result.code, 0);
      assert.match(result.output, /Dry run: 0 key pair\(s\) would go to/);
      assert.match(result.output, /2 exist already/);
      // An existing pair keeps its key: the public key does not change.
      const before = fs.readFileSync(path.join(dir, "qwen-a.pub"), "utf8");
      assert.match(before, /^[A-Za-z0-9_-]{43}\n$/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
