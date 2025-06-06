import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';

const ASSET_URL = process.env.ASSET_URL || '';

// Default port if config file is missing or invalid
let port = 8080;

try {
  // Read and parse the JSON file
  const config = JSON.parse(fs.readFileSync('/run/secrets/front', 'utf8'));

  // Extract the port from the config (ensure it's a valid number)
  if (typeof config.port === 'number' && config.port > 0) {
    port = config.port;
  } else {
    console.warn('Invalid port in config.json. Falling back to default port 8080.');
  }

  // Inject VITE_ variables into the environment
  for (const [key, value] of Object.entries(config)) {
    if (key == 'modelsPath') {
      process.env["VITE_MODELS_ENDPOINT"] = value;
    }
    else if (key == 'backendPath') {
      process.env["VITE_BACKEND_ENDPOINT"] = value;
    }
    else if (key == 'userDataPath') {
      process.env["VITE_USERDATA_ENDPOINT"] = value;
    }
  }
}
 catch (error) {
  console.error('Failed to load config.json:', error);
  process.exit(1);
}

// Export the Vite config
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: port,
    open: false,
  },
  preview: {
    port: port,
    open: false,
  },
});