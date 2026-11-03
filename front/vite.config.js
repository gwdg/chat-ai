import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import fs from "fs";
import path from "path";

const ASSET_URL = process.env.ASSET_URL || "";
const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/front.json";

// Default port if config file is missing or invalid
let port = 8080;

try {
  // Read and parse the JSON file
  const config = JSON.parse(fs.readFileSync(CONFIG_LOCATION, "utf8"));
  console.log(`Config loaded from ${CONFIG_LOCATION}:`, config);

  // Extract the port from the config (ensure it's a valid number)
  if (typeof config.port === "number" && config.port > 0) {
    port = config.port;
    console.log("Port:", port);
  } else {
    console.warn(
      "Invalid port in config.json. Falling back to default port 8080."
    );
  }

  // Inject VITE_ variables into the environment
  for (const [key, value] of Object.entries(config)) {
    if (key == "modelsPath") {
      process.env["VITE_MODELS_ENDPOINT"] = value;
      console.log("Models path:", value);
    } else if (key == "backendPath") {
      process.env["VITE_BACKEND_ENDPOINT"] = value;
      console.log("Backend path:", value);
    } else if (key == "userDataPath") {
      process.env["VITE_USERDATA_ENDPOINT"] = value;
      console.log("User data path:", value);
    } else if (key == "default") {
      process.env["VITE_DEFAULT_SETTINGS"] = JSON.stringify(value);
      console.log("Default settings:", JSON.stringify(value));
    } else if (key == "titleGenerationModel") {
      process.env["VITE_TITLE_GENERATION_MODEL"] = value;
      console.log("Title generation model:", value);
    } else if (key == "memoryGenerationModel") {
      process.env["VITE_MEMORY_GENERATION_MODEL"] = value;
      console.log("Memory generation model:", value);
    } else if (key == "proposalGenerationModel") {
      process.env["VITE_PROPOSAL_GENERATION_MODEL"] = value;
      console.log("Proposal generation model:", value);
    } else if (key == "agentPath") {
      process.env["VITE_AGENT_ENDPOINT"] = value;
      console.log("Agent path:", value);
    } else if (key == "agentGatewayTools") {
      process.env["VITE_AGENT_GATEWAY_TOOLS"] = value;
      console.log("Agent gateway tools:", value);
    } else if (key == "explainImageModel") {
      process.env["VITE_EXPLAIN_IMAGE_MODEL"] = value;
      console.log("Explain-image model:", value);
    } else if (key == "announcement") {
      process.env["VITE_ANNOUNCEMENT"] = value;
      console.log("Announcement:", value);
    } else if (key == "modules"){
      console.log("Modules:", JSON.stringify(value));
      try {
        process.env["VITE_MODULE_TOOLS"] = value?.tools || false;
        process.env["VITE_MODULE_FEEDBACK"] = value?.feedback  || false;
        process.env["VITE_MODULE_CHOICES"] = value?.choices  || false;
        process.env["VITE_MODULE_SPEECH"] = JSON.stringify(value?.speech) || false;
      } catch (e) {
        console.log("Error while parsing modules: ", e)
      }
    }
  }
} catch (error) {
  console.error("Failed to load config.json:", error);
  process.exit(1);
}

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
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodeShimsPlugin(),
    codemodeWithoutIsolation(),
  ],
  resolve: {
    alias: [{ find: /^pi-coding-agent\//, replacement: `${piCodingAgent}/` }],
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
  },
  preview: {
    port: port,
    open: false,
  },
});
