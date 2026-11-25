const TIKZJAX_OPTIONS = {
  assetBaseUrl: "/tikzjax",
  renderTimeout: 30000,
  // A deterministic TeX error is not fixed by restarting the worker and
  // retrying; doing so only delays the error by another 30 seconds.
  maxRetries: 0,
  restartWorkerOnFail: false,
  workerMode: "direct",
  worker: { mode: "direct" },
  workerPool: { enabled: false },
  theme: {
    selector: "body",
    applyTargetStyles: false,
    attribute: "data-tikzjax-theme",
    darkValue: "dark",
    lightValue: "light",
    fallbackTheme: "light",
    followSystemTheme: false,
  },
};

const KNOWN_PACKAGES = new Set([
  "amsbsy",
  "amsfonts",
  "amsgen",
  "amsmath",
  "amsopn",
  "amssymb",
  "amstext",
  "array",
  "etoolbox",
  "hf-tikz",
  "pgfplots",
  "tikz-3dplot",
  "tikz-cd",
  "xparse",
  "chemfig",
  "circuitikz",
  "physics",
  "yquant",
  "tikz-feynhand",
  "kinematikz",
  "pgf-spectra",
]);

const TIKZ_ENVIRONMENT = /\\begin\{(tikzpicture|tikzcd)\}[\s\S]*?\\end\{\1\}/g;
const TIKZ_PREAMBLE_COMMAND =
  /^\s*\\(tikzset|pgfplotsset|usepgfplotslibrary|definecolor)\b/;

// Longer than TikZJax's own render timeout so its TeX error can be reported.
const TIKZ_OUTER_TIMEOUT_MS = 45000;

let tikzJaxPromise;
let tikzRenderQueue = Promise.resolve();
let tikzErrorSink = null;
let tikzConsolePatched = false;

// TikZJax reports the TeX log through console.warn. Capture the error for the
// current snippet so LatexBlock can show it instead of a generic failure.
const patchTikzWarnings = () => {
  if (tikzConsolePatched) return;
  tikzConsolePatched = true;
  const warn = console.warn.bind(console);
  console.warn = (...args) => {
    if (tikzErrorSink && args[0] === "TikZJax rendering failed:") {
      const error = args[1];
      tikzErrorSink(error?.message || String(error));
    }
    warn(...args);
  };
};

const loadTikzJax = () => {
  if (window.TikzJax) {
    window.TikzJaxConfigure?.(TIKZJAX_OPTIONS);
    return Promise.resolve();
  }
  if (tikzJaxPromise) return tikzJaxPromise;

  window.TikzJaxOptions = TIKZJAX_OPTIONS;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/tikzjax/fonts.min.css";
  document.head.appendChild(link);

  tikzJaxPromise = new Promise((resolve, reject) => {
    // TikZJax registers an unload listener only for cleanup, but some
    // deployments disable unload via Permissions-Policy and Chrome logs a
    // violation for it. Ignore just that listener while the script starts.
    const nativeAddEventListener = window.addEventListener;
    const addWithoutUnload = function (type, listener, options) {
      if (type === "unload") return;
      return nativeAddEventListener.call(this, type, listener, options);
    };
    const restoreAddEventListener = () => {
      if (window.addEventListener === addWithoutUnload) {
        window.addEventListener = nativeAddEventListener;
      }
    };
    window.addEventListener = addWithoutUnload;

    const script = document.createElement("script");
    script.src = "/tikzjax/tikzjax.js";
    script.async = true;
    script.onload = () => {
      restoreAddEventListener();
      resolve();
    };
    script.onerror = () => {
      restoreAddEventListener();
      tikzJaxPromise = undefined;
      reject(new Error("Failed to load TikZJax"));
    };
    document.head.appendChild(script);
  });

  return tikzJaxPromise;
};

const renderTikzSnippet = (source, options) =>
  new Promise((resolve, reject) => {
    patchTikzWarnings();
    let failureMessage = "";
    const previousSink = tikzErrorSink;
    const sink = (message) => {
      failureMessage = message;
    };
    tikzErrorSink = sink;

    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none;z-index:-1;";

    const pre = document.createElement("pre");
    pre.className = "language-tikz";
    pre.textContent = source;

    if (options.libraries.length) {
      pre.dataset.tikzLibraries = options.libraries.join(",");
    }
    if (options.packages.length) {
      pre.dataset.texPackages = JSON.stringify(
        Object.fromEntries(options.packages.map((name) => [name, ""]))
      );
    }
    if (options.preamble) {
      pre.dataset.addToPreamble = options.preamble;
    }

    let observer;
    const cleanup = () => {
      clearTimeout(timer);
      observer?.disconnect();
      host.remove();
      if (tikzErrorSink === sink) tikzErrorSink = previousSink;
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("TikZ rendering timed out"));
    }, TIKZ_OUTER_TIMEOUT_MS);

    observer = new MutationObserver(() => {
      const svg = host.querySelector("svg:not(.tikzjax-loader)");
      const broken = host.querySelector("img.tikzjax-broken-image");
      if (svg) {
        const output = svg.outerHTML;
        cleanup();
        resolve(output);
      } else if (broken) {
        cleanup();
        reject(new Error(failureMessage || "TikZ rendering failed"));
      }
    });
    observer.observe(host, { childList: true, subtree: true });

    host.appendChild(pre);
    document.body.appendChild(host);
  });

export const extractTikz = (source) => {
  const libraries = new Set();
  const packages = new Set();
  const preamble = [];
  const keptLines = [];

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    const usepackage = trimmed.match(
      /^\\usepackage(?:\[[^\]]*\])?\{([^}]*)\}/
    );
    if (usepackage) {
      usepackage[1]
        .split(",")
        .map((name) => name.trim())
        .filter((name) => KNOWN_PACKAGES.has(name))
        .forEach((name) => packages.add(name));
      continue;
    }

    const library = trimmed.match(/^\\usetikzlibrary\s*\{([^}]*)\}/);
    if (library) {
      library[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => libraries.add(name));
      continue;
    }

    if (TIKZ_PREAMBLE_COMMAND.test(trimmed)) {
      preamble.push(trimmed);
      continue;
    }

    keptLines.push(line);
  }

  const snippets = [];
  let cleanedSource = keptLines.join("\n");
  cleanedSource = cleanedSource.replace(TIKZ_ENVIRONMENT, (match) => {
    const index = snippets.length;
    const token = `TIKZPLACEHOLDER${index}END`;
    snippets.push({ source: match, token, index });
    if (match.startsWith("\\begin{tikzcd}")) {
      packages.add("tikz-cd");
    }
    return token;
  });

  return {
    cleanedSource,
    snippets,
    libraries: [...libraries],
    packages: [...packages],
    preamble: preamble.join("\n"),
  };
};

export const renderTikzSnippets = (snippets, options) => {
  if (!snippets.length) return Promise.resolve([]);

  const run = async () => {
    await loadTikzJax();
    const output = [];
    for (const snippet of snippets) {
      output.push(await renderTikzSnippet(snippet.source, options));
    }
    return output;
  };

  const result = tikzRenderQueue.then(run, run);
  tikzRenderQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

// TeX's interactive error log is long. Keep the first real error, up to the
// prompt, for the block's error message.
export const formatLatexError = (message) => {
  const text = String(message || "").trim();
  const start = text.search(/^! /m);
  if (start < 0) return text;
  const tail = text.slice(start);
  const prompt = tail.search(/^\? /m);
  return (prompt >= 0 ? tail.slice(0, prompt) : tail).trim();
};
