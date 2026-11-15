import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Add, Checkmark } from "@carbon/icons-react";

import BaseModal from "../BaseModal";
import {
  attachWorkspaceAgentSession,
  detachWorkspaceAgentSession,
} from "../../db/workspaceDb";
import {
  fetchAgentSessions,
  sessionLabel,
} from "../../agents/agentSessions";
import { createWorkspaceAgentSession } from "../../agents/workspaceAgentSessions";

/**
 * Pick which sessions of an attached agent show up in a workspace. A session can be attached
 * to several workspaces, and a workspace never shows a session that was not attached to it.
 */
export default function AttachAgentSessionModal({
  isOpen,
  onClose,
  workspaceId,
  agent,
  attachedIds = [],
}) {
  const { t } = useTranslation();
  const [attached, setAttached] = useState(() => new Set(attachedIds));
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAttached(new Set(attachedIds));
  }, [attachedIds]);

  useEffect(() => {
    if (!isOpen || !agent?.id) return undefined;
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
  }, [agent, isOpen]);

  const rows = useMemo(() => {
    if (!tree) return [];
    const out = [];
    const walk = (session, depth) => {
      out.push({ session, depth });
      for (const child of tree.children?.get(session.id) || []) {
        walk(child, depth + 1);
      }
    };
    for (const root of tree.roots || []) walk(root, 0);
    return out;
  }, [tree]);

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
        await attachWorkspaceAgentSession(workspaceId, agent.id, session.id);
        setAttached((current) => new Set(current).add(session.id));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="workspace.attach_agent_session"
    >
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <p className="text-xs text-base-content/70">
          {t("workspace.attach_agent_session_hint")}
        </p>
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
                  {depth > 0 && (
                    <span className="shrink-0 rounded bg-base-300 px-1 text-[9px] text-base-content/60">
                      {t("agents.subagent_short")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-1 flex justify-between gap-2">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void create()}
            disabled={busy || !agent?.id}
          >
            <Add size={14} />
            {t("agents.new_session")}
          </button>
          <button type="button" className="btn btn-sm btn-accent" onClick={onClose}>
            {t("common.done")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
