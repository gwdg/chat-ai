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

// TikZJax's worker wrapper treats every absolute URL as cross-origin and loads
// it through a blob worker with importScripts(). Same-origin assets can be
// passed to `new Worker()` directly, which avoids CSP/private-network failures
// in deployments that reject importScripts. Keep the cross-origin fallback.
const workerUrlPattern =
  "const o=e=>/^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(e);";
const workerUrlReplacement =
  "const o=e=>{if(typeof e!==\"string\"||!/^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(e))return false;try{return new URL(e).origin!==self.location.origin}catch{return true}};";

for (const file of ["tikzjax.js", "tikzjax.min.js"]) {
  const filePath = path.join(target, file);
  const contents = fs.readFileSync(filePath, "utf8");
  if (!contents.includes(workerUrlPattern)) {
    throw new Error(`TikZJax worker URL pattern not found in ${file}`);
  }
  fs.writeFileSync(
    filePath,
    contents.replace(workerUrlPattern, workerUrlReplacement)
  );
}

console.log(`Copied TikZJax assets to ${target}`);
