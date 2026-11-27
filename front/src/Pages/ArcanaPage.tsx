import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router";
import { Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";

import AnnouncementBar from "../components/Header/AnnouncementBar";
import Header from "../components/Header/Header";
import SidebarWrapper from "../components/Sidebar/SidebarWrapper";
import CollapsibleFooter from "../components/Footer/CollapsibleFooter";
import ArcanaChatPanel from "../components/Arcana/ArcanaChatPanel";
import ArcanaEditorPanel from "../components/Arcana/ArcanaEditorPanel";
import ChatFilePreviewPanel from "../components/Conversation/ChatFilePreviewPanel";
import { useUpdateModelsData } from "../hooks/useUpdateModelsData";
import { useUpdateUserData } from "../hooks/useUpdateUserData";
import {
  useSaiaRagAccessWithReload,
  SAIA_RAG_AVAILABLE,
  SAIA_RAG_CHECKING,
  SAIA_RAG_UNAVAILABLE,
} from "../hooks/useSaiaRagAccess";
import { selectUserSettings } from "../Redux/reducers/userSettingsReducer";
import { getDefaultConversation } from "../utils/conversationUtils";
import { parseArcanaShareRef } from "../utils/arcanaShareLink";
import { useArcanas } from "../workspace/arcanas";
import type { RagFile } from "../workspace/providers/saiaRag";

const EDITOR_OPEN_KEY = "chatai.arcana.editor-open";

const readEditorOpen = () => {
  try {
    const stored = localStorage.getItem(EDITOR_OPEN_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // A disabled store falls back to the viewport rule.
  }
  // The panel needs 320 px beside the chat, which a phone does not have.
  return window.innerWidth >= 1024;
};

const saveEditorOpen = (open: boolean) => {
  try {
    localStorage.setItem(EDITOR_OPEN_KEY, open ? "true" : "false");
  } catch {
    // A disabled store only costs the preference.
  }
};

/**
 * One Arcana as a page: the usual chat shell in the middle, with a chat for
 * this collection, and the collection's files, search and sharing docked on
 * the right.
 *
 * The page is addressed by the collection reference (`owner/name`, with the
 * slash percent-encoded), because two people can own a collection with the same
 * display name. It stays out of the conversation store entirely: the chat is
 * ephemeral (`sessionStorage`), so nothing here appears in the chat list, an
 * export, a backup or the sync archive.
 */
export default function ArcanaPage() {
  const { t } = useTranslation();
  const userSettings = useSelector(selectUserSettings);
  const navigate = useNavigate();
  const { collection: encoded = "" } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const modelsData = useUpdateModelsData();
  const userData = useUpdateUserData();
  const { access, reload } = useSaiaRagAccessWithReload();
  const { collections, loading, loaded, error } = useArcanas(
    access === SAIA_RAG_AVAILABLE,
  );

  const collectionKey = useMemo(() => {
    let decoded = encoded;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      // A malformed escape stays as-is and simply matches nothing.
    }
    // Links from before the form changed carry the storage spelling
    // (`alice__papers`); the reference the list holds is `alice/papers`.
    return parseArcanaShareRef(decoded)?.collection ?? decoded;
  }, [encoded]);

  const collection = collections.find(
    (item) => item.collection === collectionKey,
  );

  const initialTab = (() => {
    const requested = searchParams.get("tab");
    return requested === "search" || requested === "share"
      ? requested
      : "files";
  })();
  const focusUpload = searchParams.get("upload") === "1";

  const [editorOpen, setEditorOpen] = useState(readEditorOpen);
  const [files, setFiles] = useState<RagFile[] | null>(null);
  const [draftState, setDraftState] = useState(() =>
    getDefaultConversation(userSettings, null),
  );

  useEffect(() => {
    saveEditorOpen(editorOpen);
  }, [editorOpen]);

  // A sidebar row that asks for a tab or an upload is a request to see the
  // panel, even when the last visit left it closed. `location.key` changes on
  // every navigation, so choosing the same menu entry twice works too.
  useEffect(() => {
    if (initialTab !== "files" || focusUpload) setEditorOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, collectionKey]);

  // The composer is per collection, not per visit.
  useEffect(() => {
    setDraftState(getDefaultConversation(userSettings, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionKey]);

  const notReady =
    access === SAIA_RAG_AVAILABLE && !collection && !loaded && loading;
  const missing =
    access === SAIA_RAG_AVAILABLE &&
    !collection &&
    (loaded || error) &&
    !loading;

  /**
   * The editor toggle rides in the chat's head panel: the page has no bar of
   * its own, exactly like the Meta chat, where the banner is the only header.
   */
  const editorToggle = (
    <button
      type="button"
      onClick={() => setEditorOpen((open) => !open)}
      data-guide="arcana-editor-toggle"
      className={`btn btn-xs gap-1 ${editorOpen ? "btn-neutral" : "btn-ghost"}`}
      aria-pressed={editorOpen}
      title={
        editorOpen
          ? t("arcanas.page_editor_hide")
          : t("arcanas.page_editor_show")
      }
    >
      {editorOpen ? (
        <PanelRightClose size={14} />
      ) : (
        <PanelRightOpen size={14} />
      )}
      <span className="hidden sm:inline">{t("arcanas.page_editor")}</span>
    </button>
  );

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      <div className="min-w-0 overflow-x-clip">
        <AnnouncementBar />
        <Header
          className="md:hidden"
          localState={draftState}
          setLocalState={setDraftState}
          modelsData={modelsData}
          userData={userData}
        />
      </div>

      <div
        className="
          flex-1 min-h-0
          grid
          grid-cols-1 grid-rows-[1fr_auto]
          md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto]
          md:gap-x-2 gap-y-1 md:pt-1
          bg-base-200
          overflow-hidden
        "
      >
        <SidebarWrapper
          localState={draftState}
          setLocalState={setDraftState}
          userData={userData}
          modelsData={modelsData}
        />

        <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden">

          {access === SAIA_RAG_CHECKING || notReady ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-base-content/60">
              <Loader2 size={16} className="animate-spin" />
              {t("arcanas.loading")}
            </div>
          ) : access === SAIA_RAG_UNAVAILABLE ? (
            <div
              data-guide="arcana-page-unavailable"
              className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
            >
              <p className="text-sm font-medium text-base-content">
                {t("arcanas.unavailable")}
              </p>
              <p className="max-w-md text-xs text-base-content/60">
                {t("arcanas.page_unavailable_body")}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={reload}
                  data-guide="arcana-page-reload"
                >
                  {t("arcanas.reload")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => navigate("/chat")}
                >
                  {t("arcanas.page_back_to_chat")}
                </button>
              </div>
            </div>
          ) : missing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-base-content">
                {t("arcanas.page_missing_title")}
              </p>
              <p className="max-w-md text-xs text-base-content/60">
                {error || t("arcanas.page_missing_body")}
              </p>
              <button
                type="button"
                className="btn btn-sm mt-1"
                onClick={() => navigate("/chat")}
              >
                {t("arcanas.page_back_to_chat")}
              </button>
            </div>
          ) : collection ? (
            <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2 pt-2">
              <div
                className={`min-h-0 min-w-0 flex-1 flex-col ${
                  editorOpen ? "hidden lg:flex" : "flex"
                }`}
              >
                <ArcanaChatPanel
                  key={collection.collection}
                  collection={collection}
                  modelsData={modelsData}
                  userData={userData}
                  fileCount={files?.length ?? null}
                  actions={editorToggle}
                />
              </div>
              {editorOpen && (
                <ArcanaEditorPanel
                  key={collection.collection}
                  collection={collection}
                  initialTab={initialTab}
                  focus={focusUpload ? "upload" : undefined}
                  onFiles={setFiles}
                  onClose={() => setEditorOpen(false)}
                />
              )}
              <ChatFilePreviewPanel />
            </div>
          ) : null}
        </main>

        <CollapsibleFooter className="row-start-3 col-span-full md:row-start-2 md:col-start-1 md:col-end-3" />
      </div>
    </div>
  );
}
