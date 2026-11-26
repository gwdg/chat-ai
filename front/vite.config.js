import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { servePrecompressed, staticAssetsBuild } from "./vite-plugins/staticAssets.js";

const require = createRequire(import.meta.url);
const fasterLatexRoot = path.dirname(
  require.resolve("faster-latex/package.json")
);

const TIKZ_CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// Serve /tikzjax directly from disk. Vite's public-dir cache can keep serving
// index.html after copy-tikzjax.mjs recreates the directory, which makes the
// worker load HTML as JavaScript. A missing asset must be a 404, never the SPA
// fallback.
const serveTikzAssets = (middlewares) => {
  middlewares.use((req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (!url.startsWith("/tikzjax/")) return next();

    const root = path.resolve(process.cwd(), "public", "tikzjax");
    const file = path.resolve(root, "." + url.slice("/tikzjax".length));
    if (!file.startsWith(root + path.sep)) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        res.statusCode = 404;
        return res.end("Not found");
      }
      if (file.endsWith(".gz")) {
        res.setHeader("Content-Type", "application/gzip");
        res.setHeader("Content-Encoding", "identity");
      } else {
        const type = TIKZ_CONTENT_TYPES[path.extname(file).toLowerCase()];
        if (type) res.setHeader("Content-Type", type);
      }
      res.end(data);
    });
  });
};

const tikzAssetsPlugin = {
  name: "serve-tikzjax-gzip",
  configureServer(server) {
    serveTikzAssets(server.middlewares);
  },
  configurePreviewServer(server) {
    serveTikzAssets(server.middlewares);
  },
};

const ASSET_URL = process.env.ASSET_URL || "";
const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/front.json";

// Default port if config file is missing or invalid
let port = 8080;

