import type { Extension } from "@codemirror/state";

/**
 * A grammar the workspace editor can highlight. The id doubles as the loader key,
 * so the editor imports only the grammar a file actually needs — each one is its
 * own lazily fetched chunk.
 */
export type EditorLanguageId =
  | "javascript"
  | "jsx"
  | "typescript"
  | "tsx"
  | "json"
  | "python"
  | "html"
  | "css"
  | "markdown"
  | "xml"
  | "sql"
  | "yaml"
  | "cpp"
  | "java"
  | "rust"
  | "go"
  | "shell"
  | "toml"
  | "properties"
  | "diff"
  | "latex"
  | "plain";

const LOADERS: Record<EditorLanguageId, () => Promise<Extension>> = {
  javascript: async () =>
    (await import("@codemirror/lang-javascript")).javascript(),
  jsx: async () =>
    (await import("@codemirror/lang-javascript")).javascript({ jsx: true }),
  typescript: async () =>
    (await import("@codemirror/lang-javascript")).javascript({
      typescript: true,
    }),
  tsx: async () =>
    (await import("@codemirror/lang-javascript")).javascript({
      typescript: true,
      jsx: true,
    }),
  json: async () => (await import("@codemirror/lang-json")).json(),
  python: async () => (await import("@codemirror/lang-python")).python(),
  html: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),
  xml: async () => (await import("@codemirror/lang-xml")).xml(),
  sql: async () => (await import("@codemirror/lang-sql")).sql(),
  yaml: async () => (await import("@codemirror/lang-yaml")).yaml(),
  cpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  java: async () => (await import("@codemirror/lang-java")).java(),
  rust: async () => (await import("@codemirror/lang-rust")).rust(),
  go: async () => (await import("@codemirror/lang-go")).go(),
  // The legacy modes are StreamParsers, not Lezer grammars: `StreamLanguage.define`
  // wraps one, and each mode is its own module so only the used ones load.
  shell: async () => {
    const [{ StreamLanguage }, { shell }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/shell"),
    ]);
    return StreamLanguage.define(shell);
  },
  toml: async () => {
    const [{ StreamLanguage }, { toml }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/toml"),
    ]);
    return StreamLanguage.define(toml);
  },
  properties: async () => {
    const [{ StreamLanguage }, { properties }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/properties"),
    ]);
    return StreamLanguage.define(properties);
  },
  diff: async () => {
    const [{ StreamLanguage }, { diff }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/diff"),
    ]);
    return StreamLanguage.define(diff);
  },
  latex: async () => {
    const [{ StreamLanguage }, { stex }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/stex"),
    ]);
    return StreamLanguage.define(stex);
  },
  plain: async () => [],
};

const BY_EXTENSION: Record<string, EditorLanguageId> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  json: "json",
  jsonc: "json",
  json5: "json",
  webmanifest: "json",
  py: "python",
  pyi: "python",
  html: "html",
  htm: "html",
  xhtml: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  md: "markdown",
  markdown: "markdown",
  xml: "xml",
  svg: "xml",
  plist: "xml",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  c: "cpp",
  h: "cpp",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  java: "java",
  rs: "rust",
  go: "go",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ksh: "shell",
  toml: "toml",
  ini: "properties",
  cfg: "properties",
  conf: "properties",
  properties: "properties",
  env: "properties",
  diff: "diff",
  patch: "diff",
  tex: "latex",
  sty: "latex",
  cls: "latex",
};

/** The grammar a file name asks for, or `plain` when nothing fits. */
export function editorLanguageFor(name: string | undefined): EditorLanguageId {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "plain";
  return BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? "plain";
}

/** Loads the grammar's extension; a missing or failed grammar leaves plain text. */
export async function loadEditorLanguage(
  id: EditorLanguageId,
): Promise<Extension> {
  try {
    return await LOADERS[id]();
  } catch {
    return [];
  }
}
