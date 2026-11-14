// Import modules
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";          
import fileUpload from "express-fileupload";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { Readable, pipeline } from "stream"; // Node's stream module
import OpenAI from "openai";

const app = express();

// Path to the external config file
const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/back.json";
const configPath = path.resolve(CONFIG_LOCATION);

// Default configuration if config file is missing or invalid
let port = 8081;
let apiEndpoint = "https://chat-ai.academiccloud.de/v1";
let apiKey = "";
let serviceName = "Chat AI Dev";
let testMode = false;
let remoteFilesEndpoint =
  process.env.REMOTE_FILES_ENDPOINT ||
  process.env.SAIA_RAG_WEB_ENDPOINT ||
  "http://localhost:8000/arcanas/api/v1";
let remoteFilesArcana =
  process.env.REMOTE_FILES_ARCANA ||
  process.env.SAIA_RAG_WEB_ARCANA ||
  "remote-files";

// Load configuration
try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (typeof config.port === "number" && config.port > 0) {
    port = config.port;
    console.log("Port:", port);
  } else {
    console.warn(
      "Invalid port in back.json. Falling back to default port 8081."
    );
  }
  apiEndpoint = config.apiEndpoint;
  apiKey = config.apiKey;
  serviceName = config.serviceName;
  testMode = config.testMode === true;
  const configuredRemoteFilesEndpoint =
    config.remoteFilesEndpoint || config.saiaRagWebEndpoint;
  if (
    typeof configuredRemoteFilesEndpoint === "string" &&
    configuredRemoteFilesEndpoint.trim()
  ) {
    remoteFilesEndpoint = configuredRemoteFilesEndpoint.trim();
  }
  const configuredRemoteFilesArcana =
    config.remoteFilesArcana || config.saiaRagWebArcana;
  if (
    typeof configuredRemoteFilesArcana === "string" &&
    configuredRemoteFilesArcana.trim()
  ) {
    remoteFilesArcana = configuredRemoteFilesArcana.trim();
  }
  if (testMode) {
    console.log("TEST MODE ENABLED: no upstream calls will be made.");
  }
} catch (error) {
  console.error("Failed to read back.json. Using default values.", error);
}

// Authorization for upstream calls: the inference-id header only stands in for a missing apiKey
const authHeaders = (req) => ({
  Authorization: "Bearer " + (apiKey || req.headers["inference-id"]),
  "inference-portal": serviceName,
});

// Forwards a parsed request to the API and streams the answer back. Cancels the upstream
// request when the client goes away.
async function forward(req, res, path, body, contentType) {
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  try {
    const upstream = await globalThis.fetch(apiEndpoint + path, {
      method: "POST",
      headers: { ...authHeaders(req), ...(contentType ? { "Content-Type": contentType } : {}) },
      body,
      signal: controller.signal,
    });
    res.status(upstream.status);
    const type = upstream.headers.get("content-type");
    if (type) res.setHeader("Content-Type", type);
    if (upstream.body) pipeline(Readable.fromWeb(upstream.body), res, () => {});
    else res.end();
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error(`Error in ${path}:`, error);
    if (!res.headersSent) res.status(502);
    res.end("Upstream request failed.");
  }
}

// Builds a multipart body from the parsed fields and uploaded files of a request
function multipart(req) {
  const form = new globalThis.FormData();
  for (const [name, value] of Object.entries(req.body ?? {})) form.append(name, String(value));
  for (const [name, file] of Object.entries(req.files ?? {})) {
    for (const one of [file].flat()) form.append(name, new Blob([one.data], { type: one.mimetype }), one.name);
  }
  return form;
}

// Global request limitations
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    debug: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err.name === "FileUploadError") {
    console.error("File Send Error:", err);
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// Function to process file with docling
async function processFile(file, inference_id) {
  const url = apiEndpoint + "/documents/convert/file";
  const formData = new FormData();
  formData.append("files", file.data, {
    filename: file.name,
    contentType: file.mimetype,
  });
  formData.append("extract_tables_as_images", "false");
  formData.append("image_resolution_scale", "4");
  formData.append("image_export_mode", "placeholder");
  formData.append("to_formats", "md");
  formData.append("pdf_backend", "dlparse_v4");
  formData.append("include_images", "false");
  
  const headers = {
    "inference-portal": serviceName,
  };

  // Only add Authorization header if apiKey is present and non-empty
  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  } else {
    // Only add inference-id header if apiKey is empty or non-existent
    headers["inference-id"] = inference_id;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  if (response.status !== 200) console.log(response.text);
  console.log(response.status)
  return response;
}

// Process PDF file
app.post("/documents/convert/file", async (req, res) => {
  // Check for the presence of `document` file key
  // `files` is docling's field name, which the front end and saia-engine use; `document` is older
  if (!req.files || !(req.files.files || req.files.document)) {
    return res.status(422).json({ error: "No file provided" });
  }

  const inference_id = req.headers["inference-id"];
  try {
    const file = req.files.files || req.files.document;
    const response = await processFile(file, inference_id);
    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }
    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    console.error("Processing error:", err);
    return res.status(500).json({
      error: "An internal server error occurred while processing file",
    });
  }
});

