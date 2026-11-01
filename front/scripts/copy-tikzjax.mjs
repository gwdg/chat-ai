import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageRoot = path.dirname(
  require.resolve("@rod2ik/tikzjax/package.json")
);
const source = path.join(packageRoot, "dist");
const target = path.join(process.cwd(), "public", "tikzjax");

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: (file) => !file.endsWith(".map"),
});
fs.copyFileSync(
  path.join(packageRoot, "LICENSE"),
  path.join(target, "LICENSE")
);

console.log(`Copied TikZJax assets to ${target}`);
