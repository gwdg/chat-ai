import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Attachment,
  Bot,
  Copy,
  StopFilled,
  Terminal,
  Tools,
} from "@carbon/icons-react";
import { X } from "lucide-react";

import {
  clearAgentFormHistory,
  loadAgentFormHistory,
  saveAgentFormHistory,
} from "../../agents/agentFormHistory";
import {
  clearAgentShellHistory,
  loadAgentShellHistory,
  mergeAgentMessages,
  saveAgentShellHistory,
} from "../../agents/agentShellHistory";
import { updateAgent } from "../../agents/agentStore";
import {
  loadAgentPermissionPolicies,
  matchPermissionPolicy,
} from "../../agents/agentPermissionPolicies";
import {
  compactOpencodeSession,
  createOpencodeSession,
  deleteOpencodeSession,
  getOpencodeDefaultModel,
  getOpencodeSession,
  interruptOpencodeSession,
  listOpencodeAgents,
  listOpencodeCommands,
  listOpencodeForms,
  listOpencodeMessages,
  listOpencodeModels,
  listOpencodePermissions,
  replyOpencodeForm,
  replyOpencodePermission,
  runOpencodeShell,
  sendOpencodeCommand,
  sendOpencodePrompt,
  setOpencodeAgent,
  setOpencodeModel,
  subscribeOpencodeEvents,
} from "../../apis/opencodeAgents";
import Tooltip from "../Others/Tooltip";
import ModelButton from "../Prompt/ModelButton";
import SendButton from "../Prompt/SendButton";
import AgentAssistantParts from "./AgentAssistantParts";
import AgentFormCard from "./AgentFormCard";
import AgentFormResultCard from "./AgentFormResultCard";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";


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

const formHistoryTime = (entry) => entry?.time?.created ?? 0;

const messageParts = (message) =>
  Array.isArray(message.content)
    ? message.content
    : Array.isArray(message.parts)
      ? message.parts
      : [];