try {
  // Read and parse the JSON file
  const config = JSON.parse(fs.readFileSync(CONFIG_LOCATION, "utf8"));
  console.log(`Config loaded from ${CONFIG_LOCATION}`);

  // Extract the port from the config (ensure it's a valid number)
  if (typeof config.port === "number" && config.port > 0) {
    port = config.port;
    console.log("Port:", port);
  } else {
    console.warn(
      "Invalid port in config.json. Falling back to default port 8080."
    );
  }

  // The browser agent is on unless front.json sets modules.agent to false
  process.env["VITE_MODULE_AGENT"] = "true";

  // Inject VITE_ variables into the environment
  for (const [key, value] of Object.entries(config)) {
    if (key == "deployment") {
      process.env["VITE_DEPLOYMENT"] = value;
      console.log("Deployment:", value);
    } else if (key == "modelsPath") {
      process.env["VITE_MODELS_ENDPOINT"] = value;
      console.log("Models path:", value);
    } else if (key == "backendPath") {
      process.env["VITE_BACKEND_ENDPOINT"] = value;
      console.log("Backend path:", value);
    } else if (key == "userDataPath") {
      process.env["VITE_USERDATA_ENDPOINT"] = value;
      console.log("User data path:", value);
    } else if (key == "feedbackPath") {
      // Where the footer's bug report form posts. Empty hides the entry point.
      // `back` serves `/feedback` and forwards the body to `feedbackEndpoint`
      // from back.json; a SAIA deployment points this at an app-visible path
      // that its gateway forwards to the registry's `saia-feedback` tunnel,
      // exactly like `saia-fs`. Either way a third-party URL (and its token)
      // stays out of the bundle.
      process.env["VITE_FEEDBACK_ENDPOINT"] = String(value ?? "");
      console.log("Feedback path:", value || "none (bug report hidden)");
    } else if (key == "apiKey") {
      // Optional bearer token for endpoints without the OIDC proxy. Never log
      // the value: config output ends up in logs and terminals.
      process.env["VITE_API_KEY"] = value;
      console.log("API key configured:", Boolean(value));
    } else if (key == "fakeAuthHeaders") {
      // Fixed identity headers for a direct endpoint, e.g. the oidc_claim_*
      // headers the engine's /assumes_behind_oidc app expects. This makes the
      // browser impersonate that user, so only use it against a local/test
      // endpoint. Header names are logged, values are not.
      process.env["VITE_FAKE_AUTH_HEADERS"] = JSON.stringify(value);
      console.log(
        "Fake auth headers:",
        value && typeof value === "object" ? Object.keys(value).join(", ") : "none"
      );
    } else if (key == "default") {
      process.env["VITE_DEFAULT_SETTINGS"] = JSON.stringify(value);
      console.log("Default settings:", JSON.stringify(value));
    } else if (key == "userSettings") {
      // Defaults for the Redux `user_settings` store, applied only to a fresh profile or
      // after a reset (persisted settings win). Log the keys only: `mcp_servers` may
      // carry authorization headers, and config output ends up in logs.
      process.env["VITE_USER_SETTINGS"] = JSON.stringify(value);
      console.log(
        "User settings:",
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.keys(value).join(", ") || "none"
          : "invalid (expected an object)"
      );
    } else if (key == "titleGenerationModel") {
      process.env["VITE_TITLE_GENERATION_MODEL"] = value;
      console.log("Title generation model:", value);
    } else if (key == "memoryGenerationModel") {
      process.env["VITE_MEMORY_GENERATION_MODEL"] = value;
      console.log("Memory generation model:", value);
    } else if (key == "proposalGenerationModel") {
      process.env["VITE_PROPOSAL_GENERATION_MODEL"] = value;
      console.log("Proposal generation model:", value);
    } else if (key == "agentGatewayTools") {
      process.env["VITE_AGENT_GATEWAY_TOOLS"] = value;
      console.log("Agent gateway tools:", value);
    } else if (key == "useOpenAISdk") {
      process.env["VITE_USE_OPENAI_SDK"] = value === true ? "true" : "false";
      console.log("Use openai SDK:", value === true);
    } else if (key == "opencodeServerUrl") {
      process.env["VITE_OPENCODE_SERVER_URL"] = value;
      console.log("opencode server URL:", value);
    } else if (key == "opencodeServerUsername") {
      process.env["VITE_OPENCODE_SERVER_USERNAME"] = value;
      console.log("opencode server username:", value);
    } else if (key == "opencodeServerPassword") {
      process.env["VITE_OPENCODE_SERVER_PASSWORD"] = value;
      console.log("opencode server password:", value ? "set" : "not set");
    } else if (key == "opencodeBridgeSidecarCommand") {
      process.env["VITE_OPENCODE_BRIDGE_SIDECAR_COMMAND"] = JSON.stringify(value);
      console.log("opencode bridge sidecar:", JSON.stringify(value));
    } else if (key == "bridgeKey") {
      // Shared with `bridgeSharedSecret` in back.json. It ships inside the bundle,
      // so it only stops a client that reaches the backend directly; the OIDC
      // gateway stays the real boundary. Never log the value.
      process.env["VITE_BRIDGE_KEY"] = String(value ?? "");
      console.log("Bridge key:", value ? "set" : "not set");
    } else if (key == "bridgePath") {
      // Where a *direct* agent's `/bridge/*` lives when that is not `backendPath`:
      // a local test stack talks to the engine directly and has no bridge there,
      // while `back` still serves it. Empty means "use backendPath".
      process.env["VITE_BRIDGE_PATH"] = String(value ?? "");
      console.log("Bridge path:", value || "backendPath");
    } else if (key == "agentServiceMode") {
      // "tunnel" reaches the agent service through the model endpoint, for a
      // deployment whose gateway forwards only `saia-agent` and has no `/agents`
      // route. Empty/unset keeps the plain `/agents` path.
      process.env["VITE_AGENT_SERVICE_MODE"] = value || "";
      console.log("Agent service mode:", value || "direct");
    } else if (key == "agentServiceModel") {
      // The model that carries a tunneled request; the service's own id.
      process.env["VITE_AGENT_SERVICE_MODEL"] = value;
      console.log("Agent service model:", value);
    } else if (key == "explainImageModel") {
      process.env["VITE_EXPLAIN_IMAGE_MODEL"] = value;
      console.log("Explain-image model:", value);
    } else if (key == "e2eeKeyUrl") {
      // Where the published `.pub` files of the model nodes live. The app only
      // reads it, and the compression/static pipeline does not touch it.
      process.env["VITE_E2EE_KEY_URL"] = value;
      console.log("E2EE key URL:", value);
    } else if (key == "announcement") {
      process.env["VITE_ANNOUNCEMENT"] = value;
      console.log("Announcement:", value);
    } else if (key == "modules"){
      console.log("Modules:", JSON.stringify(value));
      try {
        process.env["VITE_MODULE_TOOLS"] = value?.tools || false;
        process.env["VITE_MODULE_FEEDBACK"] = value?.feedback  || false;
        process.env["VITE_MODULE_CHOICES"] = value?.choices  || false;
        process.env["VITE_MODULE_AGENT"] = value?.agent ?? true;
        process.env["VITE_MODULE_AGENTS"] = value?.agents ?? true;
        process.env["VITE_MODULE_ARCANAS"] = value?.arcanas ?? true;
        process.env["VITE_MODULE_SPEECH"] = JSON.stringify(value?.speech) || false;
        process.env["VITE_MODULE_SYNC"] = value?.sync ?? false;
      } catch (e) {
        console.log("Error while parsing modules: ", e)
      }
    }
  }
} catch (error) {
  console.error("Failed to load config.json:", error);
  process.exit(1);
}

