// Minimal saia-rag-web stand-in for local testing of the remote file store.
// It implements only the Arcana/file endpoints used by back/service.mjs and
// stores uploaded files under back/remote-files (or REMOTE_FILES_DIR).
import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const ROOT = path.resolve(process.env.REMOTE_FILES_DIR || path.join(here, "remote-files"));
const DEFAULT_ARCANA = process.env.REMOTE_FILES_ARCANA || "remote-files";

fs.mkdirSync(ROOT, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(fileUpload({ createParentPath: true, limits: { fileSize: 50 * 1024 * 1024 } }));

const safeName = (value) => {
  const name = String(value ?? "").trim();
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    const error = new Error("Invalid name");
    error.status = 400;
    throw error;
  }
  return name;
};

const arcanaDir = (name) => {
  const safe = safeName(name);
  const dir = safe === DEFAULT_ARCANA ? ROOT : path.join(ROOT, safe);
  if (!dir.startsWith(ROOT + path.sep) && dir !== ROOT) {
    const error = new Error("Invalid arcana path");
    error.status = 400;
    throw error;
  }
  return dir;
};

const filePath = (arcana, name) => {
  const target = path.join(arcanaDir(arcana), safeName(name));
  if (!target.startsWith(arcanaDir(arcana) + path.sep)) {
    const error = new Error("Invalid file path");
    error.status = 400;
    throw error;
  }
  return target;
};

async function walk(dir, prefix = "") {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(path.join(dir, entry.name), relative)));
    else files.push(relative);
  }
  return files;
}

const uploadData = (req) => {
  const file = req.files?.file;
  if (!file) {
    const error = new Error("file is required");
    error.status = 422;
    throw error;
  }
  const one = Array.isArray(file) ? file[0] : file;
  return { name: one.name, data: one.data };
};

const sendError = (res, error) => {
  if (error?.status) return res.status(error.status).json({ detail: error.message, error: error.message });
  console.error("dummy-rag-web error:", error);
  return res.status(500).json({ detail: "Dummy backend error", error: "Dummy backend error" });
};

const api = express.Router();

api.get("/arcana/", async (_req, res) => {
  try {
    const entries = await fs.promises.readdir(ROOT, { withFileTypes: true });
    const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (!names.includes(DEFAULT_ARCANA)) names.unshift(DEFAULT_ARCANA);
    return res.status(200).json(names.map((name) => ({ name })));
  } catch (error) {
    return sendError(res, error);
  }
});

api.get("/arcana/:name", async (req, res) => {
  try {
    await fs.promises.mkdir(arcanaDir(req.params.name), { recursive: true });
    return res.status(200).json({ name: safeName(req.params.name) });
  } catch (error) {
    return sendError(res, error);
  }
});

api.post("/arcana/", async (req, res) => {
  try {
    await fs.promises.mkdir(arcanaDir(req.body?.name ?? "remote-files"), { recursive: true });
    return res.status(200).json({ name: safeName(req.body?.name ?? "remote-files") });
  } catch (error) {
    return sendError(res, error);
  }
});

api.get("/arcana/:name/files/", async (req, res) => {
  try {
    const files = await walk(arcanaDir(req.params.name));
    return res.status(200).json(files.map((name) => ({ name })));
  } catch (error) {
    return sendError(res, error);
  }
});
api.get("/arcana/:name/files", async (req, res) => {
  try {
    const files = await walk(arcanaDir(req.params.name));
    return res.status(200).json(files.map((name) => ({ name })));
  } catch (error) {
    return sendError(res, error);
  }
});

api.post("/arcana/:name/files/", async (req, res) => {
  try {
    const { name, data } = uploadData(req);
    const target = filePath(req.params.name, name);
    if (fs.existsSync(target)) {
      return res.status(400).json({ detail: "File already exists", error: "File already exists" });
    }
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, data);
    return res.status(200).json({ name });
  } catch (error) {
    return sendError(res, error);
  }
});

api.put("/arcana/:name/files/:filename", async (req, res) => {
  try {
    const { data } = uploadData(req);
    const target = filePath(req.params.name, req.params.filename);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, data);
    return res.status(200).json({ name: req.params.filename });
  } catch (error) {
    return sendError(res, error);
  }
});

api.get("/arcana/:name/files/:filename/download", async (req, res) => {
  try {
    const target = filePath(req.params.name, req.params.filename);
    const data = await fs.promises.readFile(target);
    res.setHeader("Content-Type", "application/octet-stream");
    return res.status(200).send(data);
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ detail: "File not found" });
    return sendError(res, error);
  }
});

api.delete("/arcana/:name/files/:filename", async (req, res) => {
  try {
    const target = filePath(req.params.name, req.params.filename);
    await fs.promises.unlink(target);
    return res.status(200).json({ name: req.params.filename });
  } catch (error) {
    if (error.code === "ENOENT") return res.status(404).json({ detail: "File not found" });
    return sendError(res, error);
  }
});

// Accept the same routes with and without the default saia-rag-web prefix.
app.use("/arcanas/api/v1", api);
app.use("/api/v1", api);
app.use("/", api);

app.get("/health", (_req, res) => res.json({ ok: true, root: ROOT }));

app.listen(PORT, () => {
  console.log(`dummy saia-rag-web listening on http://127.0.0.1:${PORT}/api/v1`);
  console.log(`remote files root: ${ROOT}`);
});
