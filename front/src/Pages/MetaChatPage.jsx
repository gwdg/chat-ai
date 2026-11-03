import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Ai } from "@carbon/icons-react";

import { getDefaultConversation } from "../utils/conversationUtils";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import { abortRequest } from "../apis/chatCompletions";
import { createConversation, getConversation, updateConversation } from "../db";

import { useMetaChatSend } from "../hooks/useMetaChatSend";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";

import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import Header from "../components/Header/Header";
import Conversation from "../components/Conversation/Conversation";
import TourManager from "../components/SettingsPanel/TourManager";
import AnnouncementBar from "../components/Header/AnnouncementBar";
import { MetaChatSendContext } from "../context/MetaChatContext";

export default function MetaChatPage() {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const [localState, setLocalState] = useState(() => ({
    ...getDefaultConversation(userSettings),
    id: "meta-chat",
    title: t("meta_chat.title"),
  }));

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();
  const metaChatSend = useMetaChatSend();

  const [loaded, setLoaded] = useState(false);
  const latestStateRef = useRef(localState);
  const loadedRef = useRef(false);

  useEffect(() => {
    latestStateRef.current = localState;
  }, [localState]);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        let conversation = await getConversation("meta-chat");
        if (!conversation) {
          const base = getDefaultConversation(userSettings);
          await createConversation({
            id: "meta-chat",
            title: t("meta_chat.title"),
            settings: base.settings,
            messages: base.messages,
            folderId: null,
            isMetaChat: true,
          });
          conversation = await getConversation("meta-chat");
        }
        if (!cancelled && conversation) {
          setLocalState(conversation);
          setLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load Meta chat", error);
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Load once per mount; the meta conversation is then saved below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(() => {
      const latest = latestStateRef.current;
      if (!latest?.id) return;
      updateConversation(
        "meta-chat",
        {
          title: latest.title,
          settings: latest.settings,
          messages: latest.messages,
          folderId: latest.folderId ?? null,
        },
        true,
      ).catch((error) => {
        console.error("Failed to save Meta chat", error);
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [localState, loaded]);

  useEffect(
    () => () => {
      abortRequest();
      if (loadedRef.current && latestStateRef.current?.id) {
        const latest = latestStateRef.current;
        void updateConversation(
          "meta-chat",
          {
            title: latest.title,
            settings: latest.settings,
            messages: latest.messages,
            folderId: latest.folderId ?? null,
          },
          true,
        ).catch((error) => {
          console.error("Failed to save Meta chat", error);
        });
      }
    },
    [],
  );

  return (
    <MetaChatSendContext.Provider value={metaChatSend}>
      <div className="h-dvh grid grid-rows-[auto_1fr]">
        <div className="min-w-0 overflow-hidden">
          <TourManager />
          <AnnouncementBar />
          <Header
            className="md:hidden"
            localState={localState}
            setLocalState={setLocalState}
            modelsData={modelsData}
            userData={userData}
          />
        </div>

        <div
          className="
            grid
            grid-cols-1 grid-rows-[1fr_auto]
            md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto]
            md:gap-x-2 gap-y-1 md:pt-1
            bg-base-200
            overflow-hidden
          "
        >
          <SidebarWrapper
            localState={localState}
            setLocalState={setLocalState}
            userData={userData}
            modelsData={modelsData}
          />

          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="mx-1 mb-1 flex items-start gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm">
              <Ai
                size={16}
                className="mt-0.5 shrink-0 text-accent"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-base-content">
                  {t("meta_chat.title")}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-base-content/70">
                  {t("meta_chat.banner_description")}
                </p>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Conversation
                localState={localState}
                setLocalState={setLocalState}
                userData={userData}
                modelsData={modelsData}
              />
            </div>
          </div>

          <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
        </div>
      </div>
    </MetaChatSendContext.Provider>
  );
}
