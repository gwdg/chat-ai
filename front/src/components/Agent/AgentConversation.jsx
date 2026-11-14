import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "@carbon/icons-react";

import {
  listOpencodeMessages,
  sendOpencodePrompt,
} from "../../apis/opencodeAgents";
import {
  rendererComponents,
  SafeMarkdown,
} from "../Conversation/MessageAssistant/MarkdownRenderer";

const POLL_INTERVAL = 1000;
const MAX_POLLS = 120;

const messageText = (message) => {
  if (message.type === "user") return message.text || "";
  if (message.type !== "assistant") return "";
  return (message.content ?? [])
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "tool") return `[${part.name}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
};

export default function AgentConversation({ agent }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const scrollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!agent?.sessionId) return [];
    const next = await listOpencodeMessages(agent, agent.sessionId);
    setMessages(next);
    return next;
  }, [agent]);

  useEffect(() => {
    if (!agent?.sessionId) return;
    let cancelled = false;
    setMessages([]);
    setInput("");
    setError("");
    setSending(false);
    stopPolling();
    refresh().catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    });
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [agent, refresh, stopPolling]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !agent?.sessionId) return;
    setSending(true);
    setError("");
    setInput("");
    try {
      const result = await sendOpencodePrompt(agent, agent.sessionId, text);
      const sentAt = result?.data?.time?.created ?? Date.now();
      let polls = 0;
      const poll = async () => {
        try {
          const next = await refresh();
          const finished = next.some(
            (message) =>
              message.type === "idle" &&
              (message.time?.created ?? 0) >= sentAt,
          );
          if (finished) {
            setSending(false);
            return;
          }
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setSending(false);
          return;
        }
        polls += 1;
        if (polls >= MAX_POLLS) {
          setError(t("agents.chat_timeout"));
          setSending(false);
          return;
        }
        pollRef.current = setTimeout(poll, POLL_INTERVAL);
      };
      pollRef.current = setTimeout(poll, 500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setInput(text);
      setSending(false);
    }
  };

  const visible = messages
    .map((message) => ({ message, text: messageText(message) }))
    .filter(({ text }) => text.trim());

  return (
    <section className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm md:max-w-[85vw] xl:max-w-[1300px]">
      <header className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/60">
          <Bot size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-base-content">
            {agent.name}
          </p>
          <p className="truncate text-[11px] text-base-content/60">
            {agent.serverUrl}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {visible.length === 0 && !sending ? (
          <p className="text-sm text-base-content/50">
            {t("agents.chat_empty")}
          </p>
        ) : (
          visible.map(({ message, text }) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm ${
                  message.type === "user"
                    ? "whitespace-pre-wrap bg-accent text-accent-content"
                    : "markdown-body bg-base-200 text-base-content"
                }`}
              >
                {message.type === "user" ? (
                  text
                ) : (
                  <SafeMarkdown components={rendererComponents}>
                    {text}
                  </SafeMarkdown>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <p className="flex items-center gap-2 text-xs text-base-content/60">
            <span className="loading loading-spinner loading-xs" />
            {t("agents.working")}
          </p>
        )}
      </div>

      <div className="border-t border-base-300 p-3">
        {error && <p className="mb-2 text-xs text-error">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={2}
            className="textarea textarea-bordered min-h-16 flex-1 resize-none"
            placeholder={t("agents.chat_empty")}
          />
          <button
            type="button"
            className="btn btn-accent"
            onClick={send}
            disabled={!input.trim() || sending}
          >
            {t("agents.send")}
          </button>
        </div>
      </div>
    </section>
  );
}
