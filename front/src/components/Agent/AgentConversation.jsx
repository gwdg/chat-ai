import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router";
import {
  Attachment,
  Bot,
  Copy,
  StopFilled,
  Terminal,
  Tools,
} from "@carbon/icons-react";
import { CloudOff, Info, TriangleAlert, X } from "lucide-react";

import {
  clearAgentDraft,
  loadAgentDraft,
  saveAgentDraft,
} from "../../agents/agentDrafts";
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
import { getAgent, updateAgent } from "../../agents/agentStore";
import {
  inspectAgentRecovery,
  restoreCachedSessions,
} from "../../agents/agentRecovery";
import {
  CACHE_REVALIDATE_MS,
  syncSessionHistory,
} from "../../agents/agentSessions";
import {
  loadAgentPermissionPolicies,
  matchPermissionPolicy,
} from "../../agents/agentPermissionPolicies";
import {
  loadAgentSessionMessages,
  removeAgentSessionCache,
  saveAgentSessionMessages,
} from "../../db/agentSessionCache";
import { isInternalShellCommand } from "../../utils/gitLog";
import { formatModifiedTime } from "../../utils/conversationDates";
import {
  compactOpencodeSession,
  createOpencodeSession,
  deleteOpencodeSession,
  getOpencodeDefaultModel,
  getOpencodeSession,
  getOpencodeSessionStatus,
  interruptOpencodeSession,
  listOpencodeAgents,
  listOpencodeCommands,
  listOpencodeForms,
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
import {
  rendererComponents,
  SafeMarkdown,
} from "../Conversation/MessageAssistant/MarkdownRenderer";
import AgentWorkspaceButton from "./AgentWorkspaceButton";
import AgentFormCard from "./AgentFormCard";
import AgentFormResultCard from "./AgentFormResultCard";
import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import generateConversationSummary from "../../apis/generateConversationSummary";
import { conversationSummarySignature } from "../../utils/conversationSummary";
import {
  selectConversationSummaries,
  selectUserSettings,
} from "../../Redux/reducers/userSettingsReducer";


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

const summaryMessage = (message) => {
  if (message?.type === "user") {
    return message.text
      ? { role: "user", content: [{ type: "text", text: message.text }] }
      : null;
  }
  if (message?.type !== "assistant") return null;
  const text = messageParts(message)
    .map((part) => (part.type === "text" ? part.text || "" : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  return text
    ? { role: "assistant", content: [{ type: "text", text }] }
    : null;
};

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

const sessionStatusValue = (value) =>
  typeof value === "string"
    ? value
    : String(value?.type ?? value?.status ?? value?.state ?? "");

const sessionIsWorking = (value) =>
  /busy|running|working|active|pending|retry|permission/i.test(
    sessionStatusValue(value),
  );

export default function AgentConversation({
  agent,
  modelsData = [],
  onOpenFile,
  bridgeStatus = "off",
  bridgeError = "",
  bridgeFailure = "",
  bridgeUnavailable = false,
}) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const focusMessageId = searchParams.get("message");
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
  const [offline, setOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoredHistory, setRestoredHistory] = useState(false);
  const pollTokensRef = useRef(new Set());
  const scrollRef = useRef(null);
  const agentRef = useRef(agent);
  const sessionIdentityRef = useRef(null);
  const sessionGenerationRef = useRef(0);
  const summaryTargetRef = useRef(null);
  agentRef.current = agent;
  const sessionIdentity =
    agent?.id && agent?.sessionId ? `${agent.id}:${agent.sessionId}` : null;
  if (sessionIdentityRef.current !== sessionIdentity) {
    sessionIdentityRef.current = sessionIdentity;
    sessionGenerationRef.current += 1;
  }
  const modelKeyRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingShellRef = useRef(null);
  const shellMessagesRef = useRef(new Map());
  const formHistoryRef = useRef([]);
  const permissionPoliciesRef = useRef([]);
  const autoReplyingRef = useRef(new Set());
  const summaryMessagesRef = useRef(new Map());
  const serverMessagesRef = useRef([]);
  const lastServerMessageIdRef = useRef(null);
  const forceFullSyncRef = useRef(false);
  const restoredHistoryRef = useRef(false);
  const summariesEnabled = useSelector(selectConversationSummaries);
  const summaryUserSettings = useSelector(selectUserSettings);
  const summarySettingsRef = useRef({
    enabled: summariesEnabled,
    userSettings: summaryUserSettings,
  });

  summarySettingsRef.current = {
    enabled: summariesEnabled,
    userSettings: summaryUserSettings,
  };
  const summaryKey =
    agent?.id && agent?.sessionId
      ? `${agent.id}:${agent.sessionId}`
      : null;
  if (summaryKey) summaryMessagesRef.current.set(summaryKey, messages);

  const updatePendingShell = useCallback((value) => {
    pendingShellRef.current = value;
    setPendingShell(value);
  }, []);
  const updateInput = useCallback(
    (value) => {
      setInput(value);
      if (agent?.id && agent?.sessionId) {
        saveAgentDraft(agent.id, agent.sessionId, value);
      }
    },
    [agent?.id, agent?.sessionId],
  );
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

  const cancelPollToken = useCallback((token) => {
    if (!token) return;
    token.cancelled = true;
    if (token.timer) {
      clearTimeout(token.timer);
      token.timer = null;
    }
    pollTokensRef.current.delete(token);
  }, []);

  const createPollToken = useCallback(() => {
    const token = { cancelled: false, timer: null };
    pollTokensRef.current.add(token);
    return token;
  }, []);

  const stopPolling = useCallback(() => {
    for (const token of [...pollTokensRef.current]) cancelPollToken(token);
  }, [cancelPollToken]);

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
      const visible = next.filter(
        (message) => !isInternalShellCommand(message),
      );
      let changed = false;
      for (const message of visible) {
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
      return mergeAgentMessages(visible, shellMessagesRef.current);
    },
    [persistShellMessages],
  );

  const refresh = useCallback(async () => {
    const currentAgent = agentRef.current;
    const sessionId = currentAgent?.sessionId;
    const generation = sessionGenerationRef.current;
    if (!sessionId) return [];
    const isStale = () =>
      agentRef.current?.sessionId !== sessionId ||
      sessionGenerationRef.current !== generation;
    const previousMessages = serverMessagesRef.current;
    // A compaction rewrites the history in place, so that sync starts from scratch.
    const synced = await syncSessionHistory(
      currentAgent,
      sessionId,
      previousMessages,
      lastServerMessageIdRef.current,
      {
        full: forceFullSyncRef.current,
        keepWhenEmpty: restoredHistoryRef.current,
      },
    );
    if (isStale()) return [];
    forceFullSyncRef.current = false;
    if (
      !synced.messages.length &&
      previousMessages.length &&
      !restoredHistoryRef.current
    ) {
      // An empty answer usually means the session was cleared. If the session is actually gone
      // from the server, keep the cached history instead of letting the empty read wipe it.
      const diagnosis = await inspectAgentRecovery(currentAgent).catch(
        () => null,
      );
      if (isStale()) return [];
      if (
        diagnosis?.reachable &&
        diagnosis.missing.some(
          (entry) => entry.session.id === sessionId,
        )
      ) {
        setRecovery(diagnosis);
        return previousMessages;
      }
    }
    if (isStale()) return [];
    serverMessagesRef.current = synced.messages;
    lastServerMessageIdRef.current = synced.lastMessageId;

    const visible = mergeShellMessages(synced.messages);
    const syncedAt = Date.now();
    setMessages(visible);
    setOffline(false);
    setCachedAt(syncedAt);
    if (restoredHistoryRef.current && synced.replace) {
      // The server now has its own timeline, so stop preserving the restored transcript.
      restoredHistoryRef.current = false;
      setRestoredHistory(false);
    }
    if (currentAgent.id) {
      void saveAgentSessionMessages(
        currentAgent.id,
        sessionId,
        synced.changed,
        {
          startIndex: synced.startIndex,
          replace: synced.replace,
          lastMessageId: synced.lastMessageId,
          syncedAt,
        },
      ).catch(() => {});
    }
    return visible;
  }, [mergeShellMessages]);

  const refreshPermissions = useCallback(async () => {
    const currentAgent = agentRef.current;
    const sessionId = currentAgent?.sessionId;
    if (!sessionId) return [];
    const next = await listOpencodePermissions(currentAgent, sessionId);
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
        currentAgent,
        sessionId,
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
  }, []);

  const refreshForms = useCallback(async () => {
    const currentAgent = agentRef.current;
    if (!currentAgent?.sessionId) return [];
    const next = await listOpencodeForms(
      currentAgent,
      currentAgent.sessionId,
    );
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
  }, [replaceFormHistory]);

  const reportSyncFailure = useCallback(
    async (reason) => {
      const currentAgent = agentRef.current;
      // Keep the cached conversation readable when the server is gone. Without a cache the
      // banner explains the empty timeline, so no raw fetch error is needed.
      setOffline(true);
      if (!serverMessagesRef.current.length) setCachedAt(null);
      // A reachable server that lost the session is a different problem: offer to restore the
      // cached sessions instead of claiming the agent is unreachable.
      const diagnosis = await inspectAgentRecovery(currentAgent).catch(
        () => null,
      );
      if (!diagnosis?.reachable) return;
      setOffline(false);
      if (diagnosis.missing.length) {
        setRecovery(diagnosis);
        return;
      }
      const currentExists = (diagnosis.serverSessions || []).some(
        (session) => session?.id === currentAgent?.sessionId,
      );
      if (currentAgent?.sessionId && !currentExists) {
        setError(t("agents.session_missing"));
        return;
      }
      if (reason) {
        setError(
          reason instanceof Error ? reason.message : String(reason),
        );
      }
    },
    [t],
  );

  const retrySync = useCallback(async () => {
    try {
      await Promise.all([refresh(), refreshPermissions(), refreshForms()]);
      setError("");
    } catch (reason) {
      reportSyncFailure(reason);
    }
  }, [refresh, refreshPermissions, refreshForms, reportSyncFailure]);

  const restoreMissingSessions = useCallback(() => {
    const missing = recovery?.missing || [];
    if (!agent?.id || !missing.length || restoring) return;
    confirmAction(
      {
        warningKey: "warn_restore_agent_sessions",
        messageKey: "alert.restore_agent_sessions",
        confirmKey: "alert.restore_agent_sessions_yes",
      },
      () => {
        void (async () => {
          setRestoring(true);
          try {
            const restored = await restoreCachedSessions(agent, missing);
            setRecovery(null);
            setOffline(false);
            if (restored.length) {
              notifySuccess(
                t("agents.restore_sessions_done", {
                  count: restored.length,
                }),
              );
            } else {
              notifyError(t("agents.restore_sessions_none"));
            }
          } catch (reason) {
            notifyError(
              reason instanceof Error ? reason.message : String(reason),
            );
          } finally {
            setRestoring(false);
          }
        })();
      },
    );
  }, [
    agent,
    recovery,
    restoring,
    confirmAction,
    notifySuccess,
    notifyError,
    t,
  ]);

  useEffect(() => {
    // Without a session id the normal sync never runs, so check the cache directly: an agent
    // that came back empty can still restore its sessions from here.
    if (!agent?.id || agent?.sessionId) return;
    let cancelled = false;
    setRecovery(null);
    void inspectAgentRecovery(agent)
      .then((diagnosis) => {
        if (cancelled) return;
        if (diagnosis?.reachable && diagnosis.missing.length) {
          setRecovery(diagnosis);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent?.id, agent?.sessionId]);

  const startPolling = useCallback(
    (sentAt) => {
      const token = createPollToken();
      let polls = 0;
      const poll = async () => {
        if (token.cancelled) return;
        try {
          const [next] = await Promise.all([
            refresh(),
            refreshPermissions(),
            refreshForms(),
          ]);
          if (token.cancelled) return;
          const finished = next.some(
            (message) =>
              message.type === "idle" &&
              (message.time?.created ?? 0) >= sentAt,
          );
          if (finished) {
            setSending(false);
            cancelPollToken(token);
            return;
          }
        } catch (reason) {
          if (token.cancelled) return;
          reportSyncFailure(reason);
          setSending(false);
          cancelPollToken(token);
          return;
        }
        if (token.cancelled) return;
        polls += 1;
        if (polls >= MAX_POLLS) {
          setError(t("agents.chat_timeout"));
          setSending(false);
          cancelPollToken(token);
          return;
        }
        token.timer = setTimeout(poll, POLL_INTERVAL);
      };
      token.timer = setTimeout(poll, 500);
    },
    [
      cancelPollToken,
      createPollToken,
      refresh,
      refreshPermissions,
      reportSyncFailure,
      t,
    ],
  );

  const startStatusPolling = useCallback(() => {
    const token = createPollToken();
    const startedAt = Date.now();
    let polls = 0;
    const poll = async () => {
      if (token.cancelled) return;
      const currentAgent = agentRef.current;
      if (!currentAgent?.sessionId) {
        cancelPollToken(token);
        return;
      }
      try {
        const [next, , , statuses] = await Promise.all([
          refresh(),
          refreshPermissions(),
          refreshForms(),
          getOpencodeSessionStatus(currentAgent).catch(() => null),
        ]);
        if (token.cancelled) return;
        const finishedByStatus =
          statuses &&
          !sessionIsWorking(statuses?.[currentAgent.sessionId]);
        const finishedByMessage = next.some(
          (message) =>
            message.type === "idle" &&
            (message.time?.created ?? 0) >= startedAt,
        );
        if (finishedByStatus || (!statuses && finishedByMessage)) {
          setSending(false);
          cancelPollToken(token);
          return;
        }
      } catch (reason) {
        if (token.cancelled) return;
        reportSyncFailure(reason);
        setSending(false);
        cancelPollToken(token);
        return;
      }
      if (token.cancelled) return;
      polls += 1;
      if (polls >= 1800) {
        setSending(false);
        cancelPollToken(token);
        return;
      }
      token.timer = setTimeout(poll, POLL_INTERVAL);
    };
    token.timer = setTimeout(poll, 700);
  }, [
    cancelPollToken,
    createPollToken,
    refresh,
    refreshPermissions,
    refreshForms,
    reportSyncFailure,
  ]);

  const startShellPolling = useCallback(
    (baseline) => {
      const token = createPollToken();
      let polls = 0;
      const poll = async () => {
        if (token.cancelled) return;
        try {
          const next = await refresh();
          if (token.cancelled) return;
          const shell = [...next]
            .reverse()
            .find(
              (message) =>
                message.type === "shell" && !baseline.has(message.id),
            );
          if (shell) updatePendingShell(null);
          if (shell && shell.status !== "running") {
            setSending(false);
            cancelPollToken(token);
            return;
          }
        } catch (reason) {
          if (token.cancelled) return;
          reportSyncFailure(reason);
          updatePendingShell(null);
          setSending(false);
          cancelPollToken(token);
          return;
        }
        if (token.cancelled) return;
        polls += 1;
        if (polls >= MAX_POLLS) {
          setError(t("agents.shell_timeout"));
          updatePendingShell(null);
          setSending(false);
          cancelPollToken(token);
          return;
        }
        token.timer = setTimeout(poll, POLL_INTERVAL);
      };
      token.timer = setTimeout(poll, 400);
    },
    [
      cancelPollToken,
      createPollToken,
      refresh,
      reportSyncFailure,
      t,
      updatePendingShell,
    ],
  );

  const flushSessionSummary = useCallback((key, agentId, sessionId) => {
    const settings = summarySettingsRef.current;
    const snapshot = summaryMessagesRef.current.get(key) ?? [];
    summaryMessagesRef.current.delete(key);
    if (!settings.enabled) return;
    const summaryMessages = snapshot.map(summaryMessage).filter(Boolean);
    if (!summaryMessages.length) return;
    const sourceHash = conversationSummarySignature(summaryMessages);
    const existing = getAgent(agentId)?.sessionSummaries?.[sessionId];
    if (!sourceHash || existing?.sourceHash === sourceHash) {
      return;
    }
    void (async () => {
      try {
        const summary = await generateConversationSummary({
          localState: { messages: summaryMessages },
          userSettings: settings.userSettings,
          short: true,
        });
        if (!summary) return;
        const current = getAgent(agentId);
        updateAgent(agentId, {
          sessionSummaries: {
            ...(current?.sessionSummaries || {}),
            [sessionId]: {
              summary,
              sourceHash,
              updatedAt: Date.now(),
            },
          },
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const current = agentRef.current;
    const next =
      summaryKey && current?.id && current.sessionId
        ? {
            key: summaryKey,
            agentId: current.id,
            sessionId: current.sessionId,
          }
        : null;
    const previous = summaryTargetRef.current;
    summaryTargetRef.current = next;
    if (!previous || previous.key === next?.key) return;
    flushSessionSummary(previous.key, previous.agentId, previous.sessionId);
  }, [flushSessionSummary, summaryKey]);

  useEffect(() => {
    if (!summariesEnabled || !agent?.id || !agent?.sessionId) return;
    const existing = getAgent(agent.id)?.sessionSummaries?.[agent.sessionId];
    if (existing?.summary) return;
    const summaryMessages = messages.map(summaryMessage).filter(Boolean);
    if (!summaryMessages.length) return;
    const sourceHash = conversationSummarySignature(summaryMessages);
    if (!sourceHash) return;
    const timer = window.setTimeout(() => {
      const settings = summarySettingsRef.current;
      if (!settings.enabled) return;
      void (async () => {
        try {
          const summary = await generateConversationSummary({
            localState: { messages: summaryMessages },
            userSettings: settings.userSettings,
            short: true,
          });
          if (!summary) return;
          const current = getAgent(agent.id);
          if (current?.sessionSummaries?.[agent.sessionId]?.summary) return;
          updateAgent(agent.id, {
            sessionSummaries: {
              ...(current?.sessionSummaries || {}),
              [agent.sessionId]: {
                summary,
                sourceHash,
                updatedAt: Date.now(),
              },
            },
          });
        } catch {}
      })();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [agent?.id, agent?.sessionId, messages, summariesEnabled]);

  useEffect(() => {
    const currentAgent = agentRef.current;
    if (!currentAgent?.sessionId) return;
    let cancelled = false;
    setMessages([]);
    setPermissions([]);
    setForms([]);
    const storedForms = loadAgentFormHistory(
      currentAgent.id,
      currentAgent.sessionId,
    );
    formHistoryRef.current = storedForms;
    setFormHistory(storedForms);
    autoReplyingRef.current.clear();
    setReplyingForm(null);
    shellMessagesRef.current = new Map(
      loadAgentShellHistory(currentAgent.id, currentAgent.sessionId).map(
        (message) => [message.shellID, message],
      ),
    );
    updatePendingShell(null);
    setInput(loadAgentDraft(currentAgent.id, currentAgent.sessionId));
    setError("");
    setSending(false);
    setStopping(false);
    setAborted(false);
    setOffline(false);
    setCachedAt(null);
    setRecovery(null);
    restoredHistoryRef.current = false;
    setRestoredHistory(false);
    serverMessagesRef.current = [];
    lastServerMessageIdRef.current = null;
    forceFullSyncRef.current = false;
    stopPolling();

    const load = async () => {
      const activeAgent = agentRef.current;
      if (!activeAgent?.sessionId) return;
      // Show the cached timeline immediately, then sync only what the server has since then.
      const cached = await loadAgentSessionMessages(
        activeAgent.id,
        activeAgent.sessionId,
      ).catch(() => null);
      if (cancelled) return;
      if (cached?.restoredFrom) {
        // The transcript lives in the session's instructions and is not part of the server
        // timeline, so an empty download must not delete it from view.
        restoredHistoryRef.current = true;
        setRestoredHistory(true);
      }
      if (cached?.messages?.length && serverMessagesRef.current.length === 0) {
        serverMessagesRef.current = cached.messages;
        lastServerMessageIdRef.current = cached.lastMessageId;
        setMessages(mergeShellMessages(cached.messages));
        setCachedAt(cached.syncedAt);
        // Older caches are reconciled in full once, so a rewrite made by another client
        // eventually replaces the local copy instead of leaving stale messages behind.
        forceFullSyncRef.current =
          !cached.syncedAt ||
          Date.now() - cached.syncedAt > CACHE_REVALIDATE_MS;
      }
      try {
        await Promise.all([refresh(), refreshPermissions(), refreshForms()]);
      } catch (reason) {
        if (!cancelled) reportSyncFailure(reason);
      }
    };
    void load();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [
    agent?.id,
    agent?.sessionId,
    mergeShellMessages,
    refresh,
    refreshPermissions,
    refreshForms,
    reportSyncFailure,
    stopPolling,
  ]);

  useEffect(() => {
    // A revert rewrites the history in place rather than appending, so re-read all of it.
    const onHistoryChanged = (event) => {
      const detail = event?.detail || {};
      const currentAgent = agentRef.current;
      if (!currentAgent?.id || detail.agentId !== currentAgent.id) return;
      if (detail.sessionId && detail.sessionId !== currentAgent.sessionId) {
        return;
      }
      forceFullSyncRef.current = true;
      void refresh().catch((reason) => reportSyncFailure(reason));
    };
    window.addEventListener("chatai:agent-history-changed", onHistoryChanged);
    return () =>
      window.removeEventListener(
        "chatai:agent-history-changed",
        onHistoryChanged,
      );
  }, [agent?.id, agent?.sessionId, refresh, reportSyncFailure]);

  useEffect(() => {
    const currentAgent = agentRef.current;
    if (!currentAgent?.id || !currentAgent?.sessionId) return;
    let cancelled = false;
    void getOpencodeSessionStatus(currentAgent)
      .then((statuses) => {
        if (cancelled) return;
        if (sessionIsWorking(statuses?.[currentAgent.sessionId])) {
          setSending(true);
          startStatusPolling();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent?.id, agent?.sessionId, startStatusPolling]);


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
    const currentAgent = agentRef.current;
    if (!currentAgent?.sessionId) return;
    let cancelled = false;
    Promise.all([
      listOpencodeModels(currentAgent),
      listOpencodeCommands(currentAgent).catch(() => []),
      listOpencodeAgents(currentAgent).catch(() => []),
      getOpencodeSession(currentAgent, currentAgent.sessionId).catch(
        () => null,
      ),
      getOpencodeDefaultModel(currentAgent).catch(() => null),
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
        setModelState({ id: currentAgent.id, settings: { model: selected } });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [agent?.id, agent?.sessionId, chatAIModelIds]);

  useEffect(() => {
    const model = modelState.settings.model;
    const currentAgent = agentRef.current;
    if (!model || !currentAgent?.sessionId) return;
    const key = `${model.providerID ?? ""}:${model.id}`;
    if (modelKeyRef.current === key) return;
    modelKeyRef.current = key;
    void setOpencodeModel(
      currentAgent,
      currentAgent.sessionId,
      model,
    ).catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [
    agent?.id,
    agent?.sessionId,
    modelState.settings.model,
  ]);

  useEffect(() => {
    const currentAgent = agentRef.current;
    if (!currentAgent?.sessionId) return;
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
      if (
        (type === "session.shell.started" || type === "session.shell.ended") &&
        isInternalShellCommand(shell)
      ) {
        return;
      }
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
    subscribeOpencodeEvents(currentAgent, handleEvent, controller.signal).catch(
      () => {},
    );
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [
    agent?.id,
    agent?.sessionId,
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
      clearAgentShellHistory(agent.id, previousSessionId);
      clearAgentFormHistory(agent.id, previousSessionId);
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
      clearAgentDraft(agent.id, previousSessionId);
      setInput("");
      setSending(false);
      setStopping(false);
      setAborted(false);
      updateAgent(agent.id, { sessionId: session.id });
      await deleteOpencodeSession(agent, previousSessionId).catch(() => {});
      await removeAgentSessionCache(agent.id, previousSessionId).catch(
        () => {},
      );
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
        // Compaction rewrites the timeline in place; re-read it instead of tail-merging.
        forceFullSyncRef.current = true;
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
    try {
      const statuses = await getOpencodeSessionStatus(agent).catch(() => null);
      if (statuses && sessionIsWorking(statuses?.[agent.sessionId])) {
        startStatusPolling();
        notifyError(t("agents.session_busy"));
        return;
      }
      updateInput("");
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
          forceFullSyncRef.current = true;
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
      updateInput(text);
      setSending(false);
    }
  };

  const shellRunning = messages.some(
    (message) => message.type === "shell" && message.status === "running",
  );
  const packageMessage =
    agent?.initialMessage?.text &&
    (!agent.initialMessageSessionId ||
      agent.initialMessageSessionId === agent.sessionId)
      ? agent.initialMessage
      : null;

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

  useEffect(() => {
    if (!focusMessageId) return;
    let timer = null;
    let observer = null;
    const highlight = () => {
      const element = document.getElementById(
        `agent-message-${focusMessageId}`,
      );
      if (!element) return false;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-accent", "rounded-xl");
      timer = window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-accent", "rounded-xl");
      }, 2200);
      return true;
    };
    if (!highlight()) {
      observer = new MutationObserver(() => {
        if (highlight()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [focusMessageId]);

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
          {agent.createdAt ? (
            <p className="truncate text-[10px] tabular-nums text-base-content/50">
              {[
                t("common.created", {
                  date: formatModifiedTime(agent.createdAt, i18n.language),
                }),
                t("common.modified", {
                  date: formatModifiedTime(
                    agent.updatedAt ?? agent.createdAt,
                    i18n.language,
                  ),
                }),
              ].join(" · ")}
            </p>
          ) : null}
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

      {recovery?.missing?.length ? (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-base-content/80"
          data-testid="agent-restore-banner"
        >
          <TriangleAlert size={14} className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            {t("agents.restore_sessions_banner", {
              count: recovery.missing.length,
            })}
          </span>
          <button
            type="button"
            data-guide="agent-restore-sessions"
            className="btn btn-accent btn-xs"
            disabled={restoring}
            onClick={restoreMissingSessions}
          >
            {restoring
              ? t("agents.restore_sessions_busy")
              : t("agents.restore_sessions_action")}
          </button>
        </div>
      ) : null}

      {restoredHistory && (
        <div className="flex items-start gap-2 border-b border-info/40 bg-info/10 px-4 py-2 text-xs text-base-content/80">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <span className="min-w-0 flex-1">{t("agents.restored_history")}</span>
        </div>
      )}

      {offline && (
        <div className="flex flex-wrap items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-base-content/80">
          <CloudOff size={14} className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            {cachedAt
              ? t("agents.offline_cached", {
                  time: new Date(cachedAt).toLocaleString(),
                })
              : t("agents.offline_no_cache")}
          </span>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => void retrySync()}
          >
            {t("common.refresh")}
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {packageMessage && (
          <div className="rounded-xl border border-info/30 bg-info/10 p-3">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="badge badge-info badge-xs">
                {t("agents.package_message")}
              </span>
              {packageMessage.title && (
                <span className="text-xs font-semibold text-base-content">
                  {packageMessage.title}
                </span>
              )}
            </div>
            <SafeMarkdown components={rendererComponents}>
              {packageMessage.text}
            </SafeMarkdown>
          </div>
        )}
        {timeline.length === 0 && !sending && !packageMessage ? (
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
                id={`agent-message-${item.message.id}`}
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
                id={`agent-message-${item.message.id}`}
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
                      onOpenFile={onOpenFile}
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
          onChange={(event) => updateInput(event.target.value)}
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
            <AgentWorkspaceButton
              agent={agent}
              bridgeStatus={bridgeStatus}
              bridgeError={bridgeError}
              bridgeFailure={bridgeFailure}
              bridgeUnavailable={bridgeUnavailable}
            />
            <button
              type="button"
              data-guide="agent-tools-button"
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