const messageText = (message) => {
  if (message.type === "user") return message.text || "";
  if (message.type !== "assistant") return "";
  return messageParts(message)
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
  const { openModal, confirmAction } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const [messages, setMessages] = useState([]);
  const [commands, setCommands] = useState([]);
  const [models, setModels] = useState([]);
  const [opencodeAgents, setOpencodeAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [lastNonPlanAgentId, setLastNonPlanAgentId] = useState("");
  const [changingAgent, setChangingAgent] = useState(false);
  const [shellMode, setShellMode] = useState(false);
  const [pendingShell, setPendingShell] = useState(null);
  const [modelState, setModelState] = useState({
    id: agent?.id ?? "",
    settings: { model: null },
  });
  const [permissions, setPermissions] = useState([]);
  const [forms, setForms] = useState([]);
  const [formHistory, setFormHistory] = useState([]);
  const [replyingForm, setReplyingForm] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [replyingPermission, setReplyingPermission] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const scrollRef = useRef(null);
  const modelKeyRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingShellRef = useRef(null);
  const shellMessagesRef = useRef(new Map());
  const formHistoryRef = useRef([]);
  const permissionPoliciesRef = useRef([]);
  const autoReplyingRef = useRef(new Set());

  const updatePendingShell = useCallback((value) => {
    pendingShellRef.current = value;
    setPendingShell(value);
  }, []);
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

  const persistShellMessages = useCallback(() => {
    if (!agent?.id || !agent?.sessionId) return;
    saveAgentShellHistory(
      agent.id,
      agent.sessionId,
      [...shellMessagesRef.current.values()],
    );
  }, [agent?.id, agent?.sessionId]);

  const persistFormHistory = useCallback(
    (entries) => {
      if (!agent?.id || !agent?.sessionId) return;
      saveAgentFormHistory(agent.id, agent.sessionId, entries);
    },
    [agent?.id, agent?.sessionId],
  );

  const replaceFormHistory = useCallback(
    (entries) => {
      formHistoryRef.current = entries;
      setFormHistory(entries);
      persistFormHistory(entries);
    },
    [persistFormHistory],
  );

  const mergeShellMessages = useCallback(
    (next) => {
      let changed = false;
      for (const message of next) {
        if (message.type !== "shell" || !message.shellID) continue;
        const existing = shellMessagesRef.current.get(message.shellID);
        if (!existing) {
          shellMessagesRef.current.set(message.shellID, message);
          changed = true;
          continue;
        }
        const finished =
          existing.status === "running" &&
          message.status &&
          message.status !== "running";
        const gainedOutput = !existing.output && message.output;
        if (finished || gainedOutput) {
          shellMessagesRef.current.set(message.shellID, {
            ...existing,
            status: finished ? message.status : existing.status,
            exit: existing.exit ?? message.exit,
            output: existing.output ?? message.output,
            time: { ...existing.time, ...message.time },
          });
          changed = true;
        }
      }
      if (changed) persistShellMessages();
      return mergeAgentMessages(next, shellMessagesRef.current);
    },
    [persistShellMessages],
  );

  const refresh = useCallback(async () => {
    if (!agent?.sessionId) return [];
    const next = mergeShellMessages(
      await listOpencodeMessages(agent, agent.sessionId),
    );
    setMessages(next);
    return next;
  }, [agent, mergeShellMessages]);

  const refreshPermissions = useCallback(async () => {
    if (!agent?.sessionId) return [];
    const next = await listOpencodePermissions(agent, agent.sessionId);
    const remaining = [];
    for (const request of next) {
      const policy = matchPermissionPolicy(
        permissionPoliciesRef.current,
        request,
      );
      if (!policy) {
        remaining.push(request);
        continue;
      }
      if (autoReplyingRef.current.has(request.id)) continue;
      autoReplyingRef.current.add(request.id);
      void replyOpencodePermission(
        agent,
        agent.sessionId,
        request.id,
        policy.decision,
      )
        .then(() => {
          setPermissions((current) =>
            current.filter((item) => item.id !== request.id),
          );
        })
        .catch((reason) => {
          autoReplyingRef.current.delete(request.id);
          setError(reason instanceof Error ? reason.message : String(reason));
        });
    }
    setPermissions(remaining);
    return remaining;
  }, [agent]);

  const refreshForms = useCallback(async () => {
    if (!agent?.sessionId) return [];
    const next = await listOpencodeForms(agent, agent.sessionId);
    setForms(next);
    const known = new Set(formHistoryRef.current.map((entry) => entry.id));
    const additions = next
      .filter((form) => form?.id && !known.has(form.id))
      .map((form) => ({
        id: form.id,
        form,
        time: { created: form.time?.created ?? Date.now() },
      }));
    if (additions.length) {
      replaceFormHistory(
        [...formHistoryRef.current, ...additions].sort(
          (left, right) => formHistoryTime(left) - formHistoryTime(right),
        ),
      );
    }
    return next;
  }, [agent, replaceFormHistory]);

  const startPolling = useCallback(
    (sentAt) => {
      let polls = 0;
      const poll = async () => {
        try {
          const [next] = await Promise.all([
            refresh(),
            refreshPermissions(),
            refreshForms(),
          ]);
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

  const startShellPolling = useCallback(
    (baseline) => {
      let polls = 0;
      const poll = async () => {
        try {
          const next = await refresh();
          const shell = [...next]
            .reverse()
            .find(
              (message) =>
                message.type === "shell" && !baseline.has(message.id),
            );
          if (shell) updatePendingShell(null);
          if (shell && shell.status !== "running") {
            setSending(false);
            return;
          }
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason));
          updatePendingShell(null);
          setSending(false);
          return;
        }
        polls += 1;
        if (polls >= MAX_POLLS) {
          setError(t("agents.shell_timeout"));
          updatePendingShell(null);
          setSending(false);
          return;
        }
        pollRef.current = setTimeout(poll, POLL_INTERVAL);
      };
      pollRef.current = setTimeout(poll, 400);
    },
    [refresh, t],
  );

  useEffect(() => {
    if (!agent?.sessionId) return;
    let cancelled = false;
    setMessages([]);
    setPermissions([]);
    setForms([]);
    const storedForms = loadAgentFormHistory(agent.id, agent.sessionId);
    formHistoryRef.current = storedForms;
    setFormHistory(storedForms);
    autoReplyingRef.current.clear();
    setReplyingForm(null);
    shellMessagesRef.current = new Map(
      loadAgentShellHistory(agent.id, agent.sessionId).map((message) => [
        message.shellID,
        message,
      ]),
    );
    updatePendingShell(null);
    setInput("");
    setError("");
    setSending(false);
    setStopping(false);
    setAborted(false);
    stopPolling();
    Promise.all([refresh(), refreshPermissions(), refreshForms()]).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    });
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [agent, refresh, refreshPermissions, refreshForms, stopPolling]);

  useEffect(() => {
    if (!agent?.id) return;
    const load = () => {
      permissionPoliciesRef.current = loadAgentPermissionPolicies(agent.id);
    };
    load();
    const onUpdate = (event) => {
      if (event.detail?.agentId === agent.id) load();
    };
    window.addEventListener("chatai:agent-policies-updated", onUpdate);
    return () => {
      window.removeEventListener("chatai:agent-policies-updated", onUpdate);
    };
  }, [agent?.id]);

  useEffect(() => {
    if (!agent?.sessionId) return;
    let cancelled = false;
    Promise.all([
      listOpencodeModels(agent),
      listOpencodeCommands(agent).catch(() => []),
      listOpencodeAgents(agent).catch(() => []),
      getOpencodeSession(agent, agent.sessionId).catch(() => null),
      getOpencodeDefaultModel(agent).catch(() => null),
    ])
      .then(([rawModels, rawCommands, rawAgents, session, defaultModel]) => {
        if (cancelled) return;
        setCommands(rawCommands ?? []);
        const nextAgents = (rawAgents ?? []).filter(
          (item) => !item.hidden && item.mode !== "subagent",
        );
        setOpencodeAgents(nextAgents);
        const planId = nextAgents.find(
          (item) => item.id === "plan" || item.name?.toLowerCase() === "plan",
        )?.id;
        const sessionAgent =
          session?.agent ??
          nextAgents.find((item) => item.id === "build")?.id ??
          nextAgents[0]?.id ??
          "";
        setSelectedAgentId(sessionAgent);
        setLastNonPlanAgentId(
          sessionAgent !== planId
            ? sessionAgent
            : nextAgents.find((item) => item.id === "build")?.id ??
                nextAgents.find((item) => item.id !== planId)?.id ??
                "",
        );
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
    if (!agent?.sessionId) return;
    const controller = new AbortController();
    let timer = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh().catch(() => {});
        void refreshPermissions().catch(() => {});
        void refreshForms().catch(() => {});
      }, 250);
    };
    const handleEvent = (event) => {
      const type = event?.type;
      const data = event?.data;
      const shell = data?.shell;
      if (type === "session.shell.started" && shell?.id) {
        const existing = shellMessagesRef.current.get(shell.id);
        shellMessagesRef.current.set(shell.id, {
          id: existing?.id ?? `shell:${shell.id}`,
          type: "shell",
          shellID: shell.id,
          command: shell.command ?? existing?.command ?? "",
          status: existing?.aborted
            ? "aborted"
            : (shell.status ?? "running"),
          aborted: existing?.aborted,
          exit: shell.exit,
          output: existing?.output,
          time: {
            ...existing?.time,
            created: event.created ?? Date.now(),
          },
        });
        persistShellMessages();
        setMessages((current) => mergeShellMessages(current));
      } else if (type === "session.shell.ended" && shell?.id) {
        const existing = shellMessagesRef.current.get(shell.id);
        shellMessagesRef.current.set(shell.id, {
          id: existing?.id ?? `shell:${shell.id}`,
          type: "shell",
          shellID: shell.id,
          command: shell.command ?? existing?.command ?? "",
          status: existing?.aborted
            ? "aborted"
            : (shell.status ?? "exited"),
          aborted: existing?.aborted,
          exit: shell.exit ?? existing?.exit,
          output: data.output ?? existing?.output,
          time: {
            ...existing?.time,
            created: existing?.time?.created ?? event.created ?? Date.now(),
            completed: event.created ?? Date.now(),
          },
        });
        persistShellMessages();
        setMessages((current) => mergeShellMessages(current));
        const pending = pendingShellRef.current;
        if (pending && shell.command === pending.command) {
          updatePendingShell(null);
          setSending(false);
        }
      }
      schedule();
    };
    subscribeOpencodeEvents(agent, handleEvent, controller.signal).catch(() => {});
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [
    agent,
    refresh,
    refreshPermissions,
    refreshForms,
    updatePendingShell,
    mergeShellMessages,
    persistShellMessages,
  ]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, sending, aborted, formHistory, forms]);

  const stop = async () => {
    const runningShells = [...shellMessagesRef.current.entries()].filter(
      ([, message]) => message.status === "running",
    );
    const hadRunningShell = runningShells.length > 0 || !!pendingShellRef.current;
    if ((!sending && !hadRunningShell) || !agent?.sessionId || stopping) return;
    setStopping(true);
    setError("");
    try {
      await interruptOpencodeSession(agent, agent.sessionId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
    try {
      stopPolling();
      setSending(false);
      setAborted(!hadRunningShell);
      if (hadRunningShell) {
        const completed = Date.now();
        for (const [id, message] of runningShells) {
          shellMessagesRef.current.set(id, {
            ...message,
            status: "aborted",
            aborted: true,
            time: { ...message.time, completed },
          });
        }
        const pending = pendingShellRef.current;
        if (runningShells.length === 0 && pending?.command) {
          const id = `pending:${completed}`;
          shellMessagesRef.current.set(id, {
            id: `shell:${id}`,
            type: "shell",
            shellID: id,
            command: pending.command,
            status: "aborted",
            aborted: true,
            time: { created: completed, completed },
          });
        }
        persistShellMessages();
        updatePendingShell(null);
        setMessages((current) =>
          mergeAgentMessages(current, shellMessagesRef.current),
        );
      }
      await Promise.all([refresh(), refreshPermissions()]).catch(() => {});
    } finally {
      setStopping(false);
    }
  };

  const resetSession = async () => {
    if (!agent?.sessionId || clearing) return;
    const previousSessionId = agent.sessionId;
    setClearing(true);
    setError("");
    try {
      await interruptOpencodeSession(agent, previousSessionId).catch(() => {});
      const session = await createOpencodeSession(
        agent,
        `${agent.name} agent`,
      );
      clearAgentShellHistory(agent.id);
      clearAgentFormHistory(agent.id);
      shellMessagesRef.current = new Map();
      formHistoryRef.current = [];
      stopPolling();
      updatePendingShell(null);
      setMessages([]);
      setPermissions([]);
      setForms([]);
      setFormHistory([]);
      setReplyingForm(null);
      setAttachments([]);
      setInput("");
      setSending(false);
      setStopping(false);
      setAborted(false);
      updateAgent(agent.id, { sessionId: session.id });
      await deleteOpencodeSession(agent, previousSessionId).catch(() => {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setClearing(false);
    }
  };

  const clearHistory = () =>
    confirmAction(
      {
        warningKey: "warn_clear_history",
        messageKey: "alert.clear_agent_history",
        confirmKey: "alert.clear_agent_history_yes",
        danger: true,
      },
      resetSession,
    );

  const answerForm = async (form, answer) => {
    if (!agent?.sessionId || replyingForm) return;
    setReplyingForm(form.id);
    setError("");
    try {
      await replyOpencodeForm(agent, agent.sessionId, form.id, answer);
      setForms((current) => current.filter((item) => item.id !== form.id));
      const submittedAt = Date.now();
      const existing = formHistoryRef.current.find(
        (entry) => entry.id === form.id,
      );
      const next = existing
        ? formHistoryRef.current.map((entry) =>
            entry.id === form.id
              ? {
                  ...entry,
                  form,
                  answers: { ...answer },
                  time: { ...entry.time, submitted: submittedAt },
                }
              : entry,
          )
        : [
            ...formHistoryRef.current,
            {
              id: form.id,
              form,
              answers: { ...answer },
              time: { created: submittedAt, submitted: submittedAt },
            },
          ];
      replaceFormHistory(next);
      await refresh().catch(() => {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setReplyingForm(null);
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

  const addFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    try {
      const next = [];
      for (const file of files) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result ?? "").split(",")[1] ?? "");
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        next.push({
          name: file.name,
          mime: file.type || "application/octet-stream",
          base64,
        });
      }
      setAttachments((current) => [...current, ...next]);
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const planAgent = useMemo(
    () =>
      opencodeAgents.find(
        (item) => item.id === "plan" || item.name?.toLowerCase() === "plan",
      ),
    [opencodeAgents],
  );

  const changeAgent = async (nextAgentId) => {
    if (!nextAgentId || nextAgentId === selectedAgentId || changingAgent) {
      return;
    }
    const previous = selectedAgentId;
    setSelectedAgentId(nextAgentId);
    setChangingAgent(true);
    setError("");
    try {
      await setOpencodeAgent(agent, agent.sessionId, nextAgentId);
      if (nextAgentId !== planAgent?.id) setLastNonPlanAgentId(nextAgentId);
    } catch (reason) {
      setSelectedAgentId(previous);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setChangingAgent(false);
    }
  };

  const togglePlan = (checked) => {
    if (checked) {
      if (planAgent) void changeAgent(planAgent.id);
      return;
    }
    const fallback =
      lastNonPlanAgentId ||
      opencodeAgents.find((item) => item.id === "build")?.id ||
      opencodeAgents.find((item) => item.id !== planAgent?.id)?.id ||
      "";
    if (fallback) void changeAgent(fallback);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !agent?.sessionId) return;
    setSending(true);
    setAborted(false);
    setError("");
    setInput("");
    try {
      if (shellMode) {
        const baseline = new Set(
          messages.filter((message) => message.type === "shell").map((message) => message.id),
        );
        updatePendingShell({ command: text });
        await runOpencodeShell(agent, agent.sessionId, text);
        startShellPolling(baseline);
        return;
      }
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
        const command = text.slice(1).trim();
        const baseline = new Set(
          messages.filter((message) => message.type === "shell").map((message) => message.id),
        );
        updatePendingShell({ command });
        await runOpencodeShell(agent, agent.sessionId, command);
        startShellPolling(baseline);
        return;
      }
      const files = attachments.map((attachment) => ({
        uri: `data:${attachment.mime};base64,${attachment.base64}`,
        name: attachment.name,
        source: { type: "inline" },
      }));
      const result = await sendOpencodePrompt(
        agent,
        agent.sessionId,
        text,
        files,
      );
      setAttachments([]);
      const sentAt = result?.data?.time?.created ?? Date.now();
      startPolling(sentAt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      updatePendingShell(null);
      setInput(text);
      setSending(false);
    }
  };

  const shellRunning = messages.some(
    (message) => message.type === "shell" && message.status === "running",
  );

  const shellStatus = (message) => {
    if (message.status === "running") {
      return { label: t("agents.shell_status_running"), className: "badge-warning" };
    }
    if (message.status === "aborted") {
      return { label: t("agents.shell_status_aborted"), className: "badge-error" };
    }
    if (message.status === "exited") {
      const succeeded = message.exit === undefined || message.exit === 0;
      return {
        label: succeeded ? t("agents.shell_status_done") : t("agents.shell_status_failed"),
        className: succeeded ? "badge-success" : "badge-error",
      };
    }
    return { label: message.status, className: "badge-error" };
  };

  const timeline = messages.flatMap((message) => {
    const time = message.time?.created ?? 0;
    if (message.type === "idle" && message.outcome === "interrupted") {
      // The local marker is shown immediately after an abort; the persisted idle marker
      // takes over after the page mounts or the user switches conversations.
      return aborted ? [] : [{ kind: "aborted", message, time }];
    }
    if (message.type === "shell") {
      return [{ kind: "shell", message, status: shellStatus(message), time }];
    }
    const parts = message.type === "assistant" ? messageParts(message) : [];
    const hasParts = parts.some((part) => {
      if (part.type === "text" || part.type === "reasoning") {
        return !!part.text?.trim();
      }
      return part.type === "tool";
    });
    const text = messageText(message);
    return text.trim() || hasParts
      ? [{ kind: "message", message, text, parts, time }]
      : [];
  });

  const activeFormIds = new Set(forms.map((form) => form.id));
  for (const entry of formHistory) {
    const answered = entry.answers !== undefined;
    const time = answered
      ? (entry.time?.submitted ?? entry.time?.created ?? 0)
      : (entry.time?.created ?? 0);
    const index = timeline.findIndex((item) => item.time > time);
    timeline.splice(index === -1 ? timeline.length : index, 0, {
      kind: answered ? "form-result" : "form",
      entry,
      active: activeFormIds.has(entry.id),
      time,
    });
  }

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
        <Tooltip text={t("agents.clear_history")}>
          <button
            type="button"
            onClick={clearHistory}
            disabled={clearing}
            data-guide="agent-clear-history"
            aria-label={t("agents.clear_history")}
            className="btn btn-ghost btn-sm btn-square shrink-0 rounded-full text-base-content/70 hover:bg-error/10 hover:text-error"
          >
            {clearing ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
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
            ) : item.kind === "form" ? (
              <AgentFormCard
                key={item.entry.id}
                form={item.entry.form}
                readOnly={!item.active}
                replying={replyingForm === item.entry.id}
                onReply={answerForm}
              />
            ) : item.kind === "form-result" ? (
              <AgentFormResultCard
                key={item.entry.id}
                form={item.entry.form}
                answers={item.entry.answers}
              />
            ) : item.kind === "shell" ? (
              <div
                key={item.message.id}
                className="rounded-xl border border-warning/30 bg-base-300/40 p-2 font-mono text-[11px]"
              >
                <div className="flex items-center gap-1.5 text-base-content/70">
                  <span className="text-warning">$</span>
                  <span className="min-w-0 flex-1 truncate">
                    {item.message.command}
                  </span>
                  <span className={`badge badge-xs ${item.status.className}`}>
                    {item.status.label}
                  </span>
                  {item.message.status === "running" && (
                    <button
                      type="button"
                      onClick={() => void stop()}
                      disabled={stopping}
                      className="flex h-4 w-4 items-center justify-center rounded text-base-content/50 hover:text-error"
                      title={t("common.abort")}
                      aria-label={t("common.abort")}
                    >
                      <StopFilled size={11} />
                    </button>
                  )}
                  {item.message.output?.output && (
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard
                          ?.writeText(item.message.output.output)
                          .then(() => notifySuccess(t("agents.shell_copied")))
                          .catch(() => {})
                      }
                      className="flex h-4 w-4 items-center justify-center rounded text-base-content/50 hover:text-base-content"
                      title={t("agents.shell_copy")}
                      aria-label={t("agents.shell_copy")}
                    >
                      <Copy size={11} />
                    </button>
                  )}
                </div>
                {item.message.output?.output ? (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-base-content">
                    {item.message.output.output}
                  </pre>
                ) : item.message.status === "running" ? (
                  <p className="mt-1 flex items-center gap-1 text-base-content/50">
                    <span className="loading loading-spinner loading-xs" />
                    {t("agents.shell_running")}
                  </p>
                ) : null}
                {item.message.exit !== undefined && (
                  <p className="mt-1 text-base-content/50">
                    {t("agents.shell_exit", { code: item.message.exit })}
                  </p>
                )}
              </div>
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
                    <AgentAssistantParts
                      parts={item.parts}
                      fallback={item.text}
                    />
                  )}
                </div>
              </div>
            ),
          )
        )}
        {pendingShell &&
          !messages.some(
            (message) =>
              message.type === "shell" &&
              message.command === pendingShell.command,
          ) && (
          <div className="rounded-xl border border-warning/30 bg-base-300/40 p-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 text-base-content/70">
              <span className="text-warning">$</span>
              <span className="min-w-0 flex-1 truncate">
                {pendingShell.command}
              </span>
              <span className="badge badge-warning badge-xs">
                {t("agents.shell")}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-base-content/50">
              <span className="loading loading-spinner loading-xs" />
              {t("agents.shell_running")}
            </p>
          </div>
        )}
        {aborted && (
          <p className="self-center rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/60">
            {t("agents.aborted_by_user")}
          </p>
        )}
        {sending && !pendingShell && !shellRunning && (
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
          className={`textarea min-h-16 w-full resize-none ${
            shellMode ? "textarea-warning" : "textarea-bordered"
          }`}
          placeholder={
            shellMode ? t("agents.shell_placeholder") : t("agents.chat_empty")
          }
        />
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {attachments.map((attachment, index) => (
              <span
                key={`${attachment.name}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-1 text-[11px]"
              >
                <span className="max-w-[12rem] truncate">{attachment.name}</span>
                <button
                  type="button"
                  className="text-base-content/50 hover:text-error"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label={t("common.delete")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={addFiles}
            />
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent hover:bg-base-200"
              onClick={() => {
                fileInputRef.current.value = null;
                fileInputRef.current.click();
              }}
              title={t("conversation.prompt.attach")}
              aria-label={t("conversation.prompt.attach")}
            >
              <Attachment size={20} />
            </button>
          </div>
          <div className="flex min-w-0 items-center justify-center gap-2">
            <Tooltip text={t("agents.shell_tooltip")}>
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-warning">
                <input
                  type="checkbox"
                  className="toggle toggle-warning toggle-xs"
                  checked={shellMode}
                  disabled={sending}
                  onChange={(event) => setShellMode(event.target.checked)}
                />
                <Terminal size={14} />
                {t("agents.shell")}
              </label>
            </Tooltip>
            {planAgent && (
              <Tooltip text={t("agents.plan_tooltip")}>
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-base-content/70">

                <input
                  type="checkbox"
                  className={`checkbox checkbox-xs ${
                    selectedAgentId === planAgent.id
                      ? "checkbox-success"
                      : "checkbox-warning"
                  }`}
                  checked={selectedAgentId === planAgent.id}
                  disabled={changingAgent || sending}
                  onChange={(event) => togglePlan(event.target.checked)}
                />
                {t("agents.plan")}
                </label>
              </Tooltip>
            )}
            <Tooltip text={t("agents.commands_tooltip")} className="min-w-0">
              <select
                value=""
                onChange={(event) => {
                  void runCommand(event.target.value);
                  event.target.value = "";
                }}
                disabled={sending || commandOptions.length === 0}
                aria-label={t("agents.commands")}
                className="select select-bordered select-sm w-[9rem] min-w-0"
              >
                <option value="">{t("agents.commands")}</option>
                {commandOptions.map((command) => (
                  <option key={command.name} value={command.name}>
                    {command.name}
                    {command.description ? ` — ${command.description}` : ""}
                  </option>
                ))}
              </select>
            </Tooltip>
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent hover:bg-base-200"
              onClick={() => openModal("agentTools", { agent })}
              title={t("agents.tools.title")}
              aria-label={t("agents.tools.title")}
            >
              <Tools size={20} />
            </button>
            <ModelButton
              localState={modelState}
              setLocalState={setModelState}
              modelsData={models}
            />
          </div>
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
      </div>
    </section>
  );
}
