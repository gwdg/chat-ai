import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Add,
  Document,
  Renew,
  Search,
  Tag,
  TrashCan,
  Upload,
} from "@carbon/icons-react";
import { AlertCircle, Loader2 } from "lucide-react";

import BaseModal from "../BaseModal";
import { useToast } from "../../hooks/useToast";
import {
  arcanasProvider,
  arcanaDisplayName,
  refreshArcanas,
} from "../../workspace/arcanas";
import { isTextFileName } from "../../workspace/providers/saiaRag";
import type {
  RagCollection,
  RagFile,
  RagSearchMode,
  RagSearchResult,
  RagTag,
} from "../../workspace/providers/saiaRag";
import { formatBytes } from "../../utils/formatBytes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long the manager keeps re-reading a collection after starting a job. */
const INDEX_POLL_MS = 2500;
const INDEX_POLL_LIMIT = 120;

type Tab = "files" | "search";

/**
 * The file list, tag editor and search of one collection.
 *
 * The sidebar can only show one row per collection, so everything a collection
 * does happens here: upload, index, tag and search. Tags are per file and are
 * edited as a comma-separated list (`set_file_tags` replaces the whole list, so
 * removing a tag is just leaving it out).
 *
 * Deleting a file asks inline instead of through `confirmAction`: the
 * modal context holds exactly one dialog, so opening the confirmation would
 * replace this one.
 */
