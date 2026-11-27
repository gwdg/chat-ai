import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Add,
  Copy,
  Document,
  Download,
  Edit,
  Launch,
  Renew,
  Search,
  Share,
  Tag,
  TrashCan,
  Upload,
} from "@carbon/icons-react";
import { AlertCircle, Loader2 } from "lucide-react";

import ArcanaMarkdownEditor from "./ArcanaMarkdownEditor";
import { FileTypeIcon, fileTypeIcon } from "../DocumentPanel/fileTypeIcon";
import { useToast } from "../../hooks/useToast";
import {
  arcanasProvider,
  arcanaDisplayName,
  arcanaFailureReason,
  classifyArcanaFiles,
  isArcanaIndexed,
  refreshArcanas,
  updateArcanaStatus,
} from "../../workspace/arcanas";
import { isTextFileName } from "../../workspace/providers/saiaRag";
import type {
  RagCollection,
  RagFile,
  RagMember,
  RagMemberRole,
  RagSearchMode,
  RagSearchResult,
  RagTag,
} from "../../workspace/providers/saiaRag";
import { formatBytes } from "../../utils/formatBytes";
import { downloadBlob } from "../../utils/download";
import { buildArcanaShareLink } from "../../utils/arcanaShareLink";
import { isAgentEnabled } from "../../utils/modules";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long the manager keeps re-reading a collection after starting a job. */
const INDEX_POLL_MS = 2500;
const INDEX_POLL_LIMIT = 240;

/**
 * A retried file keeps its previous failure text until the job resets the row
 * to `stored`. Within this window that unchanged text is still "pending", not
 * the result of the attempt the user just started.
 */
const INDEX_STALE_GRACE_MS = 30_000;

type Tab = "files" | "search" | "share";

/**
 * The file list, tag editor, search and sharing of one collection.
 *
 * The sidebar can only show one row per collection, so everything a collection
 * does happens on its page: upload, index, tag, search and share. Tags are per
 * file and are edited as a comma-separated list (`set_file_tags` replaces the
 * whole list, so removing a tag is just leaving it out).
 *
 * Deleting a file asks inline instead of through `confirmAction`: the
 * modal context holds exactly one dialog, so opening the confirmation would
 * replace the one the page may be showing.
 *
 * `onFiles` reports the current rows so the page header can count them, and
 * `chatai:arcana-files-changed` (dispatched by the Arcana chat after it wrote
 * something) reloads the list without a manual refresh.
 */
