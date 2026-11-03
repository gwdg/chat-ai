import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, MagicWand, Idea, Warning, Close, StopFilled } from "@carbon/icons-react";
import { useTranslation } from "react-i18next";

import WorkspaceMessage from "./WorkspaceMessage";

type ToolResultInfo = { toolName: string; text: string; isError: boolean };

function toolResultText(content: any): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((item: any) => item?.type === "text")
    .map((item: any) => item.text)
    .join("\n");
}

export default function WorkspaceConversation({
  workspaceName,
  rootPath,
  messages,
  streamingMessage,
  status,
  activity,
  error,
  aborted,
  onSuggestion,
  onDismissError,
}: {
  workspaceName: string;
  rootPath: string;
  messages: any[];
  streamingMessage: any | null;
  status: "loading" | "ready" | "thinking" | "tool" | "error";
  activity: { toolName: string; state: string } | null;
  error: string | null;
  aborted?: boolean;
  onSuggestion: (text: string) => void;
  onDismissError: () => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const toolResults = useMemo(() => {
    const map = new Map<string, ToolResultInfo>();
    for (const message of messages) {
      if (message?.role !== "toolResult") continue;
      map.set(message.toolCallId, {
        toolName: message.toolName,
        text: toolResultText(message.content),
        isError: Boolean(message.isError),
      });
    }
    return map;
  }, [messages]);

  const visibleMessages = messages.filter(
    (message) =>
      message?.role &&
      message.role !== "system" &&
      message.role !== "toolResult",
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    // The empty state is taller than the viewport on phones. Auto-scrolling to
    // the bottom there cuts off the welcome heading, so only follow the
    // conversation once there is actually a message to follow.
    if (visibleMessages.length === 0 && !streamingMessage) {
      element.scrollTop = 0;
      return;
    }
    if (!nearBottom) return;
    element.scrollTop = element.scrollHeight;
  }, [visibleMessages.length, streamingMessage, status, nearBottom]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setNearBottom(distance < 120);
  };

  const suggestions = [
    t("workspace.suggestion_list"),
    t("workspace.suggestion_readme"),
    t("workspace.suggestion_summary"),
  ];

  const showEmpty = visibleMessages.length === 0 && !streamingMessage && status !== "loading";

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        {status === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-base-content/50">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-sm">{t("workspace.starting_agent")}</p>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center px-2 py-10 text-center md:py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 text-primary shadow-sm ring-1 ring-base-300">
              <Bot size={30} />
            </div>
            <h2 className="text-lg font-semibold text-base-content">
              {t("workspace.empty_title", { name: workspaceName })}
            </h2>
            <p className="mt-1 max-w-md text-sm text-base-content/60">
              {t("workspace.empty_body")}
            </p>
            <code className="mt-2 rounded-full bg-base-100 px-3 py-1 text-[11px] text-base-content/50 ring-1 ring-base-300">
              {rootPath}
            </code>
            <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-3">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestion(suggestion)}
                  className="group flex min-h-20 flex-col items-start gap-2 rounded-2xl border border-base-300 bg-base-100 p-3 text-left text-xs text-base-content/80 transition hover:border-primary/40 hover:bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {index === 0 ? (
                    <MagicWand size={16} className="text-accent" />
                  ) : index === 1 ? (
                    <Idea size={16} className="text-primary" />
                  ) : (
                    <Bot size={16} className="text-secondary" />
                  )}
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleMessages.map((message, index) => (
          <WorkspaceMessage
            key={`${message.role}-${index}`}
            message={message}
            toolResults={toolResults}
          />
        ))}

        {streamingMessage && (
          <WorkspaceMessage
            message={streamingMessage}
            toolResults={toolResults}
            isStreaming
          />
        )}

        {status === "tool" && activity && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/70 shadow-sm">
            <span className="loading loading-spinner loading-xs text-primary" />
            <span>
              {t("workspace.running_tool", {
                tool: activity.toolName.replace(/_/g, " "),
              })}
            </span>
          </div>
        )}

        {status === "thinking" && !streamingMessage && (
          <div className="mt-3 flex items-center gap-2 text-xs text-base-content/50">
            <span className="loading loading-dots loading-sm text-primary" />
            <span>{t("workspace.thinking")}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-error">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="rounded p-0.5 hover:bg-error/10"
              aria-label={t("common.close")}
            >
              <Close size={14} />
            </button>
          </div>
        )}

        {aborted && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/60">
            <StopFilled size={14} className="shrink-0 text-accent" />
            <span className="flex-1">{t("workspace.stopped")}</span>
            <button
              type="button"
              onClick={onDismissError}
              className="rounded p-0.5 hover:bg-base-200"
              aria-label={t("common.close")}
            >
              <Close size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
