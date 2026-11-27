// components/settings/ArcanaContainer.jsx
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { CircleHelp, Trash2 } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { isAgentEnabled, modelSupportsTools } from "../../apis/agentEndpoints";
import {
  arcanaRefId,
  arcanaSharesFromSettings,
  parseArcanaShareRef,
} from "../../utils/arcanaShareLink";

/**
 * The Arcana settings page, in the two halves the tool list separates.
 *
 * `Arcana` is the **legacy** server-side path: one collection id
 * (`settings.arcana.id`) that `agent/gateway.ts` sends with the request, so the
 * backend runs the retrieval. `Arcana Tools` is the current one: the chat owns a
 * list of collections (`settings.arcana_shares`, plus the single
 * `settings.arcana_share` an access link writes) that the app's own read tools
 * (`agent/arcanaChatTools.ts`) use, each with a short description that
 * `list_arcanas` hands to the model.
 *
 * The list is deduplicated by reference and each row says where it comes from.
 * It is rendered under Arcana Tools, because that is where the tools that read
 * it live; the legacy row keeps only its own single field.
 */
const ArcanaContainer = ({
  localState,
  setLocalState,
  configurable,
  legacy = true,
  collections = true,
}) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const [draftId, setDraftId] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [error, setError] = useState("");

  const settings = localState.settings;

  const handleArcanaChange = () => (e) => {
    setLocalState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        arcana: {
          ...prev.settings.arcana,
          id: e.target.value,
        },
      },
    }));
  };

  // The agent has no enable_tools switch; ToolsContainer decides when to show
  // the editable field there.
  const agentMode = isAgentEnabled();
  const toolsOn = agentMode || !!settings?.enable_tools;
  // The legacy field only needs its own switch. Whether this model is external says
  // nothing about the gateway accepting the id; ToolsContainer disables the row when the
  // model cannot run tools at all.
  const canConfigure = configurable === undefined ? toolsOn : !!configurable;
  // The collection list is the chat's own setting, served by the browser
  // agent's read tools (`agent/arcanaChatTools.ts`). Those do not depend on
  // the gateway "Arcana" switch, which is off by default in agent mode, so the
  // add form must stay available while that switch is off. It only needs a
  // model that can run tools; without one there is nothing to read a
  // collection with. Externality is not a capability (see
  // `apis/agentEndpoints.ts#modelSupportsTools`).
  const canEditShares = agentMode && modelSupportsTools(settings?.model);

  const toolId =
    typeof settings?.arcana?.id === "string" ? settings.arcana.id.trim() : "";
  const toolRef = parseArcanaShareRef(toolId);
  const shares = arcanaSharesFromSettings(settings);

  const usedArcanas = [];
  // The legacy gateway binding is only shown on the legacy row; under Arcana
  // Tools the list is exactly what the read tools receive.
  if (legacy && toolId) {
    const match = toolRef
      ? shares.find((share) => share.collection === toolRef.collection)
      : null;
    usedArcanas.push({
      key: `tool:${toolRef?.collection ?? toolId}`,
      name: toolRef ? arcanaRefId(toolRef) : toolId,
      collection: toolRef?.collection ?? "",
      tool: true,
      share: match ?? null,
      readOnly: !!match,
    });
  }
  for (const share of shares) {
    if (legacy && toolRef && share.collection === toolRef.collection) continue;
    usedArcanas.push({
      key: `share:${share.collection}`,
      name: arcanaRefId(share),
      collection: share.collection,
      tool: false,
      share,
      readOnly: true,
    });
  }

  /**
   * Write the merged list as the canonical `arcana_shares` and fold in the
   * single link binding, so an edit leaves one representation behind.
   */
  const writeShares = (prev, nextShares) => {
    const nextSettings = { ...prev.settings };
    const list = nextShares.map((share) => {
      const entry = {
        collection: share.collection,
        name: share.name,
        owner: share.owner,
      };
      if (share.description) entry.description = share.description;
      return entry;
    });
    if (list.length) nextSettings.arcana_shares = list;
    else delete nextSettings.arcana_shares;
    delete nextSettings.arcana_share;
    return { ...prev, settings: nextSettings };
  };

  const addShare = () => {
    const ref = parseArcanaShareRef(draftId);
    if (!ref) {
      setError(t("settings.arcana_invalid_ref"));
      return;
    }
    if (shares.some((share) => share.collection === ref.collection)) {
      setError(t("settings.arcana_already_added"));
      return;
    }
    const description = draftDescription.trim();
    setLocalState((prev) => {
      const current = arcanaSharesFromSettings(prev.settings);
      if (current.some((share) => share.collection === ref.collection)) {
        return prev;
      }
      const next = [
        ...current,
        { ...ref, ...(description ? { description } : {}) },
      ];
      return writeShares(prev, next);
    });
    setDraftId("");
    setDraftDescription("");
    setError("");
  };

  const changeDescription = (entry, value) => {
    if (!entry.collection) return;
    setLocalState((prev) => {
      const next = arcanaSharesFromSettings(prev.settings).map((share) => {
        if (share.collection !== entry.collection) return share;
        const updated = { ...share };
        const description = value.trim();
        if (description) updated.description = description;
        else delete updated.description;
        return updated;
      });
      return writeShares(prev, next);
    });
  };

  const removeArcana = (entry) => {
    setLocalState((prev) => {
      const nextSettings = { ...prev.settings };
      if (entry.tool) {
        nextSettings.arcana = { ...nextSettings.arcana, id: "" };
      }
      const current = arcanaSharesFromSettings(prev.settings);
      const remaining = entry.collection
        ? current.filter((share) => share.collection !== entry.collection)
        : current;
      return writeShares({ ...prev, settings: nextSettings }, remaining);
    });
  };

  return (
    <>
      {legacy && (
        <p
          data-guide="arcana-legacy-notice"
          className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-xs leading-relaxed text-base-content/80"
        >
          {t("settings.arcana_legacy_notice")}
        </p>
      )}
      {usedArcanas.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-base-content/60">
            {t("settings.arcana_in_use")}
          </p>
          <ul
            data-guide="tools-arcana-list"
            className="overflow-hidden rounded-xl border border-base-300 bg-base-100"
          >
            {usedArcanas.map((entry) => (
              <li
                key={entry.key}
                className="space-y-2 border-b border-base-300/70 px-3 py-2 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs">
                      {entry.name}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {entry.tool && (
                        <span className="badge badge-xs">
                          {t("settings.arcana_in_use_tool")}
                        </span>
                      )}
                      {entry.readOnly && (
                        <span className="badge badge-ghost badge-xs">
                          {t("settings.arcana_in_use_readonly")}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeArcana(entry)}
                    aria-label={t("settings.arcana_in_use_remove", {
                      name: entry.name,
                    })}
                    className="btn btn-ghost btn-xs btn-square shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                {entry.share && (
                  <input
                    type="text"
                    data-guide="arcana-share-description"
                    value={entry.share.description ?? ""}
                    onChange={(e) => changeDescription(entry, e.target.value)}
                    placeholder={t("settings.arcana_description_placeholder")}
                    aria-label={t("settings.arcana_description_for", {
                      name: entry.name,
                    })}
                    className="input input-xs w-full"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {collections && canEditShares && (
        <div className="space-y-2" data-guide="arcana-add">
          <p className="text-xs font-medium text-base-content/60">
            {t("settings.arcana_add_title")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              data-guide="arcana-add-id"
              value={draftId}
              onChange={(e) => {
                setDraftId(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addShare();
              }}
              placeholder={t("settings.arcana_add_placeholder")}
              aria-label={t("settings.arcana_add_placeholder")}
              className="input w-full font-mono text-xs"
            />
            <input
              type="text"
              data-guide="arcana-add-description"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addShare();
              }}
              placeholder={t("settings.arcana_description_placeholder")}
              aria-label={t("settings.arcana_description_placeholder")}
              className="input w-full text-xs"
            />
            <button
              type="button"
              onClick={addShare}
              className="btn btn-primary btn-sm shrink-0"
            >
              {t("settings.arcana_add_button")}
            </button>
          </div>
          {error && (
            <p className="text-xs text-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
      {legacy && canConfigure && (
        <div className="flex gap-4 w-full items-center">
          <div className="flex-shrink-0 flex items-center gap-2 select-none">
            <p className="text-sm">{t("settings.label_arcana")}</p>
            <CircleHelp
              className="h-[16px] w-[16px] cursor-pointer text-accent"
              alt="help"
              onClick={() => openModal("helpArcana")}
            />
          </div>
          <div className="w-full flex gap-1">
            <input
              type="text"
              data-guide="arcana-id"
              value={settings?.arcana?.id}
              onChange={handleArcanaChange()}
              placeholder={t("settings.placeholder_arcana_id")}
              className="input w-full"
            />
          </div>
        </div>
      )}
      {legacy && canConfigure && settings.arcana?.id && (
        <div className="text-warning text-xs w-full select-none space-y-1">
          <div>
            <Trans i18nKey="alert.arcana_usage" />
          </div>
          <div>
            {t("alert.arcana_create_collection_prefix") + " "}
            <a
              href="https://chat-ai.academiccloud.de/arcanas/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              {t("alert.arcana_create_collection_link")}
            </a>
            .
          </div>
        </div>
      )}
    </>
  );
};

export default ArcanaContainer;