export default function ArcanaManagerModal({
  isOpen,
  onClose,
  collection,
  initialTab = "files",
  focus,
}: {
  isOpen: boolean;
  onClose: () => void;
  collection: RagCollection;
  initialTab?: Tab;
  focus?: "upload";
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const display = arcanaDisplayName(collection);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [files, setFiles] = useState<RagFile[]>([]);
  const [tags, setTags] = useState<RagTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [indexing, setIndexing] = useState(false);

  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState<{ sent: number; total: number } | null>(
    null,
  );

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RagSearchMode>("previews");
  const [count, setCount] = useState(5);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [rawResults, setRawResults] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aliveRef = useRef(true);
  const stopIndexRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopIndexRef.current = true;
    };
  }, []);

  const provider = arcanasProvider();
  // Tool lists arrive with the MCP handshake, which only happens on the first
  // call. Start optimistic so the buttons are there while the list loads, then
  // narrow them to what this service really advertises.
  const [tools, setTools] = useState({ index: true, remove: true, setTags: true });
  const canIndex = tools.index;
  const canRemove = tools.remove;
  const canSetTags = tools.setTags;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextFiles, nextTags] = await Promise.all([
        provider.listFiles(display, { includeTags: true }),
        provider.supportsTool("list_tags")
          ? provider.listTags(display).catch(() => [] as RagTag[])
          : Promise.resolve([] as RagTag[]),
      ]);
      if (!aliveRef.current) return;
      setFiles(nextFiles);
      setTags(nextTags);
      setTools({
        index: provider.supportsTool("index_collection"),
        remove: provider.supportsTool("remove_file"),
        setTags: provider.supportsTool("set_file_tags"),
      });
    } catch (reason) {
      if (!aliveRef.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [display, provider]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, display]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (focus === "upload") {
      const timer = setTimeout(() => fileInputRef.current?.click(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [focus]);

  const visibleFiles = useMemo(
    () =>
      tagFilter.length
        ? files.filter((file) => tagFilter.every((tag) => file.tags.includes(tag)))
        : files,
    [files, tagFilter],
  );

  const pending = files.filter((file) => file.status === "stored").length;

  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setError("");
    setBusy("upload");
    let sent = 0;
    setUploadCount({ sent, total: picked.length });
    for (const file of picked) {
      try {
        if (!canIndex && isTextFileName(file.name)) {
          // An older service only indexes through the text upload path.
          await provider.uploadTextFile(display, file.name, await file.text());
        } else {
          await provider.uploadFile(display, file);
        }
      } catch (reason) {
        notifyError(
          `${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
      sent += 1;
      if (aliveRef.current) setUploadCount({ sent, total: picked.length });
    }
    setBusy("");
    setUploadCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await reload();
    if (canIndex) {
      notifySuccess(t("arcanas.upload_done", { count: sent }));
    }
  };

  const index = async () => {
    if (indexing) return;
    setError("");
    setIndexing(true);
    stopIndexRef.current = false;
    try {
      await provider.indexCollection(display);
      notifySuccess(t("arcanas.index_started"));
      for (let attempt = 0; attempt < INDEX_POLL_LIMIT; attempt += 1) {
        await sleep(INDEX_POLL_MS);
        if (!aliveRef.current || stopIndexRef.current) return;
        const next = await provider.listFiles(display, { includeTags: true });
        if (!aliveRef.current) return;
        setFiles(next);
        if (!next.some((file) => file.status === "stored")) break;
      }
      if (aliveRef.current) notifySuccess(t("arcanas.index_done"));
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current) setIndexing(false);
    }
  };

  const startTagEdit = (file: RagFile) => {
    setEditing(file.name);
    setTagDraft(file.tags.join(", "));
  };

  const saveTags = async (file: RagFile) => {
    if (!canSetTags) return;
    const tagsToSave = Array.from(
      new Set(
        tagDraft
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    );
    setBusy(`tags:${file.name}`);
    try {
      const saved = await provider.setFileTags(display, file.name, tagsToSave);
      setFiles((current) =>
        current.map((row) =>
          row.name === file.name ? { ...row, tags: saved } : row,
        ),
      );
      setEditing(null);
      if (provider.supportsTool("list_tags")) {
        setTags(await provider.listTags(display).catch(() => tags));
      }
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy("");
    }
  };

  const remove = async (file: RagFile) => {
    setBusy(`remove:${file.name}`);
    try {
      await provider.removeFile(display, file.name);
      setConfirmRemove(null);
      setFiles((current) => current.filter((row) => row.name !== file.name));
      notifySuccess(t("arcanas.file_removed", { name: file.name }));
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy("");
    }
  };

  const search = async () => {
    const trimmed = query.trim();
    if (!trimmed || searching) return;
    setSearching(true);
    setError("");
    try {
      const answer = await provider.search(display, trimmed, mode, count, tagFilter);
      if (!aliveRef.current) return;
      setResults(answer.results);
      setRawResults(answer.raw);
    } catch (reason) {
      setResults([]);
      setRawResults("");
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current) setSearching(false);
    }
  };

  const toggleTag = (tag: string) =>
    setTagFilter((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag],
    );

  const statusBadge = (file: RagFile) => {
    if (file.status === "stored") {
      return (
        <span className="badge badge-warning badge-sm whitespace-nowrap">
          {t("arcanas.status_stored")}
        </span>
      );
    }
    if (/fail|error/i.test(file.status)) {
      return (
        <span
          className="badge badge-error badge-sm max-w-[10rem] truncate whitespace-nowrap"
          title={file.status}
        >
          {t("arcanas.status_failed")}
        </span>
      );
    }
    return (
      <span className="badge badge-success badge-sm whitespace-nowrap">
        {t("arcanas.status_indexed")}
      </span>
    );
  };

  const tabButton = (id: Tab, icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      data-guide={`arcana-tab-${id}`}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        tab === id
          ? "bg-base-200 text-base-content"
          : "text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleNode={
        <span className="flex items-center gap-2">
          <Document size={16} />
          {collection.name}
          <span className="badge badge-ghost badge-sm">
            {t(`arcanas.role_${collection.role}`, {
              defaultValue: collection.role,
            })}
          </span>
        </span>
      }
      maxWidth="max-w-3xl"
      contentClassName="p-5 pt-0"
    >
      <div
        className="flex flex-col gap-3"
        data-guide="arcana-manager"
        data-collection={collection.collection}
      >
        <div className="flex items-center justify-between gap-2 border-b border-base-300 pb-2">
          <div className="flex items-center gap-1">
            {tabButton("files", <Document size={14} />, t("arcanas.tab_files"))}
            {tabButton("search", <Search size={14} />, t("arcanas.tab_search"))}
          </div>
          {tab === "files" ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => void reload()}
                disabled={loading || Boolean(busy)}
                title={t("arcanas.refresh")}
              >
                <Renew size={14} />
                {t("arcanas.refresh")}
              </button>
              {canIndex && (
                <button
                  type="button"
                  data-guide="arcana-index"
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={() => void index()}
                  disabled={Boolean(busy) || indexing || !collection.can_write}
                  title={t("arcanas.index")}
                >
                  {indexing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Add size={14} />
                  )}
                  {indexing ? t("arcanas.indexing") : t("arcanas.index")}
                </button>
              )}
              <button
                type="button"
                data-guide="arcana-upload"
                className="btn btn-primary btn-xs gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={Boolean(busy) || !collection.can_write}
                title={t("arcanas.upload")}
              >
                <Upload size={14} />
                {busy === "upload" && uploadCount
                  ? t("arcanas.uploading", {
                      sent: uploadCount.sent,
                      total: uploadCount.total,
                    })
                  : t("arcanas.upload")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => void upload(event.target.files)}
              />
            </div>
          ) : null}
        </div>

        {error && (
          <div className="flex items-start gap-1.5 rounded-lg bg-error/10 px-2 py-1.5 text-xs text-error">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}

        {tab === "files" ? (
          <div className="flex min-h-0 flex-col gap-2">
            {!collection.can_write && (
              <p className="text-xs text-base-content/60">
                {t("arcanas.read_only_hint")}
              </p>
            )}
            {pending > 0 && canIndex && !indexing && (
              <p className="rounded-lg bg-warning/10 px-2 py-1.5 text-xs text-warning">
                {t("arcanas.pending_hint", { count: pending })}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <Tag size={13} className="mr-0.5 text-base-content/45" />
                {tags.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`badge badge-sm gap-1 ${
                      tagFilter.includes(tag.name)
                        ? "badge-primary"
                        : "badge-ghost"
                    }`}
                    title={t("arcanas.filter_by_tag")}
                  >
                    {tag.name}
                    <span className="opacity-60">{tag.count}</span>
                  </button>
                ))}
                {tagFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTagFilter([])}
                    className="ml-1 text-[11px] text-base-content/55 underline"
                  >
                    {t("arcanas.clear_filter")}
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-base-300">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-base-content/60">
                  <Loader2 size={14} className="animate-spin" />
                  {t("arcanas.loading_files")}
                </div>
              ) : visibleFiles.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-base-content/60">
                  {tagFilter.length
                    ? t("arcanas.no_tagged_files")
                    : t("arcanas.no_files")}
                </p>
              ) : (
                <ul className="divide-y divide-base-300">
                  {visibleFiles.map((file) => (
                    <li key={file.name} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/55">
                          <Document size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-xs font-medium"
                            title={file.name}
                          >
                            {file.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-base-content/50">
                            {typeof file.size === "number" && (
                              <span>{formatBytes(file.size)}</span>
                            )}
                            <span>
                              {t("arcanas.chunks", { count: file.chunks })}
                            </span>
                            {file.tags.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1">
                                {file.tags.map((tag) => (
                                  <span key={tag} className="badge badge-ghost badge-xs">
                                    {tag}
                                  </span>
                                ))}
                              </span>
                            )}
                          </p>
                        </div>
                        {statusBadge(file)}
                        <button
                          type="button"
                          data-guide="arcana-tags"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() =>
                            editing === file.name
                              ? setEditing(null)
                              : startTagEdit(file)
                          }
                          disabled={!canSetTags || !collection.can_write}
                          title={t("arcanas.edit_tags")}
                          aria-label={t("arcanas.edit_tags")}
                        >
                          <Tag size={14} />
                        </button>
                        {canRemove && collection.can_write && (
                          <button
                            type="button"
                            data-guide="arcana-remove"
                            className="btn btn-ghost btn-xs btn-square text-error"
                            onClick={() => setConfirmRemove(file.name)}
                            disabled={Boolean(busy)}
                            title={t("arcanas.remove_file")}
                            aria-label={t("arcanas.remove_file")}
                          >
                            <TrashCan size={14} />
                          </button>
                        )}
                      </div>

                      {editing === file.name && (
                        <div className="mt-2 flex items-center gap-2 pl-9">
                          <input
                            className="input input-xs flex-1"
                            autoFocus
                            value={tagDraft}
                            placeholder={t("arcanas.tags_placeholder")}
                            onChange={(event) => setTagDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveTags(file);
                              }
                              if (event.key === "Escape") setEditing(null);
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => void saveTags(file)}
                            disabled={busy === `tags:${file.name}`}
                          >
                            {t("arcanas.save_tags")}
                          </button>
                        </div>
                      )}

                      {confirmRemove === file.name && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-error/10 px-2 py-1.5 pl-9 text-xs">
                          <span className="min-w-0 flex-1 text-error">
                            {t("arcanas.remove_confirm", { name: file.name })}
                          </span>
                          <button
                            type="button"
                            className="btn btn-error btn-xs"
                            onClick={() => void remove(file)}
                            disabled={busy === `remove:${file.name}`}
                          >
                            {t("arcanas.remove")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setConfirmRemove(null)}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input input-sm min-w-[12rem] flex-1"
                value={query}
                placeholder={t("arcanas.search_placeholder")}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void search();
                }}
              />
              <select
                className="select select-sm w-auto"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as RagSearchMode)
                }
              >
                <option value="previews">{t("arcanas.mode_previews")}</option>
                <option value="documents">{t("arcanas.mode_documents")}</option>
                <option value="chunks">{t("arcanas.mode_chunks")}</option>
              </select>
              <select
                className="select select-sm w-auto"
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              >
                {[5, 10, 20].map((value) => (
                  <option key={value} value={value}>
                    {t("arcanas.result_count", { count: value })}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-guide="arcana-search-run"
                className="btn btn-primary btn-sm gap-1"
                onClick={() => void search()}
                disabled={!query.trim() || searching}
              >
                {searching ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Search size={14} />
                )}
                {t("arcanas.search")}
              </button>
            </div>
            {tagFilter.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-base-content/60">
                <Tag size={12} />
                {tagFilter.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="badge badge-primary badge-sm"
                    onClick={() => toggleTag(tag)}
                    title={t("arcanas.clear_filter")}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {results.length === 0 ? (
                rawResults && !/no (matching|results)/i.test(rawResults) ? (
                  <pre className="whitespace-pre-wrap rounded-xl bg-base-200/60 px-3 py-2 text-xs">
                    {rawResults}
                  </pre>
                ) : (
                  <p className="px-3 py-8 text-center text-xs text-base-content/60">
                    {rawResults
                      ? t("arcanas.no_results")
                      : t("arcanas.search_hint")}
                  </p>
                )
              ) : (
                results.map((result, index) => (
                  <div
                    key={`${result.filename}-${index}`}
                    className="rounded-xl border border-base-300 px-3 py-2"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">
                        {result.filename || t("arcanas.result")}
                      </span>
                      {typeof result.score === "number" && (
                        <span className="badge badge-ghost badge-sm">
                          {result.score.toFixed(3)}
                        </span>
                      )}
                    </div>
                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] text-base-content/75">
                      {result.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-base-300 pt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
