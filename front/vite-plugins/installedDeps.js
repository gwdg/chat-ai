// Guard against building from a stale dependency tree.
//
// Vite writes the output chunks and only then reports an import it could not
// resolve, so a `node_modules` that predates the lockfile — the case with the
// persistent volume in docker-compose.yml — leaves a servable bundle behind in
// which a dynamic import keeps its bare specifier. The browser then throws
// `Failed to resolve module specifier "pkg"` the first time that code runs.
//
// This check runs while the Vite config is read, before the output directory is
// emptied, so a stale tree fails the build instead of replacing a good bundle.
import fs from "node:fs";
import path from "node:path";

/** Package paths the lockfile requires on disk, ignoring platform-optional ones. */
export const requiredPackagePaths = (lock) =>
  Object.entries(lock?.packages ?? {})
    .filter(
      ([rel, meta]) =>
        rel.startsWith("node_modules/") &&
        meta &&
        !meta.link &&
        !meta.optional &&
        Boolean(meta.version),
    )
    .map(([rel]) => rel);

/** Lockfile package paths whose directory is missing under `root`. */
export const missingPackages = (lock, root) =>
  requiredPackagePaths(lock).filter(
    (rel) => !fs.existsSync(path.join(root, rel, "package.json")),
  );

/**
 * Throws when `node_modules` is older than `package-lock.json`. Returns the
 * number of packages checked so callers can log it.
 */
export const assertInstalledDependencies = (root) => {
  const lockFile = path.join(root, "package-lock.json");
  if (!fs.existsSync(lockFile)) return 0;
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  const missing = missingPackages(lock, root);
  if (missing.length) {
    const names = missing
      .slice(0, 10)
      .map((rel) => `  ${rel.replace(/^node_modules\//, "")}`)
      .join("\n");
    const more = missing.length > 10 ? `\n  … and ${missing.length - 10} more` : "";
    throw new Error(
      `node_modules is older than package-lock.json: ${missing.length} package(s) are not installed:\n` +
        `${names}${more}\n` +
        `Run "npm ci" in front/ first. A bundle built from this tree keeps bare ` +
        `imports the browser cannot resolve.`,
    );
  }
  return requiredPackagePaths(lock).length;
};
