import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import fs from "fs";
import path from "path";

const ASSET_URL = process.env.ASSET_URL || "";

// Default port if config file is missing or invalid
let port = 8080;

try {
  // Read and parse the JSON file
  const config = JSON.parse(fs.readFileSync("/run/secrets/front", "utf8"));
  console.log("Config loaded from /run/secrets/front:", config);

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
    tailwindcss()
  ],
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
