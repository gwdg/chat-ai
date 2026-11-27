/**
 * The files a Typst document loads, so a host can read them before compiling.
 *
 * typst.ts reaches its sources through a synchronous filesystem hook
 * (`FsAccessModel.readAll`), so a workspace provider — whose reads are async —
 * cannot answer during compilation. The references are parsed from the source
 * here instead, read through a caller-supplied resolver, and mounted as shadow
 * files. That is also why the compile root belongs to the caller: a document and
 * everything it includes sit in one virtual tree.
 */

export interface TypstFile {
  path: string;
  data: Uint8Array;
}

export interface TypstFileSet {
  files: TypstFile[];
  missing: string[];
  /** A cap stopped the walk, so not every reference was read. */
  truncated: boolean;
}

export interface TypstCollectOptions {
  /** Reads one virtual path; `null`/`undefined` means "not there". */
  resolveFile?: (path: string) => Promise<Uint8Array | null | undefined>;
  mainPath?: string;
  maxFiles?: number;
  maxBytes?: number;
}

const MAX_FILES = 200;
const MAX_BYTES = 8 * 1024 * 1024;

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// `#include "x.typ"`, `#include("x.typ")`, `#image("a.png")`, `#csv("d.csv")`,
// `#bibliography(("a.bib", "b.bib"))` and `#import "utils.typ": *`. Package
// imports (`@preview/...`) are filtered out by the resolver.
const REFERENCE =
  /#(include|image|read|csv|json|yaml|toml|cbor|bibliography|import)\s*\(*\s*"([^"\\]*)"/g;

/** A Typst file by name, for hosts that only know the name and MIME type. */
export const isTypstFileName = (
  name?: string | null,
  mime?: string | null,
): boolean =>
  mime === "text/typst" ||
  mime === "application/x-typst" ||
  /\.(typ|typst)$/i.test(name ?? "");

/** The paths a Typst source references, as written (relative or absolute). */
export const typstFileReferences = (source: string): string[] => {
  const references: string[] = [];
  for (const match of String(source ?? "").matchAll(REFERENCE)) {
    references.push(match[2]);
  }
  return references;
};

/**
 * Resolves one reference against the referencing file's directory, the way
 * Typst does: absolute paths are from the compile root, relative ones from the
 * file that names them. URLs, package specs and paths that climb above the root
 * are not readable files.
 */
export const resolveTypstPath = (
  fromDir: string,
  reference: string,
): string | null => {
  const path = String(reference ?? "").trim();
  if (!path) return null;
  if (path.startsWith("@")) return null;
  if (URL_SCHEME.test(path)) return null;

  const parts: string[] = [];
  const joined = path.startsWith("/") ? path : `${fromDir}/${path}`;
  for (const part of joined.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      // Leaving the root is not a file Typst may read.
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  if (!parts.length) return null;
  return `/${parts.join("/")}`;
};

/** FNV-1a over the bytes; only distinguishes cache entries from each other. */
const hashBytes = (data: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
};

/**
 * The cache key of one rendered document. Inline source keeps the plain content
 * (so a fenced block is unchanged); a file that loads siblings also depends on
 * their contents.
 */
export const typstSignature = (
  content: string,
  files: TypstFile[],
): string => {
  if (!files.length) return content;
  const parts = files.map(
    (file) => `${file.path}:${file.data.byteLength}:${hashBytes(file.data)}`,
  );
  return `${content}\u0000${parts.join("|")}`;
};

/**
 * Walks the document's references, reads what it loads and recurses into `.typ`
 * siblings, which can reference more. Without a resolver there is nothing to
 * read, so the inline source is all there is.
 */
export const collectTypstFiles = async (
  content: string,
  {
    resolveFile,
    mainPath = "/main.typ",
    maxFiles = MAX_FILES,
    maxBytes = MAX_BYTES,
  }: TypstCollectOptions = {},
): Promise<TypstFileSet> => {
  const files: TypstFile[] = [];
  const missing: string[] = [];
  if (!resolveFile) return { files, missing, truncated: false };

  const decoder = new TextDecoder();
  const seen = new Set<string>([mainPath]);
  const queue: { path: string; source: string }[] = [
    { path: mainPath, source: String(content ?? "") },
  ];
  let bytes = 0;
  let truncated = false;

  while (queue.length) {
    const current = queue.shift() as { path: string; source: string };
    const slash = current.path.lastIndexOf("/");
    const dir = slash > 0 ? current.path.slice(0, slash) : "/";

    for (const reference of typstFileReferences(current.source)) {
      const path = resolveTypstPath(dir, reference);
      if (!path || seen.has(path)) continue;
      seen.add(path);

      if (files.length >= maxFiles || bytes >= maxBytes) {
        truncated = true;
        continue;
      }

      let data: Uint8Array | null | undefined;
      try {
        data = await resolveFile(path);
      } catch {
        data = null;
      }
      if (!data) {
        missing.push(path);
        continue;
      }

      files.push({ path, data });
      bytes += data.byteLength;
      if (/\.typ$/i.test(path)) {
        queue.push({ path, source: decoder.decode(data) });
      }
    }
  }

  return { files, missing, truncated };
};
