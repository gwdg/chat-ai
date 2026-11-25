import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Add, Bot, Checkmark } from "@carbon/icons-react";
import { CloudOff } from "lucide-react";

import BaseModal from "../BaseModal";
import {
  attachWorkspaceAgent,
  attachWorkspaceAgentSession,
  detachWorkspaceAgentSession,
} from "../../db/workspaceDb";
import {
  fetchAgentSessions,
  sessionLabel,
} from "../../agents/agentSessions";
import {
  createWorkspaceAgentSession,
  workspaceSessionIds,
} from "../../agents/workspaceAgentSessions";

/** Flatten a session tree into pre-order rows, keeping the nesting depth. */
const flattenTree = (tree) => {
  const rows = [];
  const walk = (session, depth) => {
    rows.push({ session, depth });
    for (const child of tree?.children?.get(session.id) || []) {
      walk(child, depth + 1);
    }
  };
  for (const root of tree?.roots || []) walk(root, 0);
  return rows;
};

const SubagentBadge = () => {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded bg-base-300 px-1 text-[9px] text-base-content/60">
      {t("agents.subagent_short")}
    </span>
  );
};

/**
 * Pick the sessions that show up in a workspace.
 *
 * With an `agent` the dialog lists that agent's whole session tree and toggles each session;
 * without one it is the picker behind the workspace row's "Attach agent session" action: every
 * agent that still has a session not attached to this workspace, with those sessions below it.
 * Attaching a session also links its agent, because a workspace only lists sessions of agents
 * it contains.
 */
