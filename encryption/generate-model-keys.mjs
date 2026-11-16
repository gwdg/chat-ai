#!/usr/bin/env node
// Generate one SAIA E2EE node key pair per available model.
//
// The models come from the deployment's `/models` endpoint (the same one the
// app uses), so the set of key files matches what users can select. Each pair
// is written to `encryption/keys/` as
//
//   <MODELNAME>.key   base64url X25519 private key, mode 0600, node only
//   <MODELNAME>.pub   base64url X25519 public key, publish this one
//
// and `<MODELNAME>` is `publishedKeyFileName()` from
// `front/src/e2ee/publishedKeys.js`, which the app also uses to build the
// download URL. Keep both sides on that one function.
//
// Why X25519 and not RSA-4096: the protocol in saia/saia-e2ee (and the port in
// front/src/e2ee/protocol.js) is X25519 + HKDF-SHA256 + AES-256-GCM. The node
// only accepts a 32-byte X25519 public key, so any other key type would be
// unusable. A 256-bit X25519 key has roughly the same security level as an
// RSA-3072 key.
//
// Usage: node encryption/generate-model-keys.mjs [options]
// Run with --help for the option list.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

import { publishedKeyFileName } from "../front/src/e2ee/publishedKeys.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_OUT = path.join(SCRIPT_DIR, "keys");

/** The GWDG deployment's model list, used when nothing else names one. */
export const DEFAULT_MODELS_URL =
  "https://chat-ai.academiccloud.de/v1/models";

const HELP = `Generate one E2EE node key pair per model.

Usage:
  node encryption/generate-model-keys.mjs [options]

Options:
  --models-url <url>   /models endpoint to query
                       (default: modelsPath from --config, else
                        ${DEFAULT_MODELS_URL})
  --config <file>      front.json to read modelsPath/apiKey from
                       (default: $CONFIG_LOCATION, else secrets/front.json;
                        a back.json next to it supplies the API key when the
                        front config has none)
  --api-key <key>      bearer token for the models endpoint
                       (default: $SAIA_API_KEY, else apiKey from the configs)
  --header <n: value>  extra request header, repeatable
  --out <dir>          output directory (default: encryption/keys)
  --force              overwrite existing key pairs
  --dry-run            list the files that would be written
  -h, --help           show this help

The private key of a pair belongs only on its model node:

  SAIA_E2EE_PRIVATE_KEY_FILE=encryption/keys/<MODELNAME>.key

Publish the .pub file under the key directory configured in front.json:

  "e2eeKeyUrl": "https://docs.ai.gwdg.de/technical/saia-platform/keys/"

The node's public key is the only thing that may be published; never commit or
upload a .key file.
`;

export function parseArgs(argv) {
  const args = {
    modelsUrl: "",
    config: "",
    apiKey: "",
    headers: [],
    out: DEFAULT_OUT,
    force: false,
    dryRun: false,
    help: false,
  };
  const value = (index, flag) => {
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`${flag} needs a value`);
    }
    return next;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--models-url") {
      args.modelsUrl = value(i, arg);
      i += 1;
    } else if (arg === "--config") {
      args.config = value(i, arg);
      i += 1;
    } else if (arg === "--api-key") {
      args.apiKey = value(i, arg);
      i += 1;
    } else if (arg === "--header") {
      args.headers.push(value(i, arg));
      i += 1;
    } else if (arg === "--out") {
      args.out = value(i, arg);
      i += 1;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

/** Model ids from an OpenAI-style `{data: [...]}` body or a plain array. */
export function parseModelsPayload(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : null;
  if (!list) throw new Error("The models response has no data array.");
  const seen = new Set();
  const models = [];
  for (const entry of list) {
    const id = String(entry?.id ?? entry?.name ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push({ id, name: String(entry?.name ?? "").trim() });
  }
  return models;
}

/** A fresh X25519 pair in the published base64url form plus its key id. */
export function generatePair() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const publicX = publicKey.export({ format: "jwk" }).x;
  const privateD = privateKey.export({ format: "jwk" }).d;
  if (typeof publicX !== "string" || typeof privateD !== "string") {
    throw new Error("Node did not export a raw X25519 key pair.");
  }
  return { publicKey: publicX, privateKey: privateD, keyId: keyId(publicX) };
}

/** The client's key id: base64url(sha256(public bytes)[:12]). */
export function keyId(publicKeyB64) {
  const bytes = Buffer.from(publicKeyB64, "base64url");
  if (bytes.length !== 32) {
    throw new Error(`An X25519 public key is 32 bytes, got ${bytes.length}.`);
  }
  return createHash("sha256")
    .update(bytes)
    .digest()
    .subarray(0, 12)
    .toString("base64url");
}

function resolveConfigPath(explicit) {
  if (explicit) return path.resolve(process.cwd(), explicit);
  const fromEnv = process.env.CONFIG_LOCATION;
  if (fromEnv && fromEnv.trim()) {
    return path.resolve(process.cwd(), fromEnv.trim());
  }
  return path.join(REPO_ROOT, "secrets", "front.json");
}

function readConfig(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`Could not read ${file}: ${error.message}`);
  }
}

function requestHeaders(args, config, backConfig) {
  const headers = { Accept: "application/json" };
  // Explicit flag, then the shell, then the deployment's configs: front.json
  // carries the key for an endpoint the browser may call, back.json is where
  // the README puts the real one.
  const apiKey =
    args.apiKey ||
    process.env.SAIA_API_KEY ||
    config?.apiKey ||
    backConfig?.apiKey ||
    "";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  for (const header of args.headers) {
    const separator = header.indexOf(":");
    if (separator < 0) throw new Error(`Invalid header: ${header}`);
    headers[header.slice(0, separator).trim()] = header.slice(separator + 1).trim();
  }
  return headers;
}