// The engine's Chat AI compatibility app lives under /assumes_behind_oidc and is
// same-origin with the front in a deployment (Apache routes both). In local
// development the front is on :8080 and the engine on :10000, so proxy that path
// to the configured backend origin. A relative backendPath is already
// same-origin and needs no proxy.
let oidcProxy;
try {
  oidcProxy = {
    "/assumes_behind_oidc": {
      target: new URL(process.env["VITE_BACKEND_ENDPOINT"]).origin,
      changeOrigin: true,
    },
  };
} catch {
  oidcProxy = undefined;
}

// The agent service is addressed on the app's own origin (`/agents`), exactly as
// the SAIA gateway serves it in a deployment, so the browser never needs a
// service URL or port. A dev server has no gateway in front of it, so it can
// forward that path to a local service — only when `AGENT_SERVICE_DEV_PROXY`
// names one. There is deliberately no default: the app must not assume that a
// service is listening on a fixed local port. Preview/production builds get the
// prefix from the gateway, never from this proxy.
const AGENT_SERVICE_DEV_TARGET = (process.env.AGENT_SERVICE_DEV_PROXY || "").trim();

// pi's tool modules, and some of their dependencies, import Node built-ins at load time even
// though the agent replaces their file access (see src/agent/tools.ts). Map them to browser
// stand-ins; without this Vite substitutes empty modules that throw on first use.
const shimDir = path.resolve(__dirname, "src/agent/shims");
const nodeShims = { fs: "fs.ts", "fs/promises": "fs.ts", path: "path.ts", worker_threads: "worker_threads.ts" };
for (const name of ["child_process", "readline", "os", "url", "module", "util", "crypto", "perf_hooks", "stream", "stream/promises", "zlib", "events"]) nodeShims[name] = "node-misc.ts";
// Only pi and the dependencies of it that import built-ins get the stand-ins; everything else
// resolves as usual, so an npm package named like a built-in (e.g. "events") stays itself.
const SHIMMED_IMPORTERS = /[\\/]node_modules[\\/](@earendil-works[\\/][^\\/]+|cross-spawn|isexe|which|@silvia-odwyer[\\/]photon-node)[\\/]|[\\/]src[\\/]agent[\\/]/;
const shimFor = (source, importer) => {
  if (!importer || !SHIMMED_IMPORTERS.test(importer)) return undefined;
  const file = nodeShims[source.replace(/^node:/, "")];
  return file && path.join(shimDir, file);
};
// For the build and for unbundled modules in dev
function nodeShimsPlugin() {
  return { name: "node-shims", enforce: "pre", resolveId: (source, importer) => shimFor(source, importer) };
}
// For dependencies pre-bundled by the dev server
const nodeShimsEsbuild = {
  name: "node-shims",
  setup(build) {
    build.onResolve({ filter: /^(node:)?[a-z_/]+$/ }, (args) => {
      const file = shimFor(args.path, args.importer);
      return file ? { path: file } : undefined;
    });
  },
};
// pi-codemode flags interrupts through a SharedArrayBuffer, which browsers only provide on
// cross-origin isolated pages (COOP/COEP headers, which would break cross-origin content here).
// It also terminates the worker on every finish and timeout, so a plain ArrayBuffer is enough.
function codemodeWithoutIsolation() {
  return {
      name: "codemode-without-isolation",
      transform(code, id) {
        if (id.includes("pi-codemode/dist/runtime/host.js"))
          return code.replace("new SharedArrayBuffer(4)", "new (globalThis.SharedArrayBuffer ?? ArrayBuffer)(4)");
      },
    };
  }
