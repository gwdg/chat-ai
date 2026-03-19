import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import fs from "fs";
/** @typedef {import("../secrets/front.config").FrontConfig} FrontConfig */
const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/front.ts";

function loadTsConfigObject(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const configMatch = source.match(/export\s+const\s+config(?:\s*:\s*[\w<>,\[\]\s.|&?]+)?\s*=\s*({[\s\S]*})\s*;?\s*$/);

  if (!configMatch) {
    throw new Error(`Could not find 'export const config = { ... }' in ${filePath}`);
  }

  return Function(`"use strict"; return (${configMatch[1]});`)();
}

let config;
try {
  /** @type {FrontConfig} */
  config = loadTsConfigObject(CONFIG_LOCATION);
  console.log(`Config loaded from ${CONFIG_LOCATION}:`, config);
} catch (error) {
  console.error("Failed to load TypeScript config:", error);
  process.exit(1);
}

const port = typeof config.port === "number" && config.port > 0 ? config.port : 8080;
const modules = config.modules || {};

const defineEnv = {
  __MODELS_ENDPOINT__: JSON.stringify(config.modelsPath ?? ""),
  __BACKEND_ENDPOINT__: JSON.stringify(config.backendPath ?? ""),
  __USERDATA_ENDPOINT__: JSON.stringify(config.userDataPath ?? ""),
  __DEFAULT_SETTINGS__: JSON.stringify(config.default ?? {}),
  __TITLE_GENERATION_MODEL__: JSON.stringify(config.titleGenerationModel ?? ""),
  __MEMORY_GENERATION_MODEL__: JSON.stringify(config.memoryGenerationModel ?? ""),
  __PROPOSAL_GENERATION_MODEL__: JSON.stringify(config.proposalGenerationModel ?? ""),
  __ANNOUNCEMENT__: JSON.stringify(config.announcement ?? ""),
  __MODULE_TOOLS__: JSON.stringify(Boolean(modules.tools || false)),
  __MODULE_FEEDBACK__: JSON.stringify(Boolean(modules.feedback || false)),
  __MODULE_CHOICES__: JSON.stringify(Boolean(modules.choices || false)),
};

// Export the Vite config
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  define: defineEnv,
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