// Get list of models
app.get("/models", async (req, res) => {
  try {
    const url = apiEndpoint + "/models";
    const inference_id = req.headers["inference-id"];
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + apiKey,
      "inference-portal": serviceName,
    };
    if (apiKey) {
      headers.Authorization = "Bearer " + apiKey;
    } else {
      // Only add inference-id header if apiKey is empty or non-existent
      headers.Authorization = "Bearer " + inference_id;
    }
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    // Testing: only the external OpenAI models accept raw `file` content parts.
    // Local SAIA engines reject them with "Unsupported chat content part type".
    if (Array.isArray(data?.data)) {
      data.data = data.data.map((model) => {
        const input = Array.isArray(model.input) ? model.input : [];
        const supportsFiles =
          typeof model.id === "string" && model.id.startsWith("openai-");
        return {
          ...model,
          input:
            supportsFiles && !input.includes("pdf")
              ? [...input, "pdf"]
              : input,
        };
      });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error(`Error: ${error}`);
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

// Get placeholder user data
app.get("/user", async (req, res) => {
  try {
    res.status(200).json({
      email: "user@example.com",
      firstname: "Sample",
      lastname: "User",
      org: "GWD",
      organization: "GWDG",
      username: "sample-user",
      max_api_keys: 10,
      max_api_keys_per_day: 10,
      // Placeholder data must never grant admin rights. Real user data comes
      // from the gateway in a deployment.
      is_ai_admin: false,
      external: {
        rate_limits: {
          requests: {
            "10s": {
              limit: 100.0,
              used: 0.0,
              remaining: 100.0,
              resets_at: "2026-10-31T17:20:42.736938",
            },
            hourly: {
              limit: 100000.0,
              used: 555.0,
              remaining: 99445.0,
              resets_at: "2026-10-31T19:00:00.736938",
            },
            daily: {
              limit: 100000.0,
              used: 1384.0,
              remaining: 98616.0,
              resets_at: "2026-11-01T00:00:00.736938",
            },
            monthly: {
              limit: 1000000.0,
              used: 1793.0,
              remaining: 998207.0,
              resets_at: "2026-11-01T00:00:00.736938",
            },
          },
          budget: {
            hourly: {
              limit: 100,
              used: 5.0,
              remaining: 995.0,
              resets_at: "2026-10-31T19:00:00.736938",
            }      
          },
        },
        limits: {
          user: {
            monthly_limit: 100.0,
            monthly_usage: 1.0,
            total_limit: null,
            total_usage: 0.055230774578,
          },
          org: {
            monthly_usage_percent: 0.09173001825808,
            total_usage_percent: null,
          },
        },
      },
      internal: {
        rate_limits: {
          requests: {
            "10s": {
              limit: 100.0,
              used: 0.0,
              remaining: 100.0,
              resets_at: "2026-10-31T17:20:42.736938",
            },
            daily: {
              limit: 100000.0,
              used: 1384.0,
              remaining: 98616.0,
              resets_at: "2026-11-01T00:00:00.736938",
            },
            monthly: {
              limit: 1000000.0,
              used: 1793.0,
              remaining: 998207.0,
              resets_at: "2026-11-01T00:00:00.736938",
            },
          },
          budget: {
            hourly: {
              limit: 100,
              used: 5.0,
              remaining: 995.0,
              resets_at: "2026-10-31T19:00:00.736938",
            },
            daily: {
              limit: 200.0,
              used: 10.0,
              remaining: 990.0,
              resets_at: "2026-11-01T00:00:00.736938",
            }          
          },
        },
        limits: {
          user: {
            monthly_limit: 100.0,
            monthly_usage: 1.0,
            total_limit: null,
            total_usage: 0.055230774578,
          },
          org: {
            monthly_usage_percent: 0.09173001825808,
            total_usage_percent: null,
          },
        },
      }
    }
    );
  } catch (error) {
    console.error(`Error: ${error}`);
    res.status(500).json({ error: "Failed to fetch user info." });
  }
});

// Speech generation endpoint
app.post("/audio/speech", async (req, res) => {
  // Simply forward the request and return response
  try {
    const url = apiEndpoint + "/audio/speech";
    const inference_id = req.headers["inference-id"];
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
      "inference-portal": serviceName,
    };
    if (apiKey) {
      headers.Authorization = "Bearer " + apiKey;
    } else {
      // Only add inference-id header if apiKey is empty or non-existent
      headers.Authorization = "Bearer " + inference_id;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speech generation failed:", response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }
    const arrayBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Error in speech generation endpoint:", error);
    res.status(500).json({ error: "Failed to generate speech." });
  }
});

// Endpoints the browser agent's tools call. Bodies are forwarded as they are.
app.post("/audio/transcriptions", (req, res) => forward(req, res, "/audio/transcriptions", multipart(req)));
app.post("/images/edits", (req, res) => forward(req, res, "/images/edits", multipart(req)));
app.post("/images/generations", (req, res) =>
  forward(req, res, "/images/generations", JSON.stringify(req.body ?? {}), "application/json"),
);
app.post("/websearch", (req, res) => forward(req, res, "/websearch", JSON.stringify(req.body ?? {}), "application/json"));

// Remote file store. Files live in a dedicated saia-rag-web Arcana and are
// accessed through the saia-rag-web backend with the user's OIDC header.
const REMOTE_FILE_NAME_PREFIX = "rf_";

function remoteRelative(value) {
  const pathValue = String(value ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = pathValue
    .split("/")
    .filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === ".." || segment.includes("\0"))) {
    const error = new Error("Invalid remote file path");
    error.status = 400;
    throw error;
  }
  return segments.join("/");
}

function remoteRouteParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function remoteApiBase() {
  const base = remoteFilesEndpoint.replace(/\/+$/, "");
  return /\/api\/v1$/.test(base) ? base : `${base}/api/v1`;
}

function remoteAuthHeaders(req) {
  const uid =
    req.headers["x-auth-claim-uid"] ||
    req.headers["x-consumer-custom-id"] ||
    req.headers["oidc_claim_uid"] ||
    req.headers["inference-id"];
  return uid ? { "x-auth-claim-uid": uid } : {};
}

async function remoteApi(req, pathname, init = {}) {
  const url = `${remoteApiBase()}${pathname}`;
  try {
    return await globalThis.fetch(url, {
      ...init,
      headers: { ...remoteAuthHeaders(req), ...(init.headers ?? {}) },
    });
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    const wrapped = new Error(
      `saia-rag-web is not reachable at ${remoteApiBase()}${code ? ` (${code})` : ""}. ` +
        'Start the local dummy with "npm run dummy:rag" from back/, or set remoteFilesEndpoint in back.json.'
    );
    wrapped.status = 502;
    wrapped.cause = error;
    throw wrapped;
  }
}

async function remoteRequestError(response) {
  const text = await response.text().catch(() => "");
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed?.detail || parsed?.error || text;
  } catch {
    // not JSON
  }
  const error = new Error(
    message || `saia-rag-web request failed (${response.status})`
  );
  error.status =
    response.status >= 400 && response.status < 500 ? response.status : 502;
  return error;
}

const remoteArcanaPath = () => `/arcana/${encodeURIComponent(remoteFilesArcana)}`;

const encodeRemoteName = (relative) =>
  `${REMOTE_FILE_NAME_PREFIX}${Buffer.from(relative, "utf8").toString("base64url")}`;

function decodeRemoteName(name) {
  if (typeof name !== "string" || !name.startsWith(REMOTE_FILE_NAME_PREFIX)) {
    return null;
  }
  try {
    return Buffer.from(
      name.slice(REMOTE_FILE_NAME_PREFIX.length),
      "base64url"
    ).toString("utf8");
  } catch {
    return null;
  }
}

async function ensureRemoteArcana(req) {
  const response = await remoteApi(req, "/arcana/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: remoteFilesArcana, embedding_model: "" }),
  });
  if (response.status === 400) return;
  if (!response.ok) throw await remoteRequestError(response);
}

