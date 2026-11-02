import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const fasterLatexRoot = path.dirname(
  require.resolve("faster-latex/package.json")
);

const serveTikzGzip = (middlewares) => {
  middlewares.use((req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (!url.startsWith("/tikzjax/") || !url.endsWith(".gz")) {
      return next();
    }

    // Only serve files inside public/tikzjax/ (reject ../ traversal).
    const root = path.resolve(process.cwd(), "public", "tikzjax");
    let file;
    try {
      file = path.resolve(process.cwd(), "public", "." + decodeURIComponent(url));
    } catch {
      return next();
    }
    if (!file.startsWith(root + path.sep)) return next();
    fs.readFile(file, (error, data) => {
      if (error) return next();
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Encoding", "identity");
      res.end(data);
    });
  });
};

// Dev server only. Production serves dist/ statically (nginx), which must
// deliver /tikzjax/*.gz as raw gzip bytes (no Content-Encoding: gzip).
const tikzAssetsPlugin = {
  name: "serve-tikzjax-gzip",
  configureServer(server) {
    serveTikzGzip(server.middlewares);
  },
};

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

// Export the Vite config
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tikzAssetsPlugin
  ],
  base: "/",
  resolve: {
    alias: [
      {
        find: /^faster-latex-wasm/,
        replacement: path.join(fasterLatexRoot, "web/faster_latex_bg.wasm"),
      },
    ],
  },
  server: {
    port: port,
    open: false,
  },
  preview: {
    port: port,
    open: false,
  },
});