export default function ArcanaManager({
  collection,
  initialTab = "files",
  focus,
  onFiles,
  framed = true,
}: {
  collection: RagCollection;
  initialTab?: Tab;
  focus?: "upload";
  onFiles?: (files: RagFile[]) => void;
  /**
   * `false` drops the card border and rounding, so the editor can fill a panel
   * that already is the card (the right-hand panel of the collection's page).
   */
  framed?: boolean;
}) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useToast();
  const display = arcanaDisplayName(collection);

  const [tab, setTab] = useState<Tab>(initialTab);  const [files, setFiles] = useState<RagFile[]>([]);
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
  // The file that is being sent right now and the bytes the service accepted.
  // `uploadCount` only moves between files, so a large document would sit at
  // "0/1" while its chunks go.
  const [uploadPart, setUploadPart] = useState<{
    name: string;
    sent: number;
    total: number;
  } | null>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RagSearchMode>("previews");
  const [count, setCount] = useState(5);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RagSearchResult[]>([]);
  const [rawResults, setRawResults] = useState("");

  // Sharing. The member list is read lazily: a chat that only uploads a file
  // never pays for the ACL call.
  const [members, setMembers] = useState<RagMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [newPrincipal, setNewPrincipal] = useState("");
  const [newRole, setNewRole] = useState<RagMemberRole>("editor");
  const [memberBusy, setMemberBusy] = useState("");
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<string | null>(
    null,
  );
  const [shareCopied, setShareCopied] = useState(false);
  // The owner's "publicly readable" switch. The service stores and enforces the
  // marker; a deployment without `set_public_read` reports `false` here and the
  // UI keeps only the member list, which is also what the service then honours.
  const [publicRead, setPublicRead] = useState(collection.public === true);
  const [publicSupported, setPublicSupported] = useState<boolean | null>(null);

  // What the collection is for. It belongs to the collection, not to a chat:
  // the service stores it and `list_collections` returns it to every client.
  const [description, setDescription] = useState(collection.description ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionSaving, setDescriptionSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");

  // One file's Markdown, when it is open in the panel's editor.
  const [markdownFile, setMarkdownFile] = useState<RagFile | null>(null);
  const [markdownDraft, setMarkdownDraft] = useState("");
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownSaving, setMarkdownSaving] = useState(false);
  const [markdownError, setMarkdownError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aliveRef = useRef(true);
  const stopIndexRef = useRef(false);
  const searchSeq = useRef(0);
  /** Has a query run since the last edit? A stale result may sit on screen. */
  const searchedRef = useRef(false);

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
  const [tools, setTools] = useState({
    index: true,
    remove: true,
    setTags: true,
    rewrite: true,
    description: true,
  });
  const canIndex = tools.index;
  const canRemove = tools.remove;
  const canSetTags = tools.setTags;
  // A description edit needs the service's own tool; an older deployment has
  // only the read side, so the control is not drawn there.
  const canEditDescription = tools.description && collection.can_write;

  const reload = useCallback(async (): Promise<RagFile[] | null> => {
    setLoading(true);
    setError("");
    try {
      const [nextFiles, nextTags] = await Promise.all([
        provider.listFiles(display, { includeTags: true }),
        provider.supportsTool("list_tags")
          ? provider.listTags(display).catch(() => [] as RagTag[])
          : Promise.resolve([] as RagTag[]),
      ]);
      if (!aliveRef.current) return null;
      setFiles(nextFiles);
      setTags(nextTags);
      updateArcanaStatus(
        collection.collection,
        classifyArcanaFiles(nextFiles),
      );
      setTools({
        index: provider.supportsTool("index_collection"),
        remove: provider.supportsTool("remove_file"),
        setTags: provider.supportsTool("set_file_tags"),
        rewrite: provider.supportsIndexedTextEdit(),
        description: provider.supportsTool("set_collection_description"),
      });
      return nextFiles;
    } catch (reason) {
      if (!aliveRef.current) return null;
      setError(reason instanceof Error ? reason.message : String(reason));
      return null;
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [collection.collection, display, provider]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const rows = await provider.listMembers(display);
      if (!aliveRef.current) return;
      setMembers(rows);
      setMembersLoaded(true);
      // The tool list comes with the handshake, which the member call just
      // completed. A service without the tool can only honour the member list.
      setPublicSupported(provider.supportsPublicRead());
    } catch (reason) {
      if (!aliveRef.current) return;
      // Keep `membersLoaded` false but show the reason: a failure must not
      // re-trigger the lazy load on every render, so the effect waits for the
      // next explicit Refresh.
      setMembersError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current) setMembersLoading(false);
    }
  }, [display, provider]);

  useEffect(() => {
    setTab(initialTab);
    // Another collection or a new tab request from the page: the open file
    // belongs to the previous view, so the editor closes instead of writing to
    // a file this view was not asked about.
    setMarkdownFile(null);
    setMarkdownDraft("");
    setMarkdownError("");
  }, [initialTab, display]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The page header counts the rows; it gets them whenever they change.
  useEffect(() => {
    onFiles?.(files);
  }, [files, onFiles]);

  // The Arcana chat writes through the provider, not through this component,
  // so it announces its changes instead of the two sharing state.
  useEffect(() => {
    const onChanged = (event: Event) => {
      const changed = (event as CustomEvent<{ collection?: string }>).detail
        ?.collection;
      if (changed && changed !== collection.collection) return;
      void reload();
    };
    window.addEventListener("chatai:arcana-files-changed", onChanged);
    return () =>
      window.removeEventListener("chatai:arcana-files-changed", onChanged);
  }, [collection.collection, reload]);

  // A different collection has a different ACL; never show the previous one's
  // people while the new list loads.
  useEffect(() => {
    setMembers([]);
    setMembersLoaded(false);
    setMembersError("");
    setConfirmRemoveMember(null);
    setNewPrincipal("");
    setPublicSupported(null);
  }, [display]);

  // The collection row can be replaced by a refresh of the page's list; the
  // switch follows the row the service reported.
  useEffect(() => {
    setPublicRead(collection.public === true);
  }, [collection.collection, collection.public]);

  // The same refresh carries a new description (another tab may have edited it).
  useEffect(() => {
    setDescription(collection.description ?? "");
  }, [collection.collection, collection.description]);

  useEffect(() => {
    if (
      tab === "share" &&
      !membersLoaded &&
      !membersLoading &&
      !membersError
    ) {
      void loadMembers();
    }
  }, [tab, membersLoaded, membersLoading, membersError, loadMembers]);

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

  // The link opens a new chat wired to this collection. It only works for a
  // caller the service lets read the collection, which outside the member list
  // means public read; so the link is offered once that is on. Only the browser
  // agent runs the app-side tools, so it also needs that workflow.
  const chatLinkAvailable = isAgentEnabled();
  const shareLink = useMemo(
    () => buildArcanaShareLink(collection.collection),
    [collection.collection],
  );

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1600);
    } catch {
      notifyError(t("arcanas.share_link_copy_failed"));
    }
  };

  /**
   * Follow a background index job until the file rows settle.
   *
   * The service runs indexing after an upload and after an explicit `index`
   * call, and offers no job status, so the rows are the only completion signal:
   * a file is done once it is no longer `stored`. Conversion makes a large
   * document take minutes, hence the generous cap; when it is reached the files
   * really are still pending. `submitted` names the files this run sent, so a
   * previous attempt's failure text is not mistaken for this run's result.
   */
  const watchIndex = async (
    submitted: string[],
    baseline: RagFile[],
  ): Promise<{ latest: RagFile[]; finished: boolean } | null> => {
    const before = new Map(baseline.map((file) => [file.name, file.status]));
    const startedAt = Date.now();
    let latest = baseline;
    for (let attempt = 0; attempt < INDEX_POLL_LIMIT; attempt += 1) {
      await sleep(INDEX_POLL_MS);
      if (!aliveRef.current || stopIndexRef.current) return null;
      latest = await provider.listFiles(display, { includeTags: true });
      if (!aliveRef.current) return null;
      setFiles(latest);
      updateArcanaStatus(
        collection.collection,
        classifyArcanaFiles(latest),
      );
      const pending = latest.some((file) => {
        if (file.status === "stored") return true;
        const previous = before.get(file.name);
        return (
          submitted.includes(file.name) &&
          previous !== undefined &&
          previous === file.status &&
          !isArcanaIndexed(previous) &&
          Date.now() - startedAt < INDEX_STALE_GRACE_MS
        );
      });
      if (!pending) return { latest, finished: true };
    }
    return { latest, finished: false };
  };

  const upload = async (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setError("");
    setBusy("upload");
    let sent = 0;
    let stored = 0;
    const uploaded: string[] = [];
    setUploadCount({ sent, total: picked.length });
    for (const file of picked) {
      const textPath = !canIndex && isTextFileName(file.name);
      // Shown before the request leaves, so the label moves on the same frame
      // as the click instead of sitting on the file counter until the first
      // chunk has been read, encoded and accepted. The legacy text upload has
      // no chunk to report, so it keeps the plain file counter.
      if (aliveRef.current) {
        setUploadPart(
          textPath ? null : { name: file.name, sent: 0, total: file.size },
        );
      }
      try {
        if (textPath) {
          // An older service only indexes through the text upload path.
          await provider.uploadTextFile(display, file.name, await file.text());
        } else {
          await provider.uploadFile(display, file, (partSent, partTotal) => {
            if (aliveRef.current) {
              setUploadPart({
                name: file.name,
                sent: partSent,
                total: partTotal || file.size,
              });
            }
          });
        }
        stored += 1;
        uploaded.push(file.name);
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
    setUploadPart(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const refreshed = await reload();
    // A failed file must not be counted as stored: its reason was already
    // reported, and a "stored" line next to it reads as success.
    if (canIndex && stored > 0) {
      notifySuccess(t("arcanas.upload_done", { count: stored }));
    }
    // The service indexes an upload in the background. Following the job here
    // is what turns the row from "stored" (or an earlier attempt's failure)
    // into the real result; without it only a manual refresh shows it.
    if (!canIndex || !uploaded.length || !refreshed) return;
    setIndexing(true);
    stopIndexRef.current = false;
    try {
      const watched = await watchIndex(uploaded, refreshed);
      if (!watched?.finished) return;
      const failed = watched.latest.filter(
        (file) => uploaded.includes(file.name) && !isArcanaIndexed(file.status),
      );
      if (failed.length === 1) {
        // The badge only says "Failed" and the row's reason line is easy to
        // miss, so a single rejected file is also named in a toast.
        notifyError(
          t("arcanas.index_done_failed_one", {
            name: failed[0].name,
            reason: arcanaFailureReason(failed[0].status) ?? failed[0].status,
          }),
          { autoClose: 8000 },
        );
      } else if (failed.length > 1) {
        notifyError(t("arcanas.index_done_failed", { count: failed.length }), {
          autoClose: 6000,
        });
      }
    } catch {
      // The upload itself worked; a failing list is already visible as the
      // list's error state, so it is not reported as a failed upload.
    } finally {
      if (aliveRef.current) setIndexing(false);
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
      const watched = await watchIndex(
        files.map((file) => file.name),
        files,
      );
      if (!watched) return;
      if (!watched.finished) {
        notifyError(t("arcanas.index_still_running"), { autoClose: 6000 });
        return;
      }
      const failed = watched.latest.filter(
        (file) => !isArcanaIndexed(file.status),
      );
      if (failed.length === 1) {
        // One file: name it and repeat the service's reason. The badge says
        // only "Failed", so otherwise the click looks like it did nothing.
        notifyError(
          t("arcanas.index_done_failed_one", {
            name: failed[0].name,
            reason: arcanaFailureReason(failed[0].status) ?? failed[0].status,
          }),
          { autoClose: 8000 },
        );
      } else if (failed.length > 1) {
        notifyError(t("arcanas.index_done_failed", { count: failed.length }), {
          autoClose: 6000,
        });
      } else {
        notifySuccess(t("arcanas.index_done"));
      }
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
      const remaining = files.filter((row) => row.name !== file.name);
      setFiles(remaining);
      updateArcanaStatus(
        collection.collection,
        classifyArcanaFiles(remaining),
      );
      notifySuccess(t("arcanas.file_removed", { name: file.name }));
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy("");
    }
  };

  /**
   * Save one file to the user's disk.
   *
   * A converted document (a PDF, Office file, …) is indexed from its Markdown
   * while the collection keeps the original upload, so its download is the
   * Markdown under a `.md` name; everything else is the stored bytes.
   */
  const download = async (file: RagFile) => {
    setBusy(`download:${file.name}`);
    try {
      const saved = await provider.downloadFile(display, file);
      downloadBlob(saved.blob, saved.name);
    } catch (reason) {
      notifyError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current) setBusy("");
    }
  };

  /**
   * Whether this row has Markdown the editor can open.
   *
   * A converted document downloads as Markdown although the collection keeps
   * its original bytes; a plain text file already is text. A PDF without a
   * converted text has nothing to edit, and an older service that cannot
   * replace the indexed text in place gets no editor at all, because saving
   * there would have to remove the uploaded original.
   */
  const editableMarkdown = (file: RagFile): boolean =>
    tools.rewrite && (file.markdown || isTextFileName(file.name));

  const openMarkdown = async (file: RagFile) => {
    setMarkdownFile(file);
    setMarkdownDraft("");
    setMarkdownError("");
    setMarkdownLoading(true);
    try {
      const saved = await provider.downloadFile(display, file);
      const text = await saved.blob.text();
      if (!aliveRef.current) return;
      setMarkdownDraft(text);
    } catch (reason) {
      if (!aliveRef.current) return;
      setMarkdownError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setMarkdownLoading(false);
    }
  };

  const closeMarkdown = () => {
    if (markdownSaving) return;
    setMarkdownFile(null);
    setMarkdownDraft("");
    setMarkdownError("");
  };

  /**
   * Save the edited Markdown and rebuild the file's index entries.
   *
   * The service replaces the text its chunks point into, so the uploaded
   * original (a PDF, a Word file, …) stays in the collection byte for byte and
   * a plain text file is overwritten under its own name. Re-embedding happens
   * inside the call, so the status it returns is final: a failed rebuild is
   * reported instead of a success message, and the refreshed row carries the
   * reason. An exception means the text itself was not written, so the editor
   * stays open with the draft.
   */
  const saveMarkdown = async () => {
    const file = markdownFile;
    if (!file || markdownSaving) return;
    if (!markdownDraft.trim()) {
      setMarkdownError(t("arcanas.markdown_empty"));
      return;
    }
    setMarkdownSaving(true);
    setMarkdownError("");
    try {
      const status = await provider.rewriteIndexedText(
        display,
        file.name,
        markdownDraft,
      );
      await reload();
      if (status && !isArcanaIndexed(status)) {
        notifyError(
          t("arcanas.markdown_index_failed", {
            name: file.name,
            reason: arcanaFailureReason(status) ?? status,
          }),
          { autoClose: 8000 },
        );
      } else {
        notifySuccess(t("arcanas.markdown_saved", { name: file.name }));
      }
      if (!aliveRef.current) return;
      setMarkdownFile(null);
      setMarkdownDraft("");
    } catch (reason) {
      if (!aliveRef.current) return;
      setMarkdownError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setMarkdownSaving(false);
    }
  };

  /**
   * Share the collection with a person by username or e-mail.
   *
   * The service validates and normalises the name (an address is stored
   * lower-cased) and owns the permission check; the form is only shown to the
   * owner, so the error path is a genuine failure (unknown service, dropped
   * connection) rather than a permission message.
   */
  const addMemberToCollection = async () => {
    const principal = newPrincipal.trim();
    if (!principal || memberBusy) return;
    setMemberBusy("add");
    setMembersError("");
    try {
      await provider.addMember(display, principal, newRole);
      if (!aliveRef.current) return;
      notifySuccess(t("arcanas.share_added", { name: principal }));
      setNewPrincipal("");
      await loadMembers();
    } catch (reason) {
      if (!aliveRef.current) return;
      setMembersError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setMemberBusy("");
    }
  };

  const removeMemberFromCollection = async (member: RagMember) => {
    setMemberBusy(`remove:${member.user}`);
    setMembersError("");
    try {
      await provider.removeMember(display, member.user);
      if (!aliveRef.current) return;
      setConfirmRemoveMember(null);
      notifySuccess(t("arcanas.share_removed", { name: member.user }));
      await loadMembers();
    } catch (reason) {
      if (!aliveRef.current) return;
      setMembersError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setMemberBusy("");
    }
  };

  const roleLabel = (role: string) =>
    t(`arcanas.role_${role}`, { defaultValue: role });

  /**
   * Turn the collection-wide read grant on or off.
   *
   * The switch is only drawn when the service advertises `set_public_read`;
   * without it a collection keeps exactly the member list it has.
   */
  const togglePublicRead = async () => {
    if (publicSupported === false || memberBusy) return;
    const next = !publicRead;
    setMemberBusy("public");
    setMembersError("");
    try {
      await provider.setPublicRead(display, next);
      if (!aliveRef.current) return;
      setPublicRead(next);
      // The list carries the flag, so the page header, the sidebar and this
      // row must not keep the old value.
      void refreshArcanas();
      notifySuccess(
        t(
          next
            ? "arcanas.share_public_enabled"
            : "arcanas.share_public_disabled",
          { name: collection.name },
        ),
      );
    } catch (reason) {
      if (!aliveRef.current) return;
      setMembersError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setMemberBusy("");
    }
  };

  /**
   * Save what the collection is for.
   *
   * The service stores it with the collection, so every client (this panel,
   * the sidebar, `list_arcanas` in a chat) reads the same text. The list is
   * refreshed afterwards, because the page header and the row carry it too.
   */
  const saveDescription = async () => {
    if (descriptionSaving) return;
    setDescriptionSaving(true);
    setDescriptionError("");
    try {
      const kept = await provider.setCollectionDescription(
        display,
        descriptionDraft,
      );
      if (!aliveRef.current) return;
      setDescription(kept);
      setDescriptionEditing(false);
      void refreshArcanas();
      notifySuccess(t("arcanas.description_saved"));
    } catch (reason) {
      if (!aliveRef.current) return;
      setDescriptionError(
        reason instanceof Error ? reason.message : String(reason),
      );
    } finally {
      if (aliveRef.current) setDescriptionSaving(false);
    }
  };

  /**
   * Run the query with an explicit tag filter.
   *
   * The filter is a parameter because a click that changes it re-runs the
   * search inside the same event, before React has re-rendered with the new
   * state. A sequence number makes the last search win, so a rapid tag toggle
   * cannot let an older answer replace a newer one.
   */
  const runSearch = async (filter: string[]) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const seq = ++searchSeq.current;
    searchedRef.current = true;
    setSearching(true);
    setError("");
    try {
      const answer = await provider.search(
        display,
        trimmed,
        mode,
        count,
        filter,
      );
      if (!aliveRef.current || seq !== searchSeq.current) return;
      setResults(answer.results);
      setRawResults(answer.raw);
    } catch (reason) {
      if (!aliveRef.current || seq !== searchSeq.current) return;
      setResults([]);
      setRawResults("");
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (aliveRef.current && seq === searchSeq.current) setSearching(false);
    }
  };

  /**
   * Apply a new tag filter and keep the search tab in step.
   *
   * Removing a tag while a result list is on screen must re-run the query;
   * otherwise the old, still-filtered hits stay visible and clearing the filter
   * looks like it did nothing.
   */
  const applyTagFilter = (next: string[]) => {
    setTagFilter(next);
    if (tab === "search" && query.trim() && searchedRef.current) {
      void runSearch(next);
    }
  };

  const toggleTag = (tag: string) =>
    applyTagFilter(
      tagFilter.includes(tag)
        ? tagFilter.filter((value) => value !== tag)
        : [...tagFilter, tag],
    );

  const clearTagFilter = () => {
    if (tagFilter.length > 0) applyTagFilter([]);
  };

  const statusBadge = (file: RagFile) => {
    if (file.status === "stored") {
      return (
        <span className="badge badge-warning badge-sm whitespace-nowrap">
          {t("arcanas.status_stored")}
        </span>
      );
    }
    if (!isArcanaIndexed(file.status)) {
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

  const cardClass = `flex h-full min-h-0 flex-col ${
    framed
      ? "rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm"
      : ""
  }`;

  // The editor takes over the panel itself: the page already has a right-hand
  // panel for this collection, so a second dialog would cover the chat for a
  // file that belongs beside it.
  if (markdownFile) {
    return (
      <section
        className={cardClass}
        data-guide="arcana-manager"
        data-collection={collection.collection}
        aria-label={collection.name}
      >
        <ArcanaMarkdownEditor
          name={markdownFile.name}
          value={markdownDraft}
          loading={markdownLoading}
          saving={markdownSaving}
          error={markdownError}
          onChange={setMarkdownDraft}
          onSave={() => void saveMarkdown()}
          onClose={closeMarkdown}
        />
      </section>
    );
  }

  return (
    <section
      className={cardClass}
      data-guide="arcana-manager"
      data-collection={collection.collection}
      aria-label={collection.name}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div
          data-guide="arcana-description"
          className="rounded-lg bg-base-200/60 px-2.5 py-2 text-xs"
        >
          {descriptionEditing ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                className="textarea textarea-sm w-full text-xs"
                rows={2}
                autoFocus
                maxLength={280}
                value={descriptionDraft}
                placeholder={t("arcanas.description_placeholder")}
                disabled={descriptionSaving}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !descriptionSaving) {
                    setDescriptionEditing(false);
                    setDescriptionError("");
                  }
                }}
              />
              {descriptionError && (
                <p className="text-[11px] text-error">{descriptionError}</p>
              )}
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={descriptionSaving}
                  onClick={() => {
                    setDescriptionEditing(false);
                    setDescriptionError("");
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  disabled={descriptionSaving}
                  onClick={() => void saveDescription()}
                >
                  {descriptionSaving ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : null}
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p
                className={`min-w-0 flex-1 whitespace-pre-wrap leading-relaxed ${
                  description
                    ? "text-base-content/70"
                    : "italic text-base-content/45"
                }`}
              >
                {description || t("arcanas.description_empty")}
              </p>
              {canEditDescription && (
                <button
                  type="button"
                  data-guide="arcana-description-edit"
                  className="btn btn-ghost btn-xs shrink-0"
                  onClick={() => {
                    setDescriptionDraft(description);
                    setDescriptionError("");
                    setDescriptionEditing(true);
                  }}
                >
                  <Edit size={13} />
                  {t("arcanas.description_edit")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 pb-2">
          <div className="flex items-center gap-1">
            {tabButton("files", <Document size={14} />, t("arcanas.tab_files"))}
            {tabButton("search", <Search size={14} />, t("arcanas.tab_search"))}
            {tabButton("share", <Share size={14} />, t("arcanas.tab_share"))}
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
                title={
                  busy === "upload" && uploadPart
                    ? t("arcanas.uploading_name", { name: uploadPart.name })
                    : t("arcanas.upload")
                }
              >
                <Upload size={14} />
                {busy === "upload" && uploadCount
                  ? uploadPart && uploadPart.total > 0
                    ? t("arcanas.uploading_progress", {
                        sent: uploadCount.sent,
                        total: uploadCount.total,
                        percent: Math.min(
                          100,
                          Math.round((uploadPart.sent / uploadPart.total) * 100),
                        ),
                      })
                    : t("arcanas.uploading", {
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
          ) : tab === "share" ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => void loadMembers()}
              disabled={membersLoading}
              title={t("arcanas.refresh")}
            >
              <Renew size={14} />
              {t("arcanas.refresh")}
            </button>
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
                    aria-pressed={tagFilter.includes(tag.name)}
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
                    data-guide="arcana-clear-filter"
                    onClick={clearTagFilter}
                    className="btn btn-ghost btn-xs ml-1 gap-1 text-base-content/60"
                  >
                    {t("arcanas.clear_filter")}
                  </button>
                )}
              </div>
            )}
            {tagFilter.length > 0 && (
              <p className="text-[11px] text-base-content/55">
                {t("arcanas.filter_active", {
                  shown: visibleFiles.length,
                  total: files.length,
                })}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-base-300">
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
                        <span
                          data-file-type={fileTypeIcon(file.name).type}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/55"
                        >
                          <FileTypeIcon name={file.name} size={14} />
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
                            {arcanaFailureReason(file.status) && (
                              // The badge says only "Failed"; the service's own
                              // reason ("conversion: …") belongs in the row, not
                              // in a tooltip nobody opens.
                              <span
                                className="basis-full min-w-0 truncate text-error"
                                title={file.status}
                              >
                                {arcanaFailureReason(file.status)}
                              </span>
                            )}
                          </p>
                        </div>
                        {statusBadge(file)}
                        <button
                          type="button"
                          data-guide="arcana-download"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => void download(file)}
                          disabled={Boolean(busy)}
                          title={
                            file.markdown
                              ? t("arcanas.download_markdown")
                              : t("arcanas.download")
                          }
                          aria-label={
                            file.markdown
                              ? t("arcanas.download_markdown")
                              : t("arcanas.download")
                          }
                        >
                          {busy === `download:${file.name}` ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        {editableMarkdown(file) && collection.can_write && (
                          <button
                            type="button"
                            data-guide="arcana-edit-markdown"
                            className="btn btn-ghost btn-xs btn-square"
                            onClick={() => void openMarkdown(file)}
                            disabled={Boolean(busy)}
                            title={t("arcanas.edit_markdown")}
                            aria-label={t("arcanas.edit_markdown")}
                          >
                            <Edit size={14} />
                          </button>
                        )}
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
        ) : tab === "search" ? (
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input input-sm min-w-[12rem] flex-1"
                value={query}
                placeholder={t("arcanas.search_placeholder")}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void runSearch(tagFilter);
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
                onClick={() => void runSearch(tagFilter)}
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
                    title={t("arcanas.remove_filter_tag")}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearTagFilter}
                  className="btn btn-ghost btn-xs gap-1 text-base-content/60"
                >
                  {t("arcanas.clear_filter")}
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
        ) : (
          <div className="flex min-h-0 flex-col gap-3" data-guide="arcana-share">
            {collection.can_manage ? (
              <div
                className="rounded-xl border border-base-300 bg-base-200/40 p-3"
                data-guide="arcana-share-public"
              >
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium">
                    {t("arcanas.share_public_title")}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="toggle toggle-sm"
                    data-guide="arcana-share-public-toggle"
                    checked={publicRead}
                    disabled={
                      publicSupported === false || memberBusy === "public"
                    }
                    onChange={() => void togglePublicRead()}
                    aria-label={t("arcanas.share_public_title")}
                  />
                </label>
                <p className="mt-0.5 text-[11px] text-base-content/60">
                  {publicSupported === false
                    ? t("arcanas.share_public_unavailable")
                    : t("arcanas.share_public_hint")}
                </p>
              </div>
            ) : publicRead ? (
              <p
                className="flex items-center gap-1.5 text-xs text-base-content/60"
                data-guide="arcana-share-public-badge"
              >
                <Share size={13} />
                {t("arcanas.share_public_badge")}
              </p>
            ) : null}

            {chatLinkAvailable && publicRead && (
              <div
                className="rounded-xl border border-base-300 bg-base-200/40 p-3"
                data-guide="arcana-share-link"
              >
                <p className="text-xs font-medium">
                  {t("arcanas.share_link_title")}
                </p>
                <p className="mt-0.5 text-[11px] text-base-content/60">
                  {t("arcanas.share_link_hint")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    className="input input-sm min-w-0 flex-1 font-mono text-[11px]"
                    value={shareLink}
                    aria-label={t("arcanas.share_link_title")}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    className="btn btn-sm gap-1"
                    data-guide="arcana-share-link-copy"
                    onClick={() => void copyShareLink()}
                    disabled={!shareLink}
                  >
                    <Copy size={14} />
                    {shareCopied
                      ? t("arcanas.share_link_copied")
                      : t("arcanas.share_link_copy")}
                  </button>
                  <a
                    className="btn btn-ghost btn-sm gap-1"
                    href={shareLink || undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!shareLink}
                  >
                    <Launch size={14} />
                    {t("arcanas.share_link_open")}
                  </a>
                </div>
              </div>
            )}

            {chatLinkAvailable && !publicRead && collection.can_manage && (
              <p
                className="text-[11px] text-base-content/60"
                data-guide="arcana-share-link-hint"
              >
                {publicSupported === false
                  ? t("arcanas.share_link_needs_members")
                  : t("arcanas.share_link_needs_public")}
              </p>
            )}

            <p className="text-xs text-base-content/60">
              {collection.can_manage
                ? t("arcanas.share_hint")
                : t("arcanas.share_owner_only")}
            </p>

            {membersError && (
              <div className="flex items-start gap-1.5 rounded-lg bg-error/10 px-2 py-1.5 text-xs text-error">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{membersError}</span>
              </div>
            )}

            {collection.can_manage && (
              <form
                className="flex flex-wrap items-end gap-2"
                data-guide="arcana-share-add"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addMemberToCollection();
                }}
              >
                <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                  <span className="text-[11px] text-base-content/60">
                    {t("arcanas.share_placeholder")}
                  </span>
                  <input
                    className="input input-sm w-full"
                    data-guide="arcana-share-input"
                    value={newPrincipal}
                    placeholder={t("arcanas.share_placeholder")}
                    onChange={(event) => setNewPrincipal(event.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-base-content/60">
                    {t("arcanas.share_role")}
                  </span>
                  <select
                    className="select select-sm w-auto"
                    value={newRole}
                    onChange={(event) =>
                      setNewRole(event.target.value as RagMemberRole)
                    }
                  >
                    <option value="editor">{t("arcanas.role_editor")}</option>
                    <option value="reader">{t("arcanas.role_reader")}</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm gap-1"
                  disabled={!newPrincipal.trim() || Boolean(memberBusy)}
                >
                  {memberBusy === "add" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Add size={14} />
                  )}
                  {t("arcanas.share_add")}
                </button>
              </form>
            )}

            {membersLoading && members.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-base-content/60">
                <Loader2 size={14} className="animate-spin" />
                {t("arcanas.share_loading")}
              </div>
            ) : members.length === 0 ? (
              membersError ? null : (
                <p className="rounded-xl border border-dashed border-base-300 px-3 py-8 text-center text-xs text-base-content/60">
                  {t("arcanas.share_empty")}
                </p>
              )
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-base-300 overflow-y-auto rounded-xl border border-base-300">
                {members.map((member) => (
                  <li
                    key={`${member.kind}:${member.user}`}
                    className="px-3 py-2"
                    data-guide="arcana-member"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/55">
                        <Share size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-xs font-medium"
                          title={member.user}
                        >
                          {member.user}
                        </p>
                        {member.kind === "group" && (
                          <p className="text-[10px] text-base-content/50">
                            {t("arcanas.share_group")}
                          </p>
                        )}
                      </div>
                      <span
                        className={`badge badge-sm whitespace-nowrap ${
                          member.role === "owner"
                            ? "badge-primary"
                            : "badge-ghost"
                        }`}
                      >
                        {roleLabel(member.role)}
                      </span>
                      {collection.can_manage && member.role !== "owner" && (
                        <button
                          type="button"
                          data-guide="arcana-member-remove"
                          className="btn btn-ghost btn-xs btn-square text-error"
                          onClick={() =>
                            setConfirmRemoveMember(
                              confirmRemoveMember === member.user
                                ? null
                                : member.user,
                            )
                          }
                          disabled={Boolean(memberBusy)}
                          title={t("arcanas.share_remove")}
                          aria-label={t("arcanas.share_remove")}
                        >
                          <TrashCan size={14} />
                        </button>
                      )}
                    </div>
                    {confirmRemoveMember === member.user && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-error/10 px-2 py-1.5 pl-9 text-xs">
                        <span className="min-w-0 flex-1 text-error">
                          {t("arcanas.share_remove_confirm", {
                            name: member.user,
                          })}
                        </span>
                        <button
                          type="button"
                          className="btn btn-error btn-xs"
                          onClick={() =>
                            void removeMemberFromCollection(member)
                          }
                          disabled={memberBusy === `remove:${member.user}`}
                        >
                          {t("arcanas.share_remove")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setConfirmRemoveMember(null)}
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
        )}
      </div>
    </section>
  );
}
