import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Code2, Eye, Play, Square } from "lucide-react";

import Code from "./Code";
import { selectHtmlPreview } from "../../../Redux/reducers/userSettingsReducer";

/* ------------------------------------------------------------------
 * Sandboxed preview for ```html fences in model output.
 *
 * Nothing is sanitized: the content is untrusted and is isolated by the
 * browser instead.
 *
 *  - static:   sandbox="allow-same-origin" (no allow-scripts) → no script,
 *              no event handler, no javascript: URL runs. same-origin only
 *              lets the parent measure height and intercept link clicks.
 *  - running:  sandbox="allow-scripts" (opaque origin, no same-origin) →
 *              scripts run but cannot reach the app, its storage or cookies.
 *
 * Both modes put a CSP <meta> first in the srcdoc that blocks every network
 * request. A later CSP in the content can only add restrictions, never lift
 * them. CSP cannot stop a script from navigating its own frame, so running
 * scripts needs explicit consent per block.
 *
 * The two sandbox strings are constants and must never be combined:
 * allow-scripts + allow-same-origin lets the frame remove its own sandbox.
 * ------------------------------------------------------------------ */
const SANDBOX_STATIC = "allow-same-origin";
const SANDBOX_RUN = "allow-scripts";

const MAX_HEIGHT = 800;
const MIN_HEIGHT = 80;

const CSP_STATIC =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; " +
  "font-src data:; media-src data:; base-uri 'none'; form-action 'none'";
const CSP_RUN =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'unsafe-inline'; img-src data: blob:; font-src data:; " +
  "media-src data: blob:; worker-src blob:; base-uri 'none'; form-action 'none'";

// <meta http-equiv="refresh"> navigates the frame without any script and is
// not covered by CSP, so drop it. This is the only content rewrite.
const stripMetaRefresh = (html) =>
  html.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi, "");

// Runs inside the scripted frame; reports content height to the parent.
const RESIZE_PROBE =
  "<script>(function(){var last=0;function r(){" +
  "var h=document.documentElement.scrollHeight;" +
  "if(h!==last){last=h;parent.postMessage({__htmlBlockHeight:h},'*');}}" +
  "addEventListener('load',r);" +
  "if(window.ResizeObserver)new ResizeObserver(r).observe(document.documentElement);" +
  "setTimeout(r,50);})()</script>";

const buildSrcDoc = (content, { run, dark }) => {
  const csp = run ? CSP_RUN : CSP_STATIC;
  const scheme = dark ? "dark" : "light";
  return (
    "<!doctype html><html><head>" +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    '<meta charset="utf-8">' +
    `<meta name="color-scheme" content="${scheme}">` +
    `<style>:root{color-scheme:${scheme}}` +
    "body{margin:12px;font-family:system-ui,sans-serif;font-size:14px}" +
    "img,svg,video,canvas{max-width:100%}</style>" +
    "</head><body>" +
    stripMetaRefresh(content) +
    (run ? RESIZE_PROBE : "") +
    "</body></html>"
  );
};

/* Run approvals: SHA-256 of the block content, kept in this browser only
 * (localStorage, never in the conversation), so exported/imported or
 * shared chats never arrive pre-approved. "This session" approvals live in
 * sessionStorage. */
const APPROVED_KEY = "html_block_run_approved";
const SESSION_KEY = "html_block_run_session";
const MAX_APPROVALS = 500;

const readList = () => {
  try {
    return JSON.parse(localStorage.getItem(APPROVED_KEY)) || [];
  } catch {
    return [];
  }
};
const isApproved = (hash) => hash && readList().includes(hash);
const approve = (hash) => {
  try {
    const list = readList().filter((h) => h !== hash);
    list.push(hash);
    localStorage.setItem(
      APPROVED_KEY,
      JSON.stringify(list.slice(-MAX_APPROVALS))
    );
  } catch {
    /* storage unavailable: approval just isn't remembered */
  }
};
const sessionAllowed = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
};
const allowSession = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
};

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
};

const btn =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

const HtmlBlock = memo(({ content }) => {
  const { t } = useTranslation();
  const mode = useSelector(selectHtmlPreview); // "off" | "static" | "ask"
  const dark = useSelector((state) => state.interface_settings.dark_mode);
  const iframeRef = useRef(null);
  const [showCode, setShowCode] = useState(false);
  const [running, setRunning] = useState(false);
  const [hash, setHash] = useState(null);
  const [height, setHeight] = useState(MIN_HEIGHT);

  const canRun = mode === "ask";

  useEffect(() => {
    let cancelled = false;
    setRunning(false);
    if (!canRun || !window.crypto?.subtle) return;
    sha256(content).then((h) => {
      if (cancelled) return;
      setHash(h);
      if (sessionAllowed() || isApproved(h)) setRunning(true);
    });
    return () => {
      cancelled = true;
    };
  }, [content, canRun]);

  const clamp = (h) => Math.min(Math.max(h || 0, MIN_HEIGHT), MAX_HEIGHT);

  // Scripted frame: height comes via postMessage, accepted only from our frame.
  useEffect(() => {
    if (!running) return;
    const onMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const h = Number(event.data?.__htmlBlockHeight);
      if (h) setHeight(clamp(h + 2));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [running]);

  // Static frame: measure directly and intercept link clicks from the parent.
  const onStaticLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const measure = () => setHeight(clamp(doc.documentElement.scrollHeight + 2));
    measure();
    if (window.ResizeObserver) {
      new ResizeObserver(measure).observe(doc.documentElement);
    }
    doc.addEventListener("click", (e) => {
      const a = e.target.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) return; // in-page anchor
      e.preventDefault();
      let url;
      try {
        url = new URL(href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (window.confirm(t("conversation.html_block.open_link", { url: url.href }))) {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }
    });
  }, [t]);

  if (mode === "off") return <Code language="html">{content}</Code>;

  const onRun = (remember) => {
    if (remember === "session") allowSession();
    else if (hash) approve(hash);
    setRunning(true);
  };

  return (
    <div className="my-2 flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {canRun && !showCode && !running && (
          <>
            <span className="mr-auto text-[11px] text-gray-500 dark:text-gray-400">
              {t("conversation.html_block.static_hint")}
            </span>
            <button type="button" className={btn} onClick={() => onRun("block")}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.html_block.run")}
            </button>
            <button type="button" className={btn} onClick={() => onRun("session")}>
              {t("conversation.html_block.run_session")}
            </button>
          </>
        )}
        {canRun && !showCode && running && (
          <button type="button" className={btn} onClick={() => setRunning(false)}>
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversation.html_block.stop")}
          </button>
        )}
        <button
          type="button"
          className={btn}
          aria-pressed={showCode}
          onClick={() => setShowCode((v) => !v)}
        >
          {showCode ? (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.html_block.render")}
            </>
          ) : (
            <>
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("conversation.html_block.show_code")}
            </>
          )}
        </button>
      </div>

      {showCode ? (
        <Code language="html">{content}</Code>
      ) : (
        <iframe
          // key forces a fresh frame when switching sandbox: the attribute is
          // only applied on navigation, never to an already loaded document.
          key={running ? "run" : "static"}
          ref={iframeRef}
          title={t("conversation.html_block.render")}
          sandbox={running ? SANDBOX_RUN : SANDBOX_STATIC}
          srcDoc={buildSrcDoc(content, { run: running, dark })}
          onLoad={running ? undefined : onStaticLoad}
          referrerPolicy="no-referrer"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
          style={{ height }}
        />
      )}
    </div>
  );
});
HtmlBlock.displayName = "HtmlBlock";

export default HtmlBlock;
