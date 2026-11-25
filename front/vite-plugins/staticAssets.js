// Build-time helpers for serving the static bundle efficiently:
//
// - staticAssetsBuild(): emits `sw.js`, then writes `<file>.br` and
//   `<file>.gz` next to every compressible file in the build output, so web
//   servers (nginx `gzip_static` / `brotli_static`, Apache rewrite rules) and
//   `vite preview` can send them without compressing on every request.
//   `sw.js` keeps fetched hashed assets and the vendored Typst/TikZJax files
//   in Cache Storage so repeat visits do not re-download them. Nothing is
//   precached; files are cached on first use.
// - servePrecompressed(): `vite preview` middleware (used by mode "prod") that
//   serves those files with long-lived cache headers. Vite's own preview
//   compression only gzips on the fly and skips `application/wasm` entirely.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import { promisify } from "util";

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const COMPRESSIBLE = /\.(js|mjs|css|html|svg|json|wasm|txt|xml|ttf|otf|ico|map)$/i;
const MIN_SIZE = 1024;
// Directories in public/ that are versioned with their npm packages but not
// fingerprinted, so they get a shorter cache lifetime and a content hash in
// the service-worker manifest.
const VENDORED_DIRS = ["typst-assets/", "tikzjax/"];

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? walk(full, base)
      : [path.relative(base, full).split(path.sep).join("/")];
  });

const resolveOutDir = (config) => path.resolve(config.root, config.build.outDir);

async function precompress(outDir) {
  const started = Date.now();
  const files = walk(outDir).filter((f) => COMPRESSIBLE.test(f));
  let before = 0;
  let after = 0;
  await Promise.all(
    files.map(async (rel) => {
      const file = path.join(outDir, rel);
      const data = await fs.promises.readFile(file);
      if (data.length < MIN_SIZE) return;
      // Brotli q11 costs ~30x the time of q9 for ~8% smaller output, and q9
      // on the 27 MB Typst compiler takes ~8s versus <1s at q5 (+8% size).
      const MB = 1024 * 1024;
      // Text gets q11 (the JS/CSS every visit loads); fonts and WASM get q9.
      const isText = /\.(js|mjs|css|html|svg|json|txt|xml|map)$/i.test(rel);
      const quality =
        data.length > 10 * MB ? 5 : isText && data.length <= MB ? 11 : 9;
      const [br, gz] = await Promise.all([
        brotli(data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        }),
        gzip(data, { level: 9 }),
      ]);
      // Not worth it for already-compressed content (e.g. some fonts).
      if (br.length > data.length * 0.9) return;
      before += data.length;
      after += br.length;
      await Promise.all([
        fs.promises.writeFile(`${file}.br`, br),
        fs.promises.writeFile(`${file}.gz`, gz),
      ]);
    })
  );
  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  console.log(
    `precompress: ${mb(before)} MB -> ${mb(after)} MB brotli in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
}

const CONTENT_TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

export function servePrecompressed() {
  let outDir;
  return {
    name: "serve-precompressed",
    configResolved(config) {
      outDir = resolveOutDir(config);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = decodeURIComponent((req.url || "").split("?")[0]);
        const rel = url.replace(/^\/+/, "");
        const isAsset = rel.startsWith("assets/");
        if (!isAsset && !VENDORED_DIRS.some((d) => rel.startsWith(d))) return next();
        // TikZJax's own .gz files are handled (as identity) by serve-tikzjax-gzip.
        if (/\.(gz|br)$/.test(rel)) return next();
        const file = path.join(outDir, rel);
        if (!file.startsWith(outDir + path.sep) || !fs.existsSync(file)) return next();

        const accept = String(req.headers["accept-encoding"] || "");
        let servedFile = file;
        let encoding = null;
        if (/\bbr\b/.test(accept) && fs.existsSync(`${file}.br`)) {
          servedFile = `${file}.br`;
          encoding = "br";
        } else if (/\bgzip\b/.test(accept) && fs.existsSync(`${file}.gz`)) {
          servedFile = `${file}.gz`;
          encoding = "gzip";
        }

        const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
        if (type) res.setHeader("Content-Type", type);
        if (encoding) res.setHeader("Content-Encoding", encoding);
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader(
          "Cache-Control",
          isAsset ? "public, max-age=31536000, immutable" : "public, max-age=604800"
        );
        res.setHeader("Content-Length", fs.statSync(servedFile).size);
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(servedFile).pipe(res);
      });
    },
  };
}

const swSource = (version, manifest) => `// Generated by vite-plugins/staticAssets.js. Do not edit.
const VERSION = ${JSON.stringify(version)};
const CACHE = "chat-ai-static";
// path -> cache key. Hashed assets key on their path; vendored files that are
// not fingerprinted key on path + content hash, so an update is refetched.
const MANIFEST = new Map(${JSON.stringify(Object.entries(manifest))});

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop entries that no longer belong to the current build.
      const keep = new Set([...MANIFEST.values()].map((k) => new URL(k, self.location.origin).href));
      const cache = await caches.open(CACHE);
      const requests = await cache.keys();
      await Promise.all(requests.filter((r) => !keep.has(r.url)).map((r) => cache.delete(r)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const key = MANIFEST.get(url.pathname);
  if (!key) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        event.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      }
      return response;
    })()
  );
});
`;

function writeServiceWorker(outDir, base, fileName) {
  const manifest = {};
  for (const rel of walk(outDir)) {
    if (rel === fileName) continue;
    // Skip precompressed siblings (TikZJax ships real .gz files of its own).
    const sibling = rel.replace(/\.(br|gz)$/, "");
    if (sibling !== rel && fs.existsSync(path.join(outDir, sibling))) continue;
    const urlPath = `${base}${rel}`;
    if (rel.startsWith("assets/")) {
      manifest[urlPath] = urlPath;
    } else if (VENDORED_DIRS.some((d) => rel.startsWith(d))) {
      const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(outDir, rel)))
        .digest("hex")
        .slice(0, 12);
      manifest[urlPath] = `${urlPath}?v=${hash}`;
    }
  }
  const version = crypto
    .createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex")
    .slice(0, 12);
  fs.writeFileSync(path.join(outDir, fileName), swSource(version, manifest));
}

// Build plugin: writes sw.js, then precompresses everything (sw.js included).
// One plugin, because Rollup runs closeBundle hooks of different plugins in
// parallel and the manifest must not see half-written .br/.gz files.
export function staticAssetsBuild({ swFileName = "sw.js" } = {}) {
  let outDir;
  let base = "/";
  return {
    name: "static-assets-build",
    apply: "build",
    configResolved(config) {
      outDir = resolveOutDir(config);
      base = config.base || "/";
    },
    // Runs after Vite has copied public/, so vendored files are included.
    async closeBundle() {
      writeServiceWorker(outDir, base, swFileName);
      await precompress(outDir);
    },
  };
}