const codemodeEsbuild = {
  name: "codemode-without-isolation",
  setup(build) {
    build.onLoad({ filter: /pi-codemode[\\/]dist[\\/]runtime[\\/]host\.js$/ }, async (args) => ({
      contents: fs
        .readFileSync(args.path, "utf8")
        .replace("new SharedArrayBuffer(4)", "new (globalThis.SharedArrayBuffer ?? ArrayBuffer)(4)"),
      loader: "js",
    }));
  },
};
// pi-coding-agent only exports its Node entry point; the agent imports its tool modules directly.
const piCodingAgent = path.resolve(__dirname, "node_modules/@earendil-works/pi-coding-agent/dist");

// Export the Vite config
export default defineConfig(({ mode }) => {
  // The local agent service stands in for the gateway only in the dev server, and only
  // when it was named explicitly (see AGENT_SERVICE_DEV_TARGET).
  const proxy = {
    ...(oidcProxy ?? {}),
    ...(mode === "development" && AGENT_SERVICE_DEV_TARGET
      ? {
          "/agents": {
            target: AGENT_SERVICE_DEV_TARGET,
            changeOrigin: true,
            // The browser bridge keeps a WebSocket open under this prefix.
            ws: true,
          },
        }
      : {}),
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      nodeShimsPlugin(),
      codemodeWithoutIsolation(),
      tikzAssetsPlugin,
      servePrecompressed(),
      staticAssetsBuild(),
    ],
    resolve: {
      alias: [
        { find: /^pi-coding-agent\//, replacement: `${piCodingAgent}/` },
        {
          find: /^faster-latex-wasm/,
          replacement: path.join(fasterLatexRoot, "web/faster_latex_bg.wasm"),
        },
        {
          find: /^html2canvas$/,
          replacement: path.resolve(__dirname, "src/utils/emptyHtml2canvas.js"),
        },
      ],
    },
    optimizeDeps: {
      include: ["@earendil-works/pi-codemode/worker"],
      esbuildOptions: { plugins: [nodeShimsEsbuild, codemodeEsbuild] },
    },
    // The codemode worker is an ES module
    worker: { format: "es", plugins: () => [nodeShimsPlugin(), codemodeWithoutIsolation()] },
    base: "/",
    server: {
      port: port,
      open: false,
      ...(Object.keys(proxy).length ? { proxy } : {}),
    },
    preview: {
      port: port,
      open: false,
      ...(Object.keys(proxy).length ? { proxy } : {}),
    },
  };
});
