import { useMemo } from "react";
import {
  Checkmark,
  ChevronRight,
  Terminal,
  Warning,
} from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import MarkdownRenderer from "../Conversation/MessageAssistant/MarkdownRenderer";
import CopyButton from "../Conversation/MessageAssistant/CopyButton";
import Typing from "../Conversation/MessageAssistant/Typing";

type ToolResultInfo = {
  toolName: string;
  text: string;
  isError: boolean;
};

function textFromBlocks(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function imagesFromContent(content: any) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block?.type === "image" && block.data);
}

function assistantMarkdown(content: any): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (block?.type === "text" && block.text) {
      parts.push(block.text);
    } else if (block?.type === "thinking" && block.thinking) {
      parts.push(`\n<think>${block.thinking}</think>\n`);
    }
  }
  return parts.join("\n\n").trim();
}

function assistantText(content: any): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

function describeToolArgs(name: string, args: any): string {
  if (!args || typeof args !== "object") return "";
  if (args.path) return String(args.path);
  if (args.from || args.to) return `${args.from ?? "?"} → ${args.to ?? "?"}`;
  if (args.question) return String(args.question);
  return "";
}

function ToolCallRow({
  name,
  args,
  result,
}: {
  name: string;
  args: any;
  result?: ToolResultInfo;
}) {
  const { t } = useTranslation();
  const description = describeToolArgs(name, args);
  const label = name.replace(/_/g, " ");
  return (
    <div className="my-2 flex items-start gap-2 rounded-xl border border-base-300 bg-base-200/60 px-3 py-2 text-xs">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-base-100 text-accent">
        <Terminal size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium capitalize text-base-content">{label}</span>
          {description && (
            <code className="max-w-full truncate rounded bg-base-100 px-1.5 py-0.5 font-mono text-[11px] text-base-content/70">
              {description}
            </code>
          )}
        </div>
        {result ? (
          <>
            <div
              className={`mt-1 flex items-center gap-1 ${
                result.isError ? "text-error" : "text-success"
              }`}
            >
              {result.isError ? <Warning size={12} /> : <Checkmark size={12} />}
              <span>{result.isError ? t("workspace.tool_failed") : t("workspace.tool_done")}</span>
            </div>
            {result.text && (
              <details className="mt-1">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-base-content/50 hover:text-base-content/70">
                  <ChevronRight size={12} className="transition-transform [details[open]_&]:rotate-90" />
                  {t("workspace.tool_output")}
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-base-100 p-2 font-mono text-[11px] text-base-content/70">
                  {result.text}
                </pre>
              </details>
            )}
          </>
        ) : (
          <div className="mt-1 flex items-center gap-1 text-base-content/60">
            <span className="loading loading-spinner loading-xs" />
            <span>{t("workspace.tool_running")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspaceMessage({
  message,
  toolResults,
  isStreaming = false,
}: {
  message: any;
  toolResults?: Map<string, ToolResultInfo>;
  isStreaming?: boolean;
}) {
  const markdown = useMemo(
    () => (message?.role === "assistant" ? assistantMarkdown(message.content) : ""),
    [message],
  );

  if (!message || message.role === "system") return null;

  if (message.role === "toolResult") return null;

  if (message.role === "user") {
    const text = textFromBlocks(message.content);
    const images = imagesFromContent(message.content);
    return (
      <div className="flex w-full justify-end pt-2">
        <div className="flex w-fit max-w-[85%] items-start gap-1.5 overflow-y-auto rounded-xl border border-base-300 bg-chat p-2.5 text-sm text-base-content">
          {text && (
            <pre className="min-w-0 flex-grow whitespace-pre-wrap break-words font-sans text-sm">
              {text}
            </pre>
          )}
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <img
                  key={index}
                  src={`data:${image.mimeType || "image/png"};base64,${image.data}`}
                  alt=""
                  className="max-h-40 rounded-lg border border-base-300 object-contain"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role !== "assistant") return null;

  const toolCalls = Array.isArray(message.content)
    ? message.content.filter((block: any) => block?.type === "toolCall")
    : [];
  const failed = message.stopReason === "error";

  return (
    <div className="overflow-hidden px-3 pt-3 text-base-content">
      {markdown ? (
        <MarkdownRenderer isLoading={isStreaming}>{markdown}</MarkdownRenderer>
      ) : (
        isStreaming && (
          <div className="pb-3">
            <Typing />
          </div>
        )
      )}

      {toolCalls.length > 0 && (
        <div className="mt-2">
          {toolCalls.map((call: any) => (
            <ToolCallRow
              key={call.id}
              name={call.name}
              args={call.arguments}
              result={toolResults?.get(call.id)}
            />
          ))}
        </div>
      )}

      {!isStreaming && assistantText(message.content) && (
        <div className="mt-1 flex justify-start opacity-25 transition-opacity hover:opacity-100">
          <CopyButton text={assistantText(message.content)} />
        </div>
      )}

      {failed && message.errorMessage && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
          <Warning size={14} className="mt-0.5 shrink-0" />
          <span>{message.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