async function listStoredRemotePaths(req) {
  const response = await remoteApi(
    req,
    `${remoteArcanaPath()}/files/?grouped=false`
  );
  if (response.status === 404) return [];
  if (!response.ok) throw await remoteRequestError(response);
  const files = await response.json();
  if (!Array.isArray(files)) return [];
  return files.map((file) => decodeRemoteName(file?.name)).filter(Boolean);
}

function remoteEntries(relative, paths) {
  const prefix = relative ? `${relative}/` : "";
  const entries = new Map();
  for (const pathValue of paths) {
    if (!pathValue.startsWith(prefix) || pathValue === relative) continue;
    const segments = pathValue.slice(prefix.length).split("/").filter(Boolean);
    if (!segments.length) continue;
    const name = segments[0];
    const childPath = relative ? `${relative}/${name}` : name;
    const type = segments.length > 1 ? "directory" : "file";
    const existing = entries.get(childPath);
    if (!existing || existing.type !== "directory") {
      entries.set(childPath, { name, path: childPath, type });
    }
  }
  return [...entries.values()].sort(
    (a, b) =>
      Number(b.type === "directory") - Number(a.type === "directory") ||
      a.name.localeCompare(b.name)
  );
}

function sendRemoteError(res, error) {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Remote files error:", error);
  return res.status(502).json({ error: "Remote file backend request failed." });
}

