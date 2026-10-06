import fs from "fs";
import path from "path";
import { parse } from "yaml";
import type { Plugin } from "vite";

// A text value is either a plain string or a map of language code -> string.
export type Localized = string | Record<string, string>;

export interface Branding {
  active: boolean; // true if any branding directory is configured
  browserTab?: {
    title?: Localized; // replaces "Chat AI" in the browser tab title
    favicon?: string; // URL under /branding/
  };
  header?: {
    logo?: string; // URL under /branding/
    logoAlt?: string;
    title?: Localized;
    subtitle?: Localized;
    textColor?: string; // CSS color of title and subtitle
    backgroundColor?: string; // CSS color of the header bar
  };
  disclaimer?: Localized; // HTML content, shown on new conversations
  chatDisclaimer?: Localized; // HTML content, shown at the top of active conversations
  footer?: {
    help?: Localized; // URL of the help link
  };
  systemPrompt?: string; // Markdown content; unset means config.default.messages applies
}

const URL_PREFIX = "/branding/";
const CONFIG_FILE = "branding.yaml";
// Only this subfolder of a branding directory is served under URL_PREFIX
const PUBLIC_DIR = "public";

const MIME_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".css": "text/css",
  ".html": "text/html",
};

function mapLocalized(value: Localized, fn: (v: string) => string): Localized {
  if (typeof value === "string") return fn(value);
  // Skip empty entries (e.g. "en:" without a value)
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v).map(([lang, v]) => [lang, fn(v)]));
}

function readFileIn(dir: string, file: string): string {
  const resolved = path.resolve(dir, file);
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error(`Branding file ${file} is outside of ${dir}`);
  }
  return fs.readFileSync(resolved, "utf8");
}

// Checks that a file referenced in branding.yaml exists in the public
// subfolder and returns its URL, e.g. "public/logo.svg" -> "/branding/logo.svg"
function publicUrl(dir: string, file: string): string {
  const publicDir = path.join(dir, PUBLIC_DIR);
  const resolved = path.resolve(dir, file);
  if (!resolved.startsWith(publicDir + path.sep)) {
    throw new Error(`Branding file ${file} must be in the ${PUBLIC_DIR}/ folder to be served`);
  }
  readFileIn(dir, file); // fail early if missing
  return URL_PREFIX + path.relative(publicDir, resolved).split(path.sep).join("/");
}

// Reads <dir>/branding.yaml and resolves file references: the logo becomes a
// URL under /branding/, HTML and Markdown files are inlined.
export function loadBranding(dir: string | undefined): Branding {
  if (!dir) return { active: false };
  const configFile = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(configFile)) {
    throw new Error(`Branding not found: ${configFile} does not exist (check overrides.branding in the front config)`);
  }
  const raw = parse(fs.readFileSync(configFile, "utf8")) ?? {};
  const branding: Branding = { active: true };

  if (raw.browserTab) {
    branding.browserTab = { ...raw.browserTab };
    if (raw.browserTab.favicon) {
      branding.browserTab.favicon = publicUrl(dir, raw.browserTab.favicon);
    }
  }
  if (raw.header) {
    branding.header = { ...raw.header };
    if (raw.header.logo) {
      branding.header.logo = publicUrl(dir, raw.header.logo);
    }
  }
  if (raw.disclaimer) {
    branding.disclaimer = mapLocalized(raw.disclaimer, (file) => readFileIn(dir, file));
  }
  if (raw.footer?.help) {
    // Either an external URL or a file in the public folder
    branding.footer = { help: mapLocalized(raw.footer.help, (value) =>
      /^https?:\/\//.test(value) ? value : publicUrl(dir, value)
    ) };
  }
  if (raw.chatDisclaimer) {
    branding.chatDisclaimer = mapLocalized(raw.chatDisclaimer, (file) => readFileIn(dir, file));
  }
  if (raw.systemPrompt) {
    // Optional: on any problem, fall back to the system prompt from the front config
    try {
      const prompt = readFileIn(dir, raw.systemPrompt).trim();
      if (prompt) branding.systemPrompt = prompt;
      else console.warn(`Branding system prompt ${raw.systemPrompt} is empty, using front config`);
    } catch (error) {
      console.warn(`Could not load branding system prompt ${raw.systemPrompt}, using front config: ${error.message}`);
    }
  }
  return branding;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Serves the public subfolder of the branding directory under /branding/ in
// dev and copies it into the build output, so it is also available via
// `vite preview`. Also sets the
// initial tab title and favicon in index.html.
export function brandingPlugin(dir: string | undefined, branding: Branding): Plugin {
  return {
    name: "chat-ai-branding",
    transformIndexHtml(html) {
      const { title, favicon } = branding.browserTab ?? {};
      if (title) {
        const text = typeof title === "string" ? title : title.en ?? Object.values(title)[0];
        html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(text)}</title>`);
      }
      if (favicon) {
        const type = MIME_TYPES[path.extname(favicon).toLowerCase()] ?? "image/x-icon";
        html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" type="${type}" href="${escapeHtml(favicon)}" />`);
      }
      return html;
    },
    configureServer(server) {
      if (!dir) return;
      // Re-evaluate the config (and thus __BRANDING__) when branding files change
      server.watcher.add(dir);
      server.watcher.on("change", (file) => {
        if (file.startsWith(dir + path.sep)) server.restart();
      });
      const publicDir = path.join(dir, PUBLIC_DIR);
      server.middlewares.use(URL_PREFIX, (req, res, next) => {
        const file = path.resolve(publicDir, "." + decodeURIComponent(req.url!.split("?")[0]));
        if (!file.startsWith(publicDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return next();
        }
        res.setHeader("Content-Type", MIME_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      if (!dir) return;
      const publicDir = path.join(dir, PUBLIC_DIR);
      for (const file of listFiles(publicDir)) {
        this.emitFile({
          type: "asset",
          fileName: path.posix.join(URL_PREFIX.slice(1), file.split(path.sep).join("/")),
          source: fs.readFileSync(path.join(publicDir, file)),
        });
      }
    },
  };
}
