// components/settings/ArcanaContainer.jsx
import { Trans, useTranslation } from "react-i18next";
import { CircleHelp, Trash2 } from "lucide-react";
import { useModal } from "../../modals/ModalContext";
import { isAgentEnabled } from "../../apis/agentEndpoints";
import {
  arcanaRefId,
  arcanaShareFromSettings,
  parseArcanaShareRef,
} from "../../utils/arcanaShareLink";

/**
 * The Arcana tool's settings page.
 *
 * A chat can be wired to a collection in two ways: the Arcana tool's own field
 * (`settings.arcana.id`, sent with the request and served by the backend) and
 * the read-only app tools a share link binds (`settings.arcana_share`). A share
 * link sets both, so the list of collections this chat uses is deduplicated by
 * storage name and each row says which of the two it comes from.
 */
const ArcanaContainer = ({ localState, setLocalState, configurable }) => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const settings = localState.settings;
  const modelName = settings?.model?.name;
  const isExternalModel =
    typeof modelName === "string" &&
    modelName.toLowerCase().includes("external");

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
  const canConfigure =
    configurable === undefined
      ? toolsOn && !isExternalModel
      : !!configurable && !isExternalModel;

  const toolId =
    typeof settings?.arcana?.id === "string" ? settings.arcana.id.trim() : "";
  const toolRef = parseArcanaShareRef(toolId);
  const share = arcanaShareFromSettings(settings);

  const usedArcanas = [];
  if (toolId) {
    usedArcanas.push({
      key: `tool:${toolRef?.collection ?? toolId}`,
      name: toolRef ? arcanaRefId(toolRef) : toolId,
      tool: true,
      readOnly: !!share && share.collection === toolRef?.collection,
    });
  }
  if (share && share.collection !== toolRef?.collection) {
    usedArcanas.push({
      key: `share:${share.collection}`,
      name: arcanaRefId(share),
      tool: false,
      readOnly: true,
    });
  }

  const removeArcana = (entry) => {
    setLocalState((prev) => {
      const nextSettings = { ...prev.settings };
      if (entry.tool) {
        nextSettings.arcana = { ...nextSettings.arcana, id: "" };
      }
      if (entry.readOnly) {
        delete nextSettings.arcana_share;
      }
      return { ...prev, settings: nextSettings };
    });
  };

  return (
    <>
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
                className="flex items-center gap-2 border-b border-base-300/70 px-3 py-2 last:border-b-0"
              >
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
              </li>
            ))}
          </ul>
        </div>
      )}
      {canConfigure && (
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
      {canConfigure && settings.arcana?.id && (
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
