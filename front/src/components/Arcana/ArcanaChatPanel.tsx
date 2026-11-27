import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { MessageSquare, RotateCcw } from "lucide-react";

import Conversation from "../Conversation/Conversation";
import { ArcanaChatSendContext } from "../../context/ArcanaChatContext";
import { useArcanaChatSend } from "../../hooks/useArcanaChatSend";
import { selectUserSettings } from "../../Redux/reducers/userSettingsReducer";
import {
  createArcanaChatState,
  loadArcanaChat,
  saveArcanaChat,
} from "../../utils/arcanaChatStore";
import type { RagCollection } from "../../workspace/providers/saiaRag";

type ArcanaChatPanelProps = {
  collection: RagCollection;
  modelsData: unknown;
  userData: unknown;
};

/**
 * The Arcana chat: a thread about one collection, with tools to inspect and
 * (after a confirmation) change it.
 *
 * It is the middle column of the collection's page, so it reuses the ordinary
 * chat shell: a banner names the collection, then `Conversation` with its
 * prompt box. The thread is not a stored conversation — it lives in
 * `sessionStorage` under the collection's storage name, so it survives a
 * reload but never appears in the chat list and never enters an export, a
 * backup or the sync archive.
 */
export default function ArcanaChatPanel({
  collection,
  modelsData,
  userData,
}: ArcanaChatPanelProps) {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const sendMessage = useArcanaChatSend(collection);

  const collectionKey = collection.collection;
  const [localState, setLocalState] = useState(() => {
    const restored = loadArcanaChat(collectionKey);
    const base = createArcanaChatState(
      collectionKey,
      userSettings,
      collection.name,
    );
    return restored
      ? {
          ...base,
          messages: restored.messages,
          settings: { ...base.settings, ...(restored.settings ?? {}) },
        }
      : base;
  });

  const reset = useCallback(() => {
    setLocalState(
      createArcanaChatState(collectionKey, userSettings, collection.name),
    );
  }, [collectionKey, collection.name, userSettings]);

  // A different collection is a different thread.
  useEffect(() => {
    const restored = loadArcanaChat(collectionKey);
    const base = createArcanaChatState(
      collectionKey,
      userSettings,
      collection.name,
    );
    setLocalState(
      restored
        ? {
            ...base,
            messages: restored.messages,
            settings: { ...base.settings, ...(restored.settings ?? {}) },
          }
        : base,
    );
    // Only the collection selects the thread; changing the default settings
    // must not discard a running conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionKey]);

  useEffect(() => {
    saveArcanaChat(collectionKey, {
      messages: localState.messages,
      settings: localState.settings,
    });
  }, [collectionKey, localState.messages, localState.settings]);

  const contextValue = useMemo(() => sendMessage, [sendMessage]);

  return (
    <ArcanaChatSendContext.Provider value={contextValue}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div
          className="mx-auto flex w-full items-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm"
          data-guide="arcana-chat-banner"
        >
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="min-w-0 flex-1 text-xs font-semibold text-base-content">
                {t("arcana_chat.title", { name: collection.name })}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1"
                onClick={reset}
                data-guide="arcana-chat-reset"
                title={t("arcana_chat.reset")}
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">
                  {t("arcana_chat.reset")}
                </span>
              </button>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">
              {t("arcana_chat.subtitle")}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Conversation
            localState={localState}
            setLocalState={setLocalState}
            userData={userData}
            modelsData={modelsData}
            hideCloseButton
            promptPlaceholder={t("arcana_chat.prompt_placeholder")}
          />
        </div>
      </div>
    </ArcanaChatSendContext.Provider>
  );
}
