import { useTranslation } from "react-i18next";

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

export default function AgentAssistantParts({ parts = [], fallback = "" }) {
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
        return (
          <details
            key={`tool:${index}`}
            className="rounded-lg border border-base-300 bg-base-100/60"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-1.5 p-2 text-xs">
              <span className="badge badge-warning badge-xs">
                {t("agents.tool_call")}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono font-medium">
                {part.name ?? part.title ?? "tool"}
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
        );
      })}
    </div>
  );
}