export default function AttachAgentSessionModal({
  isOpen,
  onClose,
  workspaceId,
  agent,
  attachedIds = [],
  agents = [],
  sessionLinks = [],
}) {
  const { t } = useTranslation();
  const single = Boolean(agent?.id);
  const [attached, setAttached] = useState(() => new Set(attachedIds));
  const [tree, setTree] = useState(null);
  const [trees, setTrees] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const attachedKey = (attachedIds || []).join("|");

  useEffect(() => {
    setAttached(new Set(attachedIds || []));
  }, [attachedKey]);

  // Single-agent mode: one tree, fetched for the agent the caller passed in.
  useEffect(() => {
    if (!isOpen || !single) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAgentSessions(agent)
      .then((next) => {
        if (!cancelled) setTree(next);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setTree(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agent, isOpen, single]);

  // Picker mode: one listing per agent at once, so one unreachable agent does not hide the
  // sessions of the others.
  const agentIdsKey = (agents || [])
    .map((item) => item?.id)
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    if (!isOpen || single) return undefined;
    const targets = (agents || []).filter((item) => item?.id);
    setErrors({});
    setNotice("");
    setError("");
    if (!targets.length) {
      setTrees({});
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled(targets.map((item) => fetchAgentSessions(item))).then(
      (results) => {
        if (cancelled) return;
        const nextTrees = {};
        const nextErrors = {};
        results.forEach((result, index) => {
          const target = targets[index];
          if (result.status === "fulfilled") {
            nextTrees[target.id] = result.value;
          } else {
            nextErrors[target.id] =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
          }
        });
        setTrees(nextTrees);
        setErrors(nextErrors);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [agentIdsKey, isOpen, single]);

  const rows = useMemo(() => (tree ? flattenTree(tree) : []), [tree]);

  // Every agent that still has a session this workspace does not show. Rows attached from
  // this dialog are dropped from the list through `attached`, so the picker keeps shrinking.
  const pickerGroups = useMemo(() => {
    if (single) return [];
    const groups = [];
    for (const target of agents || []) {
      if (!target?.id) continue;
      const targetTree = trees[target.id];
      if (!targetTree) continue;
      const linked = workspaceSessionIds(sessionLinks, workspaceId, target.id);
      const unattached = flattenTree(targetTree).filter(
        ({ session }) =>
          !linked.has(session.id) && !attached.has(session.id),
      );
      if (unattached.length) {
        groups.push({ agent: target, tree: targetTree, rows: unattached });
      }
    }
    return groups;
  }, [agents, attached, sessionLinks, single, trees, workspaceId]);

  const toggle = async (session) => {
    if (busy || !agent?.id) return;
    setBusy(true);
    try {
      if (attached.has(session.id)) {
        await detachWorkspaceAgentSession(workspaceId, agent.id, session.id);
        setAttached((current) => {
          const next = new Set(current);
          next.delete(session.id);
          return next;
        });
      } else {
        await attachWorkspaceAgent(workspaceId, agent.id);
        await attachWorkspaceAgentSession(workspaceId, agent.id, session.id);
        setAttached((current) => new Set(current).add(session.id));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const attach = async (target, session) => {
    if (busyKey || !target?.id || !session?.id) return;
    setBusyKey(`${target.id}:${session.id}`);
    setError("");
    setNotice("");
    try {
      await attachWorkspaceAgent(workspaceId, target.id);
      await attachWorkspaceAgentSession(workspaceId, target.id, session.id);
      setAttached((current) => new Set(current).add(session.id));
      setNotice(
        t("workspace.session_attached", { name: sessionLabel(session) }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyKey("");
    }
  };

  const create = async () => {
    if (busy || !agent?.id) return;
    setBusy(true);
    try {
      const session = await createWorkspaceAgentSession(workspaceId, agent);
      if (session?.id) setAttached((current) => new Set(current).add(session.id));
      setTree(await fetchAgentSessions(agent));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (agentId) =>
    agents.find((item) => item?.id === agentId)?.name || agentId;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.attach_agent_session"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <p className="text-xs text-base-content/70">
          {t(
            single
              ? "workspace.attach_agent_session_hint"
              : "workspace.attach_agent_session_picker_hint",
          )}
        </p>

        {single ? (
          <>
            {tree?.offline ? (
              <p className="flex items-center gap-1 text-xs text-warning">
                <CloudOff size={12} className="shrink-0" />
                {t("agents.sessions_cached")}
              </p>
            ) : null}
            {error ? <p className="text-xs text-error">{error}</p> : null}
            {loading ? (
              <p className="flex items-center gap-2 text-xs text-base-content/60">
                <span className="loading loading-spinner loading-xs" />
                {t("common.loading")}
              </p>
            ) : rows.length === 0 ? (
              <p className="text-xs text-base-content/60">
                {t("agents.no_sessions")}
              </p>
            ) : (
              <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-base-300 p-1">
                {rows.map(({ session, depth }) => {
                  const isAttached = attached.has(session.id);
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => void toggle(session)}
                      disabled={busy}
                      aria-pressed={isAttached}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition hover:bg-base-200 disabled:opacity-60"
                      style={{ paddingLeft: `${8 + depth * 14}px` }}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                          isAttached
                            ? "border-accent bg-accent text-accent-content"
                            : "border-base-content/30"
                        }`}
                        aria-hidden="true"
                      >
                        {isAttached ? <Checkmark size={10} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {sessionLabel(session)}
                      </span>
                      {depth > 0 && <SubagentBadge />}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {error ? <p className="text-xs text-error">{error}</p> : null}
            {notice ? (
              <p className="text-xs text-success" role="status">
                {notice}
              </p>
            ) : null}
            {loading ? (
              <p className="flex items-center gap-2 text-xs text-base-content/60">
                <span className="loading loading-spinner loading-xs" />
                {t("common.loading")}
              </p>
            ) : pickerGroups.length === 0 ? (
              <p className="text-xs text-base-content/60">
                {t("workspace.no_unattached_sessions")}
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {pickerGroups.map(({ agent: target, tree: targetTree, rows: items }) => (
                  <section key={target.id} data-guide="attach-session-agent">
                    <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-base-content/60">
                      <Bot size={11} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {target.name || target.id}
                      </span>
                      {targetTree?.offline ? (
                        <CloudOff
                          size={11}
                          className="shrink-0 text-warning"
                          title={t("agents.sessions_cached_short")}
                        />
                      ) : null}
                    </div>
                    <div className="space-y-0.5">
                      {items.map(({ session, depth }) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => void attach(target, session)}
                          disabled={Boolean(busyKey)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition hover:bg-base-200 disabled:opacity-60"
                          style={{ paddingLeft: `${8 + depth * 14}px` }}
                        >
                          {busyKey === `${target.id}:${session.id}` ? (
                            <span className="loading loading-spinner loading-xs shrink-0" />
                          ) : (
                            <Add
                              size={12}
                              className="shrink-0 text-base-content/50"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {sessionLabel(session)}
                          </span>
                          {depth > 0 && <SubagentBadge />}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
            {Object.entries(errors).map(([agentId, message]) => (
              <p key={agentId} className="text-xs text-error">
                {nameOf(agentId)}: {message}
              </p>
            ))}
          </>
        )}

        <div className="mt-1 flex justify-between gap-2">
          {single ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void create()}
              disabled={busy || !agent?.id}
            >
              <Add size={14} />
              {t("agents.new_session")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn btn-sm btn-accent"
            onClick={onClose}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
