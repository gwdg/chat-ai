import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import {
  Add,
  Catalog,
  Document,
  OverflowMenuVertical,
  Search,
  TrashCan,
} from "@carbon/icons-react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import Tooltip from "../Others/Tooltip";
import { SECTION_RHYTHM } from "./sectionSpacing";

import { useModal } from "../../modals/ModalContext";
import { useToast } from "../../hooks/useToast";
import { useSaiaRagAccess, SAIA_RAG_AVAILABLE } from "../../hooks/useSaiaRagAccess";
import {
  selectCollapsedTopics,
  toggleTopic,
} from "../../Redux/reducers/interfaceSettingsSlice";
import { arcanasProvider, arcanaDisplayName, arcanaPagePath, retryArcanas, useArcanas } from "../../workspace/arcanas";
import type { RagCollection } from "../../workspace/providers/saiaRag";

/**
 * The Arcanas section of the left sidebar: the caller's saia-rag collections.
 *
 * A collection opens on its own page (`/arcana/<storage>`) rather than being
 * expanded in the sidebar, because a 240 px rail cannot hold a file table, a
 * tag filter, a search box and a chat. The section only decides whether
 * anything is there at all: the Arcanas module, advanced mode (through
 * `showAdvancedSidebarSections`) and the service's own health probe. When the
 * probe does not confirm the service, the section is absent instead of empty,
 * the same fail-closed rule the workspace drive follows.
 */