/** The endpoint to query: explicit flag, the config's modelsPath, then GWDG. */
export function resolveModelsUrl(args = {}, config = null) {
  const explicit = String(args.modelsUrl ?? "").trim();
  if (explicit) return explicit;
  const configured = String(config?.modelsPath ?? "").trim();
  if (configured) return configured;
  return DEFAULT_MODELS_URL;
}

/** A human-readable reason from an OpenAI-style error body, or "". */
function errorDetail(payload) {
  if (typeof payload?.message === "string" && payload.message) {
    return payload.message;
  }
  if (typeof payload?.error?.message === "string" && payload.error.message) {
    return payload.error.message;
  }
  if (typeof payload?.error === "string" && payload.error) return payload.error;
  return "";
}

async function fetchModels(url, headers) {
  let response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw new Error(`Could not reach ${url}: ${error.message}`);
  }
  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(
      `${url} did not answer with JSON (HTTP ${response.status}): ${body.slice(0, 120)}`,
    );
  }
  // The back service answers 200 even when the upstream rejects the request,
  // so the body — not the status — decides whether this worked.
  const detail = errorDetail(payload) || body.slice(0, 120);
  if (!response.ok) {
    const hint =
      response.status === 401 || response.status === 403
        ? " Set apiKey in secrets/back.json, export SAIA_API_KEY, or pass --api-key."
        : "";
    throw new Error(`${url} answered HTTP ${response.status}: ${detail}${hint}`);
  }
  if (!Array.isArray(payload) && !Array.isArray(payload?.data)) {
    throw new Error(`${url} answered without a model list: ${detail}`);
  }
  return parseModelsPayload(payload);
}

function pathsFor(directory, modelId) {
  const fileName = publishedKeyFileName(modelId);
  const stem = fileName.slice(0, -".pub".length);
  const root = path.resolve(directory);
  const publicPath = path.resolve(root, `${stem}.pub`);
  const privatePath = path.resolve(root, `${stem}.key`);
  if (
    !publicPath.startsWith(root + path.sep) ||
    !privatePath.startsWith(root + path.sep)
  ) {
    throw new Error(`Refusing to write outside ${root}: ${modelId}`);
  }
  return { fileName, publicPath, privatePath };
}

function existingKeyId(publicPath) {
  try {
    return keyId(fs.readFileSync(publicPath, "utf8").trim());
  } catch {
    return "";
  }
}

function writePair(publicPath, privatePath, pair) {
  fs.writeFileSync(privatePath, `${pair.privateKey}\n`, { mode: 0o600 });
  fs.chmodSync(privatePath, 0o600);
  fs.writeFileSync(publicPath, `${pair.publicKey}\n`, { mode: 0o644 });
  fs.chmodSync(publicPath, 0o644);
}

function formatRow(values, widths) {
  return values
    .map((value, index) => String(value).padEnd(widths[index]))
    .join("  ")
    .trimEnd();
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n`);
    console.error(HELP);
    return 1;
  }
  if (args.help) {
    console.log(HELP);
    return 0;
  }

  const configPath = resolveConfigPath(args.config);
  let config = null;
  let backConfig = null;
  try {
    config = readConfig(configPath);
    // The README puts the real API key in back.json, next to front.json.
    backConfig = readConfig(path.join(path.dirname(configPath), "back.json"));
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const modelsUrl = resolveModelsUrl(args, config);

  let models;
  try {
    models = await fetchModels(
      modelsUrl,
      requestHeaders(args, config, backConfig),
    );
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  if (!models.length) {
    console.error(`${modelsUrl} returned no models.`);
    return 1;
  }

  const outDir = path.resolve(process.cwd(), args.out);
  if (!args.dryRun) fs.mkdirSync(outDir, { recursive: true });

  const rows = [];
  const counts = { written: 0, skipped: 0 };
  for (const model of models) {
    const { fileName, publicPath, privatePath } = pathsFor(outDir, model.id);
    const exists = fs.existsSync(publicPath) || fs.existsSync(privatePath);
    if (exists && !args.force) {
      counts.skipped += 1;
      rows.push([model.id, fileName, existingKeyId(publicPath), "exists"]);
      continue;
    }
    const pair = generatePair();
    if (args.dryRun) {
      rows.push([model.id, fileName, pair.keyId, "would write"]);
      continue;
    }
    writePair(publicPath, privatePath, pair);
    counts.written += 1;
    rows.push([model.id, fileName, pair.keyId, "written"]);
  }

  print(rows, outDir, {
    dryRun: args.dryRun,
    ...counts,
    modelsUrl,
    modelCount: models.length,
  });
  return 0;
}

function print(rows, outDir, { dryRun, written, skipped, modelsUrl, modelCount }) {
  console.log(`${modelCount} model(s) from ${modelsUrl}`);
  const widths = [0, 0, 0];
  for (const row of rows) {
    for (let i = 0; i < widths.length; i += 1) {
      widths[i] = Math.max(widths[i], String(row[i]).length);
    }
  }
  console.log(
    formatRow(["model", "file", "key id", "state"], widths.map((w) => w + 2)),
  );
  for (const row of rows) console.log(formatRow(row, widths.map((w) => w + 2)));
  console.log();
  if (dryRun) {
    const pending = rows.length - skipped;
    console.log(
      `Dry run: ${pending} key pair(s) would go to ${outDir}` +
        (skipped ? `, ${skipped} exist already.` : "."),
    );
    return;
  }
  console.log(
    `${written} key pair(s) written, ${skipped} left alone in ${outDir}.`,
  );
  if (written) {
    console.log(
      "Private keys are mode 0600. Put a .key on its model node and publish only the .pub file.",
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error?.message || error);
      process.exitCode = 1;
    },
  );
}
