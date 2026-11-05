import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const piCodingAgent = path.resolve(__dirname, "node_modules/@earendil-works/pi-coding-agent/dist");
const fasterLatexRoot = path.dirname(require.resolve("faster-latex/package.json"));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^pi-coding-agent\//, replacement: `${piCodingAgent}/` },
      {
        find: /^faster-latex-wasm/,
        replacement: path.join(fasterLatexRoot, "web/faster_latex_bg.wasm"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["node_modules", "dist"],
    restoreMocks: true,
    clearMocks: true,
    css: false,
  },
});