export default function ArcanaList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { openModal } = useModal();
  const { notifySuccess, notifyError } = useToast();
  const access = useSaiaRagAccess();
  const collapsedTopicIds = useSelector(selectCollapsedTopics) ?? [];
  const collapsed = collapsedTopicIds.includes("__arcanas__");
  const { collections, statuses, loading, loaded, error } = useArcanas();

  if (access !== SAIA_RAG_AVAILABLE) return null;

  const openManager = (
    collection: RagCollection,
    options: { initialTab?: "files" | "search" | "share"; focus?: "upload" } = {},
  ) =>
    navigate(
      arcanaPagePath(collection, {
        tab: options.initialTab,
        upload: options.focus === "upload",
      }),
    );

  const activeCollection = (() => {
    if (!location.pathname.startsWith("/arcana/")) return null;
    const encoded = location.pathname.slice("/arcana/".length);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  })();

  const remove = (collection: RagCollection) => {
    openModal("confirmAction", {
      messageKey: "arcanas.delete_confirm",
      messageValues: { name: collection.name },
      confirmKey: "arcanas.delete_confirm_yes",
      showDontShowAgain: false,
      danger: true,
      onConfirm: async () => {
        try {
          await arcanasProvider().deleteCollection(arcanaDisplayName(collection));
          notifySuccess(
            t("arcanas.deleted", { name: collection.name }),
          );
          retryArcanas();
        } catch (reason) {
          notifyError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    });
  };

  return (
    <div className={`px-3 ${SECTION_RHYTHM}`} data-guide="arcanas">
      <div className="-mx-2 mb-1 flex min-h-8 items-center gap-1 rounded-lg bg-base-200/70 px-3 py-1">
        <button
          type="button"
          onClick={() => dispatch(toggleTopic("__arcanas__"))}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-md text-left text-[11px] font-semibold uppercase tracking-wide text-base-content/70 transition hover:text-base-content"
          aria-expanded={!collapsed}
        >
          <ChevronDown
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
          <Catalog size={12} className="shrink-0" />
          <Tooltip text={t("arcanas.tooltip")} className="min-w-0 flex-1">
            <span className="block truncate">{t("arcanas.section_title")}</span>
          </Tooltip>
        </button>
        <span className="text-[11px] font-normal tabular-nums text-base-content/35">
          {collections.length}
        </span>
        <button
          type="button"
          onClick={() => openModal("arcanaCreate")}
          data-guide="arcanas-add"
          className="flex h-6 w-6 items-center justify-center rounded-md text-base-content/50 transition hover:bg-base-200 hover:text-accent"
          title={t("arcanas.add")}
          aria-label={t("arcanas.add")}
        >
          <Add size={15} />
        </button>
      </div>

      {collapsed ? null : error ? (
        <div className="flex items-start gap-1.5 rounded-lg bg-error/10 px-2 py-1.5 text-[11px] text-error">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button
            type="button"
            onClick={() => retryArcanas()}
            className="shrink-0 rounded px-1 font-semibold underline"
          >
            {t("arcanas.retry")}
          </button>
        </div>
      ) : !loaded && loading ? (
        <p className="px-2 py-1 text-xs text-base-content/50">
          {t("arcanas.loading")}
        </p>
      ) : collections.length === 0 ? (
        <button
          type="button"
          onClick={() => openModal("arcanaCreate")}
          className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-base-300 px-3 py-2 text-left text-xs text-base-content/60 transition hover:border-accent/40 hover:bg-base-200/60"
        >
          {t("arcanas.add_empty")}
        </button>
      ) : (
        <div className="space-y-0.5">
          {collections.map((collection) => {
            const role = t(`arcanas.role_${collection.role}`, {
              defaultValue: collection.role,
            });
            const indexStatus = statuses[collection.collection];
            const indexLabel = t(`arcanas.index_${indexStatus ?? "unknown"}`);
            const indexDot =
              indexStatus === "current"
                ? "bg-success"
                : indexStatus === "pending"
                  ? "bg-error"
                  : indexStatus === "partial"
                    ? "bg-warning"
                    : "bg-base-content/20";
            const active = activeCollection === collection.collection;
            return (
              <div
                key={collection.collection}
                className={`group flex items-center gap-1 rounded-xl px-2 py-1 text-base-content transition hover:bg-base-200 ${
                  active ? "bg-base-200 shadow-sm" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => openManager(collection)}
                  data-guide="arcana-row"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={collection.collection}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <span
                      role="img"
                      data-index-status={indexStatus ?? "unknown"}
                      className={`h-2.5 w-2.5 rounded-full ${indexDot}`}
                      title={indexLabel}
                      aria-label={indexLabel}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {collection.name}
                    </span>
                    <span className="block truncate text-[10px] text-base-content/45">
                      {collection.shared
                        ? t("arcanas.shared_by", {
                            owner: collection.owner,
                            role,
                          })
                        : role}
                    </span>
                  </span>
                </button>
                <Popover className="relative shrink-0">
                  <PopoverButton
                    className={`flex h-6 w-6 items-center justify-center rounded-md text-base-content/40 transition hover:bg-base-300 hover:text-base-content focus:opacity-100 group-hover:opacity-100 ${
                      window.innerWidth < 1024 ? "opacity-100" : "opacity-0"
                    }`}
                    title={t("arcanas.options")}
                    aria-label={t("arcanas.options")}
                  >
                    <OverflowMenuVertical size={16} />
                  </PopoverButton>
                  <PopoverPanel
                    anchor="bottom end"
                    className="z-50 w-48 rounded-xl border border-base-300 bg-base-100 p-1 shadow-lg"
                  >
                    {({ close }) => (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            openManager(collection);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                        >
                          <Document size={14} />
                          {t("arcanas.open_files")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            openManager(collection, {
                              initialTab: "files",
                              focus: "upload",
                            });
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                        >
                          <Add size={14} />
                          {t("arcanas.add_files")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            openManager(collection, { initialTab: "search" });
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-base-content/80 transition hover:bg-base-200"
                        >
                          <Search size={14} />
                          {t("arcanas.search")}
                        </button>
                        {collection.can_manage && (
                          <button
                            type="button"
                            onClick={() => {
                              close();
                              remove(collection);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-error transition hover:bg-error/10"
                          >
                            <TrashCan size={14} />
                            {t("arcanas.delete")}
                          </button>
                        )}
                      </>
                    )}
                  </PopoverPanel>
                </Popover>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
