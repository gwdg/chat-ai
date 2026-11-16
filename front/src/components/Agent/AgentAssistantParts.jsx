import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";

import {
  rendererComponents,
  SafeMarkdown,
} from "../Conversation/MessageAssistant/MarkdownRenderer";
import ThinkingBlock from "../Conversation/MessageAssistant/ThinkingBlock";

const asText = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const TOOL_ARGUMENT_KEYS = {
  edit: ["filePath", "file_path", "path", "filename", "file"],
  write: ["filePath", "file_path", "path", "filename", "file"],
  read: ["filePath", "file_path", "path", "filename", "file"],
  patch: ["filePath", "file_path", "path", "filename", "file"],
  apply_patch: ["filePath", "file_path", "path", "filename", "file"],
  multiedit: ["filePath", "file_path", "path", "filename", "file"],
  bash: ["command", "cmd"],
  shell: ["command", "cmd"],
  glob: ["pattern", "path"],
  grep: ["pattern", "query", "path"],
  list: ["path"],
  webfetch: ["url"],
  websearch: ["query", "search"],
  task: ["description", "prompt"],
  subagent: ["description", "prompt"],
  skill: ["name"],
};

const DEFAULT_ARGUMENT_KEYS = [
  "filePath",
  "file_path",
  "path",
  "filename",
  "name",
  "description",
  "command",
  "query",
  "pattern",
  "url",
];

const toolArgument = (name, input) => {
  if (input === undefined || input === null) return "";
  if (typeof input === "string") {
    return input.replace(/\s+/g, " ").trim();
  }
  if (typeof input !== "object" || Array.isArray(input)) return "";
  const keys = TOOL_ARGUMENT_KEYS[String(name || "").toLowerCase()];
  const candidates = [...(keys || []), ...DEFAULT_ARGUMENT_KEYS];
  for (const key of candidates) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.replace(/\s+/g, " ").trim();
    }
  }
  return "";
};

const toolDetail = (part) => {
  const state = part.state ?? part;
  return {
    input: state.input ?? state.args ?? part.input ?? part.args,
    output:
      state.output ??
      state.result ??
      part.output ??
      part.result ??
      state.metadata?.output,
    status: state.status ?? part.status ?? state.title,
  };
};

// A read or write call is about exactly one file, so its card can open that file
// in the right-hand preview panel.
const FILE_TOOLS = new Set(["read", "write"]);

const toolFilePath = (name, input) => {
  const key = String(name || "").toLowerCase();
  if (!FILE_TOOLS.has(key)) return "";
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "";
  }
  const keys = TOOL_ARGUMENT_KEYS[key] ?? DEFAULT_ARGUMENT_KEYS;
  for (const candidate of keys) {
    const value = input[candidate];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const baseName = (path) => path.split("/").filter(Boolean).pop() || path;

export default function AgentAssistantParts({
  parts = [],
  fallback = "",
  onOpenFile,
}) {
  const { t } = useTranslation();
  const visible = parts.filter(
    (part) => part?.type === "text" || part?.type === "tool" || part?.type === "reasoning",
  );

  if (visible.length === 0) {
    return fallback ? (
      <SafeMarkdown components={rendererComponents}>{fallback}</SafeMarkdown>
    ) : null;
  }

  return (
    <div className="space-y-2">
      {visible.map((part, index) => {
        if (part.type === "text") {
          return part.text?.trim() ? (
            <SafeMarkdown
              key={`text:${index}`}
              components={rendererComponents}
            >
              {part.text}
            </SafeMarkdown>
          ) : null;
        }
        if (part.type === "reasoning") {
          return part.text?.trim() ? (
            <ThinkingBlock key={`reasoning:${index}`}>
              {part.text}
            </ThinkingBlock>
          ) : null;
        }
        const detail = toolDetail(part);
        const toolName = part.name ?? part.title ?? "tool";
        const argument = toolArgument(toolName, detail.input);
        const label = argument ? `${toolName}(${argument})` : toolName;
        const filePath = onOpenFile ? toolFilePath(toolName, detail.input) : "";
        return (
          <div key={`tool:${index}`} className="space-y-1">
            <details className="rounded-lg border border-base-300 bg-base-100/60">
              <summary className="flex cursor-pointer flex-wrap items-center gap-1.5 p-2 text-xs">
                <span className="badge badge-warning badge-xs">
                  {t("agents.tool_call")}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono font-medium"
                  title={label}
                >
                  {label}
                </span>
                {detail.status && (
                  <span className="badge badge-ghost badge-xs">
                    {String(detail.status)}
                  </span>
                )}
              </summary>
              <div className="space-y-2 border-t border-base-300 p-2">
                {detail.input === undefined && detail.output === undefined && (
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-base-200 p-2 font-mono text-[11px]">
                    {asText(part)}
                  </pre>
                )}
                {detail.input !== undefined && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
                      {t("agents.tool_input")}
                    </p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-base-200 p-2 font-mono text-[11px]">
                      {asText(detail.input)}
                    </pre>
                  </div>
                )}
                {detail.output !== undefined && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/45">
                      {t("agents.tool_output")}
                    </p>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-base-200 p-2 font-mono text-[11px]">
                      {asText(detail.output)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
            {filePath && (
              <button
                type="button"
                onClick={() => onOpenFile(filePath)}
                className="flex w-full items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2 py-1.5 text-left text-xs transition hover:border-accent/40 hover:bg-base-200"
                title={filePath}
                aria-label={t("agents.open_preview_of", {
                  name: baseName(filePath),
                })}
              >
                <FileText size={14} className="shrink-0 text-base-content/60" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {baseName(filePath)}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-base-content/50">
                    {filePath}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-medium text-accent">
                  {t("agents.open_preview")}
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
