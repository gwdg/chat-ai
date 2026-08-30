import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';
import fs from "fs";
import path from "path";

const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/front.ts";

let config;

const viteConfigDir = new URL('.', import.meta.url).pathname;
const resolvedPath = path.resolve(viteConfigDir, CONFIG_LOCATION);

if(CONFIG_LOCATION.endsWith(".ts") || CONFIG_LOCATION.endsWith(".js")) {
  console.log(`Loading config from ${CONFIG_LOCATION} as a module...`);
  // Load config from .ts or .js file using dynamic import
  config = (await import(resolvedPath)).default;
} else {
  console.warn(`CONFIG_LOCATION ${CONFIG_LOCATION} does not end with .ts or .js. Defaulting to JSON parsing.`);
  // Load config as JSON by default
  config = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
}

const port = typeof config.port === "number" && config.port > 0 ? config.port : 8080;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  define: {
    __GLOBAL_CONFIG__: JSON.stringify(config),
  },
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
