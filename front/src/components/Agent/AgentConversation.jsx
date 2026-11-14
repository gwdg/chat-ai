import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, StopFilled } from "@carbon/icons-react";

import {
  compactOpencodeSession,
  getOpencodeDefaultModel,
  getOpencodeSession,
  interruptOpencodeSession,
  listOpencodeCommands,
  listOpencodeMessages,
  listOpencodeModels,
  listOpencodePermissions,
  replyOpencodePermission,
  runOpencodeShell,
  sendOpencodeCommand,
  sendOpencodePrompt,
  setOpencodeModel,
} from "../../apis/opencodeAgents";
import Tooltip from "../Others/Tooltip";
import ModelButton from "../Prompt/ModelButton";
import SendButton from "../Prompt/SendButton";
import {
  rendererComponents,
  SafeMarkdown,
} from "../Conversation/MessageAssistant/MarkdownRenderer";

const POLL_INTERVAL = 1000;
const MAX_POLLS = 120;

const toModelInfo = (model) => ({
  id: model.id ?? model.modelID,
  object: "model",
  input: model.capabilities?.input ?? ["text"],
  output: model.capabilities?.output ?? ["text"],
  owned_by: model.providerID ?? "opencode",
  name: model.name ?? model.id ?? model.modelID,
  demand: 0,
  status: "ready",
  created: model.time?.released ?? Date.now(),
  providerID: model.providerID,
  modelID: model.modelID ?? model.id,
});

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

