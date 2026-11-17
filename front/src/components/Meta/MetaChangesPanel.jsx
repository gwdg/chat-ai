import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import {
  formatFullTimestamp,
  formatRelativeTime,
} from "../../utils/conversationDates";

import { getWhatsNew } from "../../utils/metaTools";
import {
  plainRendererComponents,
  SafeMarkdown,
} from "../Conversation/MessageAssistant/MarkdownRenderer";
import {
  META_LAST_CHECK_KEY,
  META_LAST_CHECK_RESULT_KEY,
} from "../../hooks/useMetaChatSend";

const COLLAPSED_KEY = "chatai.meta.changes-collapsed";
const WIDTH_KEY = "chatai.meta.changes-width-v2";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
const MAX_WIDTH = 1024;

const clampWidth = (value) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

const readWidth = () => {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(value) && value > 0
      ? clampWidth(value)
      : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
};

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
};

const scopedKey = (base, scopeKey) => (scopeKey ? `${base}:${scopeKey}` : base);

const tabClass = (active) =>
  `rounded-md px-2 py-1 text-xs font-semibold ${
    active
      ? "bg-base-200 text-base-content"
      : "text-base-content/55 hover:text-base-content"
  }`;

const readStored = (scopeKey = "") => {
  try {
    const at =
      Number(localStorage.getItem(scopedKey(META_LAST_CHECK_KEY, scopeKey))) ||
      0;
    const raw = localStorage.getItem(
      scopedKey(META_LAST_CHECK_RESULT_KEY, scopeKey),
    );
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      at: Number(parsed?.at) || at,
      text: typeof parsed?.text === "string" ? parsed.text : "",
    };
  } catch {
    return { at: 0, text: "" };
  }
};

export default function MetaChangesPanel({
  userSettings,
  scope = null,
  scopeKey = "",
  children,
  tabs = [],
}) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState(() => readStored(scopeKey));
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [width, setWidth] = useState(readWidth);
  const [activeTab, setActiveTab] = useState("changes");
  const widthRef = useRef(width);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const activeContentTab = tabs.find((tab) => tab.id === activeTab) ?? null;
  const changesTitle = t("meta_chat.changes_title");

  useEffect(() => {
    setState(readStored(scopeKey));
  }, [scopeKey]);

  useEffect(() => {
    const reload = (event) => {
      if (event?.type === "storage") {
        // Only react to this panel's own keys; a scoped panel must not adopt the
        // global Meta chat result.
        const keys = [
          scopedKey(META_LAST_CHECK_KEY, scopeKey),
          scopedKey(META_LAST_CHECK_RESULT_KEY, scopeKey),
        ];
        if (event.key && !keys.includes(event.key)) return;
      } else if ((event?.detail?.scopeKey ?? "") !== scopeKey) {
        return;
      }
      setState(readStored(scopeKey));
    };
    window.addEventListener("chatai:meta-last-check", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("chatai:meta-last-check", reload);
      window.removeEventListener("storage", reload);
    };
  }, [scopeKey]);

  const check = async () => {
    if (checking) return;
    setChecking(true);
    setError("");
    const at = Date.now();
    const since = state.at || at - 24 * 60 * 60 * 1000;
    try {
      const text = await getWhatsNew({
        userSettings,
        since: new Date(since).toISOString(),
        scope,
      });
      const next = { at, text };
      setState(next);
      try {
        localStorage.setItem(
          scopedKey(META_LAST_CHECK_KEY, scopeKey),
          String(at),
        );
        localStorage.setItem(
          scopedKey(META_LAST_CHECK_RESULT_KEY, scopeKey),
          JSON.stringify(next),
        );
      } catch {}
      window.dispatchEvent(
        new CustomEvent("chatai:meta-last-check", {
          detail: { at, scopeKey },
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setChecking(false);
    }
  };

  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    const onMove = (moveEvent) => {
      setWidth(clampWidth(startWidth + startX - moveEvent.clientX));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(WIDTH_KEY, String(widthRef.current));
      } catch {}
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {}
  };

  if (collapsed) {
    return (
      <aside className="hidden h-full min-h-0 w-10 shrink-0 self-stretch flex-col items-center overflow-hidden rounded-xl border border-base-300 bg-base-100 py-2 shadow-sm md:flex">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex h-8 w-8 items-center justify-center rounded-md text-base-content/60 hover:bg-base-200 hover:text-base-content"
          title={t("meta_chat.expand_changes")}
          aria-label={t("meta_chat.expand_changes")}
        >
          <ChevronLeft size={16} />
        </button>
        <span
          className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-base-content/45"
          style={{ writingMode: "vertical-rl" }}
        >
          {activeContentTab ? activeContentTab.label : changesTitle}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="relative hidden h-full min-h-0 shrink-0 self-stretch flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm md:flex"
      style={{ width: `${width}px` }}
    >
      <button
        type="button"
        onPointerDown={startResize}
        className="absolute inset-y-0 -left-1 z-20 w-2 cursor-col-resize touch-none"
        title={t("meta_chat.resize_changes")}
        aria-label={t("meta_chat.resize_changes")}
      />
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
        {tabs.length > 0 ? (
          <div
            role="tablist"
            data-guide="meta-tab-strip"
            className="flex min-w-0 flex-1 items-center gap-1"
          >
            <button
              type="button"
              role="tab"
              data-guide="meta-tab-changes"
              aria-selected={activeTab === "changes"}
              onClick={() => setActiveTab("changes")}
              className={tabClass(activeTab === "changes")}
            >
              {changesTitle}
            </button>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-guide={"meta-tab-" + tab.id}
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={tabClass(activeTab === tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="min-w-0 flex-1 text-xs font-semibold">
            {changesTitle}
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex h-5 w-5 items-center justify-center rounded text-base-content/45 hover:bg-base-200 hover:text-base-content"
          title={t("meta_chat.collapse_changes")}
          aria-label={t("meta_chat.collapse_changes")}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      {(tabs.length === 0 || activeTab === "changes") && (
        <div
          data-guide="meta-check-now-row"
          className="flex items-center px-3 pb-2 pt-1.5"
        >
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking}
            className="btn btn-ghost btn-xs gap-1"
            title={t("meta_chat.check_now")}
            aria-label={t("meta_chat.check_now")}
          >
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
            {t("meta_chat.check_now")}
          </button>
        </div>
      )}
      {activeContentTab ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {activeContentTab.content}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {state.at > 0 && (
            <p
              data-guide="meta-last-check"
              className="mb-2 text-[10px] text-base-content/50"
              title={formatFullTimestamp(state.at, i18n.language)}
            >
              {t("meta_chat.last_checked", {
                date: formatRelativeTime(state.at, i18n.language),
              })}
            </p>
          )}
          {error ? (
            <p className="text-xs text-error">{error}</p>
          ) : state.text ? (
            <div className="text-xs leading-relaxed text-base-content/80">
              <SafeMarkdown components={plainRendererComponents}>
                {state.text}
              </SafeMarkdown>
            </div>
          ) : (
            <p className="text-xs text-base-content/60">
              {t("meta_chat.changes_empty")}
            </p>
          )}
          {children && (
            <div className="mt-3 border-t border-base-300 pt-3">{children}</div>
          )}
        </div>
      )}
    </aside>
  );
}
