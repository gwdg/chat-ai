import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import ThinkingBlock from "./ThinkingBlock";
import Code from "./Code";
import McpConfirmationCard from "./McpConfirmationCard";

const resultText = (result) =>
  (result?.content ?? [])
    .map((block) => (block.type === "text" ? block.text : `[${block.type}]`))
    .join("\n");

// One tool call of the agent, collapsed to its name and main argument
function ToolCall({ call, result }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const args = call.arguments ?? {};
  const summary = args.path ?? args.prompt ?? args.pattern ?? args.text ?? args.query ?? "";
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
      {call.id && <McpConfirmationCard callId={call.id} />}
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

const codemodeSource = (call) => {
  const args = call?.arguments;
  if (args && typeof args === "object" && typeof args.code === "string") return args.code;
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      if (typeof parsed?.code === "string") return parsed.code;
    } catch {
      // Partial JSON while the call is still streaming.
    }
    const match = args.match(/"code"\s*:\s*"((?:\\.|[^"\\])*)/);
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1].replace(/\\n/g, "\n");
      }
    }
  }
  return "";
};

function CodemodeStep({ call, result }) {
  const { t } = useTranslation();
  const code = codemodeSource(call);

  if (!result) {
    return (
      <div
        role="status"
        aria-label={t("conversation.codemode_running")}
        className="flex items-center gap-2 px-1 py-0.5 text-sm text-base-content/60"
      >
        <span className="loading loading-dots loading-xs" />
        {t("conversation.codemode_running")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {code && <Code language="javascript">{code}</Code>}
      <details className="rounded-lg border border-base-300 bg-base-100 text-xs">
        <summary className="cursor-pointer px-2 py-1 text-base-content/70">
          {t("conversation.codemode_output")}
        </summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border-t border-base-300 p-2 font-mono">
          {resultText(result)}
        </pre>
      </details>
    </div>
  );
}

// The agent's turn in order: thinking boxes, text as Markdown, tool calls as steps
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

  const lastAssistantMessageIndex = agentMessages.reduce(
    (last, message, index) => (message.role === "assistant" ? index : last),
    -1,
  );
  for (const [messageIndex, message] of agentMessages.entries()) {
    if (message.role !== "assistant") continue;
    const blocks = message.content ?? [];
    const lastThinkingIndex = blocks.reduce(
      (last, block, index) => (block.type === "thinking" ? index : last),
      -1,
    );
    for (const [blockIndex, block] of blocks.entries()) {
      if (block.type === "thinking") {
        flush();
        const liveThinking =
          isLoading &&
          messageIndex === lastAssistantMessageIndex &&
          blockIndex === lastThinkingIndex;
        segments.push({
          kind: "thinking",
          text: block.thinking || "",
          autoExpand: liveThinking,
          isStreaming: liveThinking,
        });
      } else if (block.type === "text") markdown += block.text;
      else if (block.type === "toolCall") {
        flush();
        const codemodeArgs =
          block.arguments && typeof block.arguments === "object"
            ? block.arguments
            : null;
        if (
          block.name === "codemode" ||
          (!block.name &&
            (typeof codemodeArgs?.code === "string" ||
              (typeof block.arguments === "string" &&
                block.arguments.includes('"code"'))))
        ) {
          segments.push({ kind: "codemode", call: block, result: results.get(block.id) });
        } else {
          segments.push({ kind: "tool", call: block, result: results.get(block.id) });
        }
      }
    }
    if (messageIndex !== agentMessages.length - 1) markdown += "\n\n";
  }
  flush();

  return (
    <div className="flex flex-col gap-1 [&_.thinking-block:first-child]:mt-0 [&_.thinking-block:last-child]:mb-0">
      {segments.map((segment, i) =>
        segment.kind === "tool" ? (
          <ToolCall key={i} call={segment.call} result={segment.result} />
        ) : segment.kind === "codemode" ? (
          <CodemodeStep key={i} call={segment.call} result={segment.result} />
        ) : segment.kind === "thinking" ? (
          <ThinkingBlock
            key={i}
            autoExpand={segment.autoExpand}
            isStreaming={segment.isStreaming}
          >
            {segment.text}
          </ThinkingBlock>
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