export default function AgentConversation({ agent, modelsData = [] }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [commands, setCommands] = useState([]);
  const [models, setModels] = useState([]);
  const [modelState, setModelState] = useState({
    id: agent?.id ?? "",
    settings: { model: null },
  });
  const [permissions, setPermissions] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [replyingPermission, setReplyingPermission] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const scrollRef = useRef(null);
  const modelKeyRef = useRef(null);
  const chatAIModelKey = useMemo(
    () =>
      (modelsData ?? [])
        .map((model) => model.id)
        .filter(Boolean)
        .sort()
        .join("\u0000"),
    [modelsData],
  );
  const chatAIModelIds = useMemo(
    () => new Set(chatAIModelKey ? chatAIModelKey.split("\u0000") : []),
    [chatAIModelKey],
  );

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

  const refreshPermissions = useCallback(async () => {
    if (!agent?.sessionId) return [];
    const next = await listOpencodePermissions(agent, agent.sessionId);
    setPermissions(next);
    return next;
  }, [agent]);

  const startPolling = useCallback(
    (sentAt) => {
      let polls = 0;
      const poll = async () => {
        try {
          const [next] = await Promise.all([refresh(), refreshPermissions()]);
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
    },
    [refresh, refreshPermissions, t],
  );

  useEffect(() => {
    if (!agent?.sessionId) return;
    let cancelled = false;
    setMessages([]);
    setPermissions([]);
    setInput("");
    setError("");
    setSending(false);
    setStopping(false);
    setAborted(false);
    stopPolling();
    Promise.all([refresh(), refreshPermissions()]).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    });
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [agent, refresh, refreshPermissions, stopPolling]);

  useEffect(() => {
    if (!agent?.sessionId) return;
    let cancelled = false;
    Promise.all([
      listOpencodeModels(agent),
      listOpencodeCommands(agent).catch(() => []),
      getOpencodeSession(agent, agent.sessionId).catch(() => null),
      getOpencodeDefaultModel(agent).catch(() => null),
    ])
      .then(([rawModels, rawCommands, session, defaultModel]) => {
        if (cancelled) return;
        setCommands(rawCommands ?? []);
        const nextModels = (rawModels ?? [])
          .filter((model) => model?.enabled !== false)
          .map(toModelInfo)
          .filter(
            (model) =>
              chatAIModelIds.has(model.id) ||
              chatAIModelIds.has(model.modelID),
          );
        setModels(nextModels);
        const current = session?.model ?? defaultModel;
        const currentModel = current
          ? (nextModels.find(
              (model) =>
                model.id === current.id &&
                (!current.providerID ||
                  model.providerID === current.providerID),
            ) ?? null)
          : null;
        const selected = currentModel ?? nextModels[0] ?? null;
        modelKeyRef.current = currentModel
          ? `${currentModel.providerID ?? ""}:${currentModel.id}`
          : null;
        setModelState({ id: agent.id, settings: { model: selected } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent, chatAIModelIds]);

  useEffect(() => {
    const model = modelState.settings.model;
    if (!model || !agent?.sessionId) return;
    const key = `${model.providerID ?? ""}:${model.id}`;
    if (modelKeyRef.current === key) return;
    modelKeyRef.current = key;
    void setOpencodeModel(agent, agent.sessionId, model).catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [agent, modelState.settings.model]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending, aborted]);

  const stop = async () => {
    if (!sending || !agent?.sessionId || stopping) return;
    setStopping(true);
    setError("");
    try {
      await interruptOpencodeSession(agent, agent.sessionId);
      stopPolling();
      setSending(false);
      setAborted(true);
      await Promise.all([refresh(), refreshPermissions()]).catch(() => {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setStopping(false);
    }
  };

  const answerPermission = async (request, decision) => {
    if (!agent?.sessionId || replyingPermission) return;
    setReplyingPermission(request.id);
    setError("");
    try {
      await replyOpencodePermission(
        agent,
        agent.sessionId,
        request.id,
        decision,
      );
      setPermissions((current) =>
        current.filter((item) => item.id !== request.id),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setReplyingPermission(null);
    }
  };

  const commandOptions = useMemo(() => {
    const options = commands.map((command) => ({
      name: command.name,
      description: command.description,
    }));
    if (!options.some((command) => command.name === "compact")) {
      options.unshift({
        name: "compact",
        description: t("agents.compact_command"),
      });
    }
    return options;
  }, [commands, t]);

  const runCommand = async (name) => {
    if (!name || sending || !agent?.sessionId) return;
    setSending(true);
    setAborted(false);
    setError("");
    try {
      if (name === "compact") {
        await compactOpencodeSession(agent, agent.sessionId);
      } else {
        await sendOpencodeCommand(agent, agent.sessionId, name, "");
      }
      startPolling(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSending(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !agent?.sessionId) return;
    setSending(true);
    setAborted(false);
    setError("");
    setInput("");
    try {
      if (text.startsWith("/")) {
        const [name, ...rest] = text.slice(1).split(/\s+/);
        if (name === "compact") {
          await compactOpencodeSession(agent, agent.sessionId);
        } else {
          await sendOpencodeCommand(
            agent,
            agent.sessionId,
            name,
            rest.join(" "),
          );
        }
        startPolling(Date.now());
        return;
      }
      if (text.startsWith("!")) {
        await runOpencodeShell(agent, agent.sessionId, text.slice(1).trim());
        startPolling(Date.now());
        return;
      }
      const result = await sendOpencodePrompt(agent, agent.sessionId, text);
      const sentAt = result?.data?.time?.created ?? Date.now();
      startPolling(sentAt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setInput(text);
      setSending(false);
    }
  };

  const timeline = messages.flatMap((message) => {
    if (message.type === "idle" && message.outcome === "interrupted") {
      // The local marker is shown immediately after an abort; the persisted idle marker
      // takes over after the page mounts or the user switches conversations.
      return aborted ? [] : [{ kind: "aborted", message }];
    }
    const text = messageText(message);
    return text.trim() ? [{ kind: "message", message, text }] : [];
  });

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
        {timeline.length === 0 && !sending ? (
          <p className="text-sm text-base-content/50">
            {t("agents.chat_empty")}
          </p>
        ) : (
          timeline.map((item) =>
            item.kind === "aborted" ? (
              <p
                key={item.message.id}
                className="self-center rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/60"
              >
                {t("agents.aborted_by_user")}
              </p>
            ) : (
              <div
                key={item.message.id}
                className={`flex ${
                  item.message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm ${
                    item.message.type === "user"
                      ? "whitespace-pre-wrap bg-accent text-accent-content"
                      : "markdown-body bg-base-200 text-base-content"
                  }`}
                >
                  {item.message.type === "user" ? (
                    item.text
                  ) : (
                    <SafeMarkdown components={rendererComponents}>
                      {item.text}
                    </SafeMarkdown>
                  )}
                </div>
              </div>
            ),
          )
        )}
        {aborted && (
          <p className="self-center rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/60">
            {t("agents.aborted_by_user")}
          </p>
        )}
        {sending && (
          <p className="flex items-center gap-2 text-xs text-base-content/60">
            <span className="loading loading-spinner loading-xs" />
            {t("agents.working")}
          </p>
        )}
      </div>

      <div className="border-t border-base-300 p-3">
        {permissions.map((request) => (
          <div
            key={request.id}
            className="mb-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs"
          >
            <p className="font-medium text-warning">
              {t("agents.permission_title")}
            </p>
            <p className="mt-0.5 break-words text-base-content/80">
              {request.action}
              {request.resources?.length
                ? `: ${request.resources.join(", ")}`
                : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                className="btn btn-xs btn-success"
                onClick={() => answerPermission(request, "once")}
                disabled={replyingPermission === request.id}
              >
                {t("agents.permission_once")}
              </button>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => answerPermission(request, "always")}
                disabled={replyingPermission === request.id}
              >
                {t("agents.permission_always")}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-error"
                onClick={() => answerPermission(request, "reject")}
                disabled={replyingPermission === request.id}
              >
                {t("agents.permission_reject")}
              </button>
            </div>
          </div>
        ))}
        {error && <p className="mb-2 text-xs text-error">{error}</p>}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              sending &&
              ((event.key === "Escape") ||
                ((event.ctrlKey || event.metaKey) &&
                  event.key.toLowerCase() === "c" &&
                  event.currentTarget.selectionStart ===
                    event.currentTarget.selectionEnd))
            ) {
              event.preventDefault();
              void stop();
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          className="textarea textarea-bordered min-h-16 w-full resize-none"
          placeholder={t("agents.chat_empty")}
        />
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <select
            value=""
            onChange={(event) => {
              void runCommand(event.target.value);
              event.target.value = "";
            }}
            disabled={sending || commandOptions.length === 0}
            aria-label={t("agents.commands")}
            className="select select-bordered select-sm w-full max-w-[14rem]"
          >
            <option value="">{t("agents.commands")}</option>
            {commandOptions.map((command) => (
              <option key={command.name} value={command.name}>
                {command.name}
                {command.description ? ` — ${command.description}` : ""}
              </option>
            ))}
          </select>
          <ModelButton
            localState={modelState}
            setLocalState={setModelState}
            modelsData={models}
          />
          <div className="flex items-center justify-end gap-2">
            {sending && (
              <Tooltip text={t("common.abort")}>
                <button
                  type="button"
                  className="h-7 w-7 cursor-pointer"
                  onClick={stop}
                  disabled={stopping}
                  aria-label={t("common.abort")}
                >
                  {stopping ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <StopFilled size={28} className="text-accent" />
                  )}
                </button>
              </Tooltip>
            )}
            <SendButton
              localState={{
                ...modelState,
                messages: [
                  ...(sending
                    ? [{ role: "assistant", content: [], loading: true }]
                    : []),
                  { role: "user", content: [{ type: "text", text: input }] },
                ],
              }}
              setLocalState={setModelState}
              handleSend={send}
              prompt={input}
            />
          </div>
        </div>
        <p className="mt-1 text-[10px] text-base-content/50">
          {t("agents.command_hint")}
        </p>
      </div>
    </section>
  );
}
