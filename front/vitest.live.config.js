// Runs the live tests only: `npm run test:live`.
//
// A live test talks to a real process (an `opencode serve` instance) instead of a
// stubbed `fetch`, so it is excluded from `npm test`. This config reuses the unit-test
// setup and only changes which files are collected and how long a hook may take.
import { defineConfig } from "vitest/config";

import baseConfig from "./vitest.config.js";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["src/**/*.live.test.{js,jsx,ts,tsx}"],
    exclude: ["node_modules", "dist"],
    // Booting the server and running a shell command outlast the default budget.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