async function readRemoteFileOrList(req, res, requested) {
  try {
    const relative = remoteRelative(requested);
    const paths = await listStoredRemotePaths(req);
    const entries = remoteEntries(relative, paths);
    if (!relative || entries.length) {
      return res.status(200).json({
        path: relative,
        type: "directory",
        entries,
      });
    }
    if (!paths.includes(relative)) {
      return res.status(404).json({ error: "Remote file not found" });
    }
    const encoding = req.query?.encoding === "base64" ? "base64" : "utf8";
    const response = await remoteApi(
      req,
      `${remoteArcanaPath()}/files/${encodeURIComponent(encodeRemoteName(relative))}/download`
    );
    if (!response.ok) throw await remoteRequestError(response);
    const content = Buffer.from(await response.arrayBuffer());
    return res.status(200).json({
      path: relative,
      type: "file",
      encoding,
      content: content.toString(encoding),
      size: content.length,
      modified: new Date().toISOString(),
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
}

function remoteFileForm(name, data) {
  const form = new globalThis.FormData();
  form.append(
    "file",
    new Blob([data], { type: "application/octet-stream" }),
    name
  );
  return form;
}

async function writeRemoteFile(req, res, requested) {
  try {
    const relative = remoteRelative(requested ?? req.body?.path ?? req.query?.path);
    if (!relative) {
      return res.status(422).json({ error: "A file path is required" });
    }
    if (typeof req.body?.content !== "string") {
      return res.status(422).json({ error: "content must be a string" });
    }
    const encoding = req.body?.encoding === "base64" ? "base64" : "utf8";
    const data = Buffer.from(req.body.content, encoding);
    const name = encodeRemoteName(relative);
    await ensureRemoteArcana(req);
    let response = await remoteApi(req, `${remoteArcanaPath()}/files/`, {
      method: "POST",
      body: remoteFileForm(name, data),
    });
    if (response.status === 400) {
      response = await remoteApi(
        req,
        `${remoteArcanaPath()}/files/${encodeURIComponent(name)}`,
        { method: "PUT", body: remoteFileForm(name, data) }
      );
    }
    if (!response.ok) throw await remoteRequestError(response);
    return res.status(200).json({
      path: relative,
      type: "file",
      size: data.length,
      modified: new Date().toISOString(),
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
}

async function deleteRemoteFile(req, res, requested) {
  try {
    const relative = remoteRelative(requested ?? req.body?.path ?? req.query?.path);
    if (!relative) {
      return res.status(422).json({ error: "A file path is required" });
    }
    const paths = await listStoredRemotePaths(req);
    const targets = paths.filter(
      (pathValue) =>
        pathValue === relative || pathValue.startsWith(`${relative}/`)
    );
    if (!targets.length) {
      return res.status(404).json({ error: "Remote file not found" });
    }
    for (const target of targets) {
      const response = await remoteApi(
        req,
        `${remoteArcanaPath()}/files/${encodeURIComponent(encodeRemoteName(target))}`,
        { method: "DELETE" }
      );
      if (!response.ok && response.status !== 404) {
        throw await remoteRequestError(response);
      }
    }
    return res.status(200).json({
      path: relative,
      deleted: true,
      deletedCount: targets.length,
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
}

app.get("/remote-files", (req, res) =>
  readRemoteFileOrList(req, res, req.query?.path)
);
app.get(/^\/remote-files\/(.+)$/, (req, res) =>
  readRemoteFileOrList(req, res, remoteRouteParam(req.params[0]))
);
app.put("/remote-files", (req, res) =>
  writeRemoteFile(req, res, req.body?.path ?? req.query?.path)
);
app.put(/^\/remote-files\/(.+)$/, (req, res) =>
  writeRemoteFile(req, res, remoteRouteParam(req.params[0]))
);
app.post("/remote-files", (req, res) => {
  const operation = String(req.body?.operation ?? "write").toLowerCase();
  if (operation === "read" || operation === "list") {
    return readRemoteFileOrList(req, res, req.body?.path ?? req.query?.path);
  }
  if (operation === "delete" || operation === "remove") {
    return deleteRemoteFile(req, res, req.body?.path ?? req.query?.path);
  }
  return writeRemoteFile(req, res, req.body?.path ?? req.query?.path);
});
app.delete("/remote-files", (req, res) =>
  deleteRemoteFile(req, res, req.body?.path ?? req.query?.path)
);
app.delete(/^\/remote-files\/(.+)$/, (req, res) =>
  deleteRemoteFile(req, res, remoteRouteParam(req.params[0]))
);

const encodeArcana = (value) => encodeURIComponent(String(value ?? ""));
const arcanaV2Path = (name) => `/arcana/${encodeArcana(name)}`;

async function proxyArcanaJson(req, pathname, init = {}) {
  const response = await remoteApi(req, pathname, init);
  if (!response.ok) throw await remoteRequestError(response);
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

app.get("/arcana-v2/arcanas", async (req, res) => {
  try {
    const arcanas = await proxyArcanaJson(req, "/arcana/");
    return res.status(200).json(
      Array.isArray(arcanas)
        ? arcanas.filter((arcana) => arcana?.name !== remoteFilesArcana)
        : []
    );
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.post("/arcana-v2/arcanas", async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(422).json({ error: "An Arcana name is required" });
    }
    const embeddingModel =
      typeof req.body?.embedding_model === "string"
        ? req.body.embedding_model
        : "";
    const result = await proxyArcanaJson(req, "/arcana/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, embedding_model: embeddingModel }),
    });
    return res.status(200).json(result ?? { name });
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name", async (req, res) => {
  try {
    const arcana = await proxyArcanaJson(req, arcanaV2Path(req.params.name));
    return res.status(200).json(arcana);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/files", async (req, res) => {
  try {
    const files = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/files/?grouped=false`
    );
    return res.status(200).json(files);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/files/:file/download", async (req, res) => {
  try {
    const response = await remoteApi(
      req,
      `${arcanaV2Path(req.params.name)}/files/${encodeArcana(req.params.file)}/download`
    );
    if (!response.ok) throw await remoteRequestError(response);
    const content = Buffer.from(await response.arrayBuffer());
    const encoding = req.query?.encoding === "base64" ? "base64" : "utf8";
    return res.status(200).json({
      arcana: req.params.name,
      file: req.params.file,
      encoding,
      content: content.toString(encoding),
      size: content.length,
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

async function handleArcanaFileWrite(req, res, replace) {
  try {
    const name = req.params.name;
    const filename = replace
      ? req.params.file
      : String(req.body?.filename ?? "").trim();
    if (!filename) {
      return res.status(422).json({ error: "A file name is required" });
    }
    if (typeof req.body?.content !== "string") {
      return res.status(422).json({ error: "content must be a string" });
    }
    const encoding = req.body?.encoding === "base64" ? "base64" : "utf8";
    const data = Buffer.from(req.body.content, encoding);
    const form = new globalThis.FormData();
    form.append(
      "file",
      new Blob([data], { type: "application/octet-stream" }),
      filename
    );
    const pathname = replace
      ? `${arcanaV2Path(name)}/files/${encodeArcana(filename)}`
      : `${arcanaV2Path(name)}/files/`;
    const result = await proxyArcanaJson(req, pathname, {
      method: replace ? "PUT" : "POST",
      body: form,
    });
    return res.status(200).json({
      arcana: name,
      file: filename,
      [replace ? "replaced" : "uploaded"]: true,
      size: data.length,
      result,
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
}

app.post("/arcana-v2/arcanas/:name/files", (req, res) =>
  handleArcanaFileWrite(req, res, false)
);
app.put("/arcana-v2/arcanas/:name/files/:file", (req, res) =>
  handleArcanaFileWrite(req, res, true)
);

app.delete("/arcana-v2/arcanas/:name/files/:file", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/files/${encodeArcana(req.params.file)}`,
      { method: "DELETE" }
    );
    return res.status(200).json({
      arcana: req.params.name,
      file: req.params.file,
      deleted: true,
      result,
    });
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.post("/arcana-v2/arcanas/:name/index", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/generate-index`,
      { method: "POST" }
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/index/status", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/index-status`
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/index/running", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/index-job-running`
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/index/jobs/:jobId", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/index-job/${encodeArcana(req.params.jobId)}`
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.delete("/arcana-v2/arcanas/:name/index", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/delete-index`,
      { method: "DELETE" }
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.get("/arcana-v2/arcanas/:name/members", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/members`
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.post("/arcana-v2/arcanas/:name/members", async (req, res) => {
  try {
    const user = String(req.body?.user ?? "").trim();
    if (!user) {
      return res.status(422).json({ error: "A user name is required" });
    }
    const role = req.body?.role === "editor" ? "editor" : "reader";
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, role }),
      }
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

app.delete("/arcana-v2/arcanas/:name/members/:member", async (req, res) => {
  try {
    const result = await proxyArcanaJson(
      req,
      `${arcanaV2Path(req.params.name)}/members/${encodeArcana(req.params.member)}`,
      { method: "DELETE" }
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendRemoteError(res, error);
  }
});

// Build a sophisticated JSON form for a requested tool in test mode. The shape
// matches what the frontend's ToolForm component renders: { tool_id, title,
// description, fields[] } with declarative HTML input types.
function buildTestForm(toolType) {
  const forms = {
    image_generation: {
      tool_id: "image_generation",
      title: "Image generation settings",
      description: "You can change the image size and style before the tool runs.",
      fields: [
        { name: "prompt", label: "Prompt", type: "textarea", rows: 4, value: "A serene mountain landscape at sunset" },
        { name: "width", label: "Width (px)", type: "number", value: 1024, min: 256, max: 2048, step: 64 },
        { name: "height", label: "Height (px)", type: "number", value: 1024, min: 256, max: 2048, step: 64 },
        { name: "quality", label: "Quality", type: "select", value: "high", options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]},
        { name: "style", label: "Style", type: "radio", value: "photorealistic", options: [
          { value: "photorealistic", label: "Photorealistic" },
          { value: "anime", label: "Anime" },
          { value: "painting", label: "Painting" },
        ]},
        { name: "seed", label: "Seed", type: "number", value: 42, min: 0, max: 100000 },
        { name: "enhance", label: "Enhance prompt", type: "checkbox", value: true },
      ],
    },
    image_modification: {
      tool_id: "image_modification",
      title: "Image modification settings",
      description: "Adjust how the uploaded image is modified.",
      fields: [
        { name: "instruction", label: "What to change", type: "textarea", rows: 3, value: "Make it brighter and more colourful" },
        { name: "strength", label: "Strength", type: "range", value: 0.75, min: 0, max: 1, step: 0.05 },
        { name: "denoise", label: "Denoise", type: "number", value: 0.5, min: 0, max: 1, step: 0.05 },
        { name: "preserve_face", label: "Preserve faces", type: "checkbox", value: true },
        { name: "output_format", label: "Output format", type: "select", value: "png", options: [
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
        ]},
      ],
    },
    audio_generation: {
      tool_id: "audio_generation",
      title: "Audio generation settings",
      description: "Configure the audio the tool will generate.",
      fields: [
        { name: "prompt", label: "Prompt", type: "textarea", rows: 3, value: "A calm ambient pad with gentle piano" },
        { name: "duration", label: "Duration (s)", type: "number", value: 10, min: 1, max: 120, step: 1 },
        { name: "format", label: "Format", type: "select", value: "mp3", options: [
          { value: "mp3", label: "MP3" },
          { value: "wav", label: "WAV" },
          { value: "flac", label: "FLAC" },
        ]},
        { name: "volume", label: "Volume", type: "range", value: 0.8, min: 0, max: 1, step: 0.05 },
        { name: "loop", label: "Loop", type: "checkbox", value: false },
      ],
    },
    web_search: {
      tool_id: "web_search",
      title: "Web search settings",
      description: "Tune how the search is performed.",
      fields: [
        { name: "query", label: "Search query", type: "text", value: "" },
        { name: "max_results", label: "Max results", type: "number", value: 5, min: 1, max: 20, step: 1 },
        { name: "region", label: "Region", type: "select", value: "en", options: [
          { value: "en", label: "English" },
          { value: "de", label: "German" },
          { value: "fr", label: "French" },
        ]},
        { name: "safe_search", label: "Safe search", type: "checkbox", value: true },
      ],
    },
  };

  if (forms[toolType]) return forms[toolType];

  // Generic but sophisticated fallback covering the common HTML input types.
  return {
    tool_id: toolType,
    title: "Settings for " + toolType,
    description:
      "The tool requested user input. Edit the options below and submit to run the tool with these settings.",
    fields: [
      { name: "title", label: "Title", type: "text", value: "Example" },
      { name: "description", label: "Description", type: "textarea", rows: 3, value: "Describe what you want." },
      { name: "count", label: "Count", type: "number", value: 3, min: 1, max: 10, step: 1 },
      { name: "scale", label: "Scale", type: "range", value: 0.5, min: 0, max: 1, step: 0.05 },
      { name: "mode", label: "Mode", type: "select", value: "auto", options: [
        { value: "auto", label: "Automatic" },
        { value: "manual", label: "Manual" },
        { value: "expert", label: "Expert" },
      ]},
      { name: "priority", label: "Priority", type: "radio", value: "medium", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ]},
      { name: "enabled", label: "Enabled", type: "checkbox", value: true },
      { name: "target_date", label: "Target date", type: "date", value: "2026-12-31" },
      { name: "accent_color", label: "Accent colour", type: "color", value: "#3b82f6" },
    ],
  };
}

// Chat Completions API
app.post("/chat/completions", async (req, res) => {
  const {
    messages,
    model,
    temperature = 0.5,
    top_p = 0.5,
    arcana = null,
    timeout = 30000,
    enable_tools = null,
    tools = null,
    stream = true,
    feedback = null,
    chat_template_kwargs = null,
    reasoning_effort = null,
    tool_choice = null,
  } = req.body;

  const mcp_servers = req.body["mcp-servers"] || null;
  const inference_id = req.headers["inference-id"];
  const uid = req.headers["oidc_claim_uid"];
  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  // ----- TEST MODE -----
  // With testMode enabled in back.json, no upstream call is made. We log only
  // request metadata (never message content or tool arguments) and synthesise
  // a response. When any tool is requested, we return a sophisticated JSON form
  // via a "<tool>.form" event.
  if (testMode) {
    const toolNames = Array.isArray(tools)
      ? tools.map((tool) => tool?.function?.name || tool?.type || "unknown")
      : [];
    const messageSummary = (messages || []).map((message) => ({
      role: message?.role,
      contentLength:
        typeof message?.content === "string" ? message.content.length : 0,
      hasToolCalls: Array.isArray(message?.tool_calls),
    }));

    console.log("\n=== TEST MODE: incoming /chat/completions request ===");
    console.log("model:", model);
    console.log("enable_tools:", enable_tools);
    console.log("tools:", toolNames);
    console.log("stream:", stream);
    console.log("messageCount:", messageSummary.length);
    console.log("messages:", JSON.stringify(messageSummary, null, 2));
    console.log("=== END OF REQUEST ===\n");

    const hasTools = !!enable_tools && Array.isArray(tools) && tools.length > 0;

    // Build the SSE response.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const now = Math.floor(Date.now() / 1000);
    const id = "chatcmpl-test-" + now;
    let counter = 0;
    const chunk = (delta, finishReason = null) => {
      const payload = {
        id,
        object: "chat.completion.chunk",
        created: now,
        model,
        choices: [
          {
            index: 0,
            delta,
            finish_reason: finishReason,
          },
        ],
      };
      const line = `data: ${JSON.stringify(payload)}\n\n`;
      console.log("→ sending to frontend:", line.trim());
      res.write(line);
      counter++;
    };

    if (hasTools) {
      // Return a sophisticated JSON form for the first requested tool.
      const toolType = tools[0]?.type || "generic_tool";
      const form = buildTestForm(toolType);
      chunk({
        tool_calls: [
          {
            index: 0,
            id: "call_test_form_" + now,
            type: "function",
            function: {
              name: toolType + ".form",
              arguments: JSON.stringify(form),
            },
          },
        ],
      });
    } else {
      // Plain conversational answer in test mode.
      const answer =
        "TEST MODE: I received your request (printed to the backend console). " +
        "No real model or tool was called. " +
        "To exercise tool forms, enable tools in the conversation.";
      const words = answer.split(" ");
      for (const w of words) {
        chunk({ content: w + " " });
      }
    }

    chunk({}, "stop");
    console.log("→ sending to frontend: data: [DONE]");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  // ----- END TEST MODE -----

  const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);
  let inference_service;
  let params;

  try {
    // // Create a single timeout that applies to the entire request
    // let timeoutId;
    // let isTimedOut = false;

    // const timeoutPromise = new Promise((resolve, reject) => {
    //   timeoutId = setTimeout(() => {
    //     isTimedOut = true;
    //     reject(
    //       new Error(
    //         `Request timed out after ${validatedTimeout / 1000} seconds`
    //       )
    //     );
    //   }, validatedTimeout);
    // });

    params = {
      model: model,
      messages: messages,
      temperature: temperature,
      top_p: top_p,
      stream: stream,
      stream_options: stream ? {include_usage: true } : null,
      timeout: timeout,
      chat_template_kwargs: chat_template_kwargs,
      reasoning_effort: reasoning_effort,
    }

    const isExternalModel = (model.startsWith("openai-") && !model.startsWith("openai-gpt-oss")) || model.startsWith("claude");
    inference_service = model;

    if (arcana && arcana.id !== "") {
      params.arcana = arcana;
    }

    if (feedback){
      params.feedback = feedback;
    }

    // Handle tools and arcana
    if ((enable_tools || params.arcana) && !isExternalModel) {
      inference_service = "saia-openai-gateway";
      params["runToolsOnServer"] = true;
      if (mcp_servers && mcp_servers.length > 0) {
        params["mcp-servers"] = mcp_servers;
      }
      if (tools && tools.length > 0) {
        params.tools = [];
        for (const tool of tools) {
          if (tool.type === "web_search_preview" || tool.type === "web_search") {
            params.tools.push({type: "web_search_preview"});
          }
          if (tool.type === "fetch_url") {
            params.tools.push({type: "fetch_url"});
          }
          if (tool.type === "image_generation") {
            params.tools.push({type: "image_generation"});
          }
          if (tool.type === "image_modify" || tool.type === "image_modification") {
            params.tools.push({type: "image_modify"});
          }
          if (tool.type === "audio_generation") {
            params.tools.push({type: "audio_generation"});
          }
          if (tool.type === "remote_file_access" || tool.type === "arcana_v2") {
            params.tools.push({type: "arcana_v2"});
          }
          if (tool.type === "arcana" && (!params.arcana || !params.arcana.id)) {
            params.tools.push({type: "arcana_list_files"});
            params.tools.push({type: "arcana_get_file_content"});
            params.tools.push({type: "arcana_retrieve_knowledge"});
          }
          if (tool.type === "audio_transcription") {
            params.tools.push({type: "audio_transcription"});
          }
          if (tool.type === "runRscript") {
            params.tools.push({type: "runRscript"});
          }
        }
      }
    }
    
    // Function tools of the browser agent, which runs them itself. Without enable_tools they go
    // to the model unchanged, and the request does not go through the tool gateway.
    const functionTools = Array.isArray(tools) ? tools.filter((tool) => tool?.type === "function") : [];
    if (!enable_tools && functionTools.length > 0) {
      params.tools = functionTools;
      if (tool_choice) params.tool_choice = tool_choice;
    }

    const openai = new OpenAI({baseURL : apiEndpoint, apiKey: apiKey ? apiKey : inference_id});

    // Temporary workaround as middleware doesn't support timeout yet
    if (params.arcana || params.model.includes("rag") || params.model.includes("sauerkraut")) delete params.timeout;
    
    // Build headers object
    const headers = {
      "inference-service": inference_service,
      "inference-portal": serviceName,
      "user": uid
    };

    // Add inference-id only if it's not null/undefined
    if (inference_id) {
      headers["inference-id"] = inference_id;
    }

    // Get chat completion response
    // Stop generating when the client goes away (e.g. the user stops the agent)
    const controller = new AbortController();
    res.on("close", () => controller.abort());
    const response = await openai.chat.completions.create(params, {
        headers,
        signal: controller.signal,
    }).asResponse();

    // Pass through headers (optional but recommended)
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream with error handling
    const nodeStream = Readable.fromWeb(response.body);

    nodeStream.on('error', (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).end("Upstream error");
      } else {
        res.end(); // gracefully end if already streaming
      }
    });
    nodeStream.on('end', () => {
      // Ensure the connection is closed properly
      if (!res.writableEnded) {
        res.end();
      }
    });

    nodeStream.pipe(res);
  } catch (err) {
    // The client went away and the request was cancelled: nothing to answer
    if (res.destroyed) return;
    try {
      // Well-formed error, return
      if (err?.status && err?.error) {
        return res
        .status(err?.status || 500)
        .json({
          error: err?.error || "An internal server error occurred",
         });
      }
      // Couldn't extract error message, so try without openai library
      const response = await fetch(apiEndpoint + "/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ apiKey ? apiKey : inference_id }`,
          "Content-Type": "application/json",
          "inference-service": inference_service,
          "inference-portal": serviceName,
          "inference-id": inference_id
        },
        body: JSON.stringify(params)
      });
      // Extract message and status from HTTP response
      let msg, status;
      try {
        status = response.status;
        msg = await response.text();
        msg = JSON.parse(msg);
        msg = msg?.message || msg;
        const match = msg.match(/'msg':\s*'([^']*)'/);
        if (match) {
          msg = match[1];
          console.log("Extracted message:", msg);
        }
      } catch {}
      // Return message as best as possible
      return res
        .status(status || err?.status || 500)
        .json({
          error: msg || "An unknown error occurred",
        });
    } catch (err) {
      console.error(err);
      return;
    }
  }
});

// Start Chat AI Backend App
app.listen(port, () => {
  console.log(`Chat AI backend listening on port ${port}`);
});
