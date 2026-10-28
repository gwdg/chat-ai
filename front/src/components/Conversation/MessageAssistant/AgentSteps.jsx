import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";

const resultText = (result) =>
  (result?.content ?? [])
    .map((block) => (block.type === "text" ? block.text : `[${block.type}]`))
    .join("\n");

// One tool call of the agent, collapsed to its name and main argument
function ToolCall({ call, result }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const args = call.arguments ?? {};
  const summary = args.path ?? args.prompt ?? args.pattern ?? args.text ?? "";
  const status = !result ? "…" : result.isError ? t("conversation.tool_failed") : "";
  return (
    <div className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-bg_secondary_dark">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-2 py-1 text-left cursor-pointer text-gray-600 dark:text-gray-300"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Wrench className="w-3 h-3" />
        <span className="font-mono">{call.name}</span>
        <span className="truncate opacity-70">{String(summary).slice(0, 120)}</span>
        <span className={result?.isError ? "text-red-500" : ""}>{status}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-col gap-1">
          <pre className="whitespace-pre-wrap break-all font-mono opacity-80">{JSON.stringify(args, null, 2)}</pre>
          {result && (
            <pre className="whitespace-pre-wrap break-all font-mono max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700 pt-1">
              {resultText(result)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// The agent's turn in order: text and thinking as Markdown, tool calls as collapsible rows
export default function AgentSteps({ agentMessages, isLoading, renderMode }) {
  const results = new Map(
    agentMessages.filter((m) => m.role === "toolResult").map((m) => [m.toolCallId, m])
  );
  const segments = [];
  let markdown = "";
  const flush = () => {
    if (markdown.trim()) segments.push({ kind: "markdown", text: markdown });
    markdown = "";
  };
  for (const message of agentMessages) {
    if (message.role !== "assistant") continue;
    for (const block of message.content ?? []) {
      if (block.type === "thinking") markdown += `<think>${block.thinking}</think>`;
      else if (block.type === "text") markdown += block.text;
      else if (block.type === "toolCall") {
        flush();
        segments.push({ kind: "tool", call: block, result: results.get(block.id) });
      }
    }
    markdown += "\n\n";
  }
  flush();

  return (
    <div className="flex flex-col gap-2">
      {segments.map((segment, i) =>
        segment.kind === "tool" ? (
          <ToolCall key={segment.call.id ?? i} call={segment.call} result={segment.result} />
        ) : (
          <MarkdownRenderer
            key={i}
            isLoading={isLoading && i === segments.length - 1}
            renderMode={renderMode}
          >
            {segment.text}
          </MarkdownRenderer>
        )
      )}
    </div>
  );
}
