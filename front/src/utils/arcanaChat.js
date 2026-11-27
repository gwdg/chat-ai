// The Arcana chat's tools: one fixed collection, read through saia-rag.
//
// The page selects the collection, so no tool takes a collection argument and a
// prompt cannot point a call at somebody else's Arcana. Reads run as soon as the
// model asks for them. Writes (upload, overwrite, delete, index, tags) never
// run here: the tool validates the request, captures what undoing it would need
// and returns a proposal, which the app turns into the approval card below the
// assistant's answer. The tool result is what the model sees, so it is told
// plainly that nothing was written and that the user has to accept.
import { formatBytes } from "./formatBytes";
import { normalizeTagList } from "./tags";
import {
  MAX_ARCANA_RESTORE_BYTES,
  arcanaActionKey,
  normalizeArcanaAction,
} from "./arcanaActions";
import {
  MAX_ARCANA_DOCUMENT_PAGES,
  arcanaDocumentKey,
  normalizeArcanaDocument,
  splitDocumentPages,
} from "./arcanaDocuments";
import {
  arcanasProvider,
  arcanaFailureReason,
  classifyArcanaFiles,
  isArcanaIndexed,
} from "../workspace/arcanas";
import {
  isTextFileName,
  markdownFileName,
  ragCollectionDisplayName,
} from "../workspace/providers/saiaRag";

/** One read is capped so a large document cannot fill the context. */
const MAX_READ_CHARS = 60_000;
/** A search answer is capped the same way, hit by hit and in total. */
const MAX_HIT_CHARS = 4_000;
const MAX_SEARCH_CHARS = 30_000;
const DEFAULT_SEARCH_COUNT = 5;
const MAX_SEARCH_COUNT = 20;

const tool = (name, description, properties = {}, required = []) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
    },
  },
});

const READ_TOOLS = [
  tool(
    "list_files",
    "List the files stored in this Arcana with their size, index status, chunk count, tags and whether a converted Markdown copy exists.",
  ),
  tool(
    "read_file",
    "Read one file. A converted document returns its indexed Markdown; a plain text file returns its text. Binary files cannot be read as text.",
    { filename: { type: "string", description: "Exact file name" } },
    ["filename"],
  ),
  tool(
    "search",
    "Search inside the Arcana and return matching passages with their file name. Use this to test whether the collection answers a question. Pass tags to search only the files carrying all of them.",
    {
      query: { type: "string", description: "Text to look for" },
      mode: {
        type: "string",
        enum: ["previews", "documents", "chunks"],
        description:
          "previews returns document previews, documents a file list, chunks the raw matching text",
      },
      count: {
        type: "number",
        description: `How many results, 1-${MAX_SEARCH_COUNT}`,
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Only search files carrying all of these tags. Optional; omit it to search the whole Arcana.",
      },
    },
    ["query"],
  ),
  tool(
    "retrieve_document",
    "Show the page a passage came from. Returns that page and the page after it and adds a source card under your answer that opens the document at that page. Pass the p.N of a search hit; omit the page (and pass the user's question as query) to let the search pick the best page of that file. Use it whenever you quote from a document.",
    {
      filename: { type: "string", description: "Exact file name" },
      page: {
        type: "number",
        description: "Page to show, usually the page of a search hit",
      },
      query: {
        type: "string",
        description:
          "The question to find the best page for, used when no page is given",
      },
    },
    ["filename"],
  ),
  tool(
    "get_index_status",
    "Report how much of the collection is indexed, which files are still pending and why a file failed.",
  ),
  tool(
    "list_members",
    "List the people and groups that can open this Arcana and their role.",
  ),
];

const WRITE_TOOLS = [
  tool(
    "upload_attachment",
    "Propose storing one file the user attached to this chat in the Arcana. Nothing is written: the user accepts the approval card below your answer, and the service then converts and indexes the file in the background.",
    {
      filename: {
        type: "string",
        description:
          "Name of the attached file to upload; omit it when the chat has exactly one attachment",
      },
    },
  ),
  tool(
    "write_text_file",
    "Propose creating or overwriting a text file in the Arcana with the given content. Nothing is written until the user accepts the approval card below your answer.",
    {
      filename: { type: "string", description: "File name, no folders" },
      content: { type: "string", description: "Complete UTF-8 text" },
    },
    ["filename", "content"],
  ),
  tool(
    "delete_file",
    "Propose removing a file and its index entries from the Arcana. Nothing is deleted until the user accepts the approval card below your answer.",
    { filename: { type: "string", description: "Exact file name" } },
    ["filename"],
  ),
  tool(
    "start_index",
    "Propose converting and indexing every stored file of the Arcana. Nothing starts until the user accepts the approval card below your answer.",
  ),
  tool(
    "set_file_tags",
    "Propose replacing the tag list of one file. Nothing changes until the user accepts the approval card below your answer.",
    {
      filename: { type: "string", description: "Exact file name" },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "The complete new tag list; an empty list removes all tags",
      },
    },
    ["filename", "tags"],
  ),
];

/**
 * The function tools for `collection`.
 *
 * A read-only collection gets no write tools at all, so the model cannot offer
 * an upload it would not be allowed to make.
 */
export function getArcanaChatToolDefinitions(collection) {
  return collection?.can_write
    ? [...READ_TOOLS, ...WRITE_TOOLS]
    : [...READ_TOOLS];
}

export function buildArcanaChatSystemPrompt(collection) {
  const name = collection?.name ?? "this Arcana";
  const role = collection?.role ?? "unknown";
  const canWrite = Boolean(collection?.can_write);
  return `You are the Arcana assistant for the SAIA document collection "${name}" (role: ${role}). You help the user inspect, change, test and share this one collection. The collection is fixed: never claim to work on another Arcana.

The collection's contents are not embedded in this prompt. Use the tools for every current value: list_files, read_file, search, retrieve_document, get_index_status and list_members. The data can change between turns, so call the tool again instead of assuming an earlier answer still applies. Never invent a file name, chunk count, tag, search hit or member. If a tool returns nothing useful, say so plainly.

When you quote a passage from a file, call retrieve_document with that file and the page a search hit reported (p.N). It returns that page and the next one and shows the user a source card that opens the document at the page, so cite the file and page in your answer instead of only pasting the text.

${
  canWrite
    ? `You may propose changes to the collection, but only when the user explicitly asks for one: upload_attachment stores a file the user attached to this chat, write_text_file creates or overwrites a text file, delete_file removes one, start_index converts and indexes the stored files, and set_file_tags replaces one file's tags. Those tools do not write anything. Each one validates the request and returns a proposal, and the app shows it as an approval card below your answer; the user's click is what changes the collection. After a successful proposal, say in one sentence what you proposed, tell the user to accept it in the card, and stop. Never repeat the same call, never claim the change is done, and never ask the user to confirm in their reply.`
    : `This collection is read-only for the user, so no write tools are available. Explain that the owner has to change files or access instead of offering an upload.`
}

Search is how the user tests the collection: run the query they ask for and report which file each hit came from. list_files names each file's tags, and a search takes optional tags to look only in the files carrying all of them, not just one. Plain text is searchable once indexed; PDFs, Office documents and images are converted through docling first, which is why a file can be stored but not searchable yet. A converted file offers its indexed Markdown for download, while the collection keeps the original upload. The service indexes an upload in the background, so a new file may sit at "stored" for a while.

Answer in the same language as the user's question. Be concise and concrete.`;
}

const truncate = (text, limit) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… (truncated at ${limit} characters)`;
};

const findFile = (files, filename) => {
  const wanted = String(filename ?? "").trim();
  if (!wanted) return null;
  return (
    files.find((file) => file.name === wanted) ??
    files.find((file) => file.name.toLowerCase() === wanted.toLowerCase()) ??
    null
  );
};

const describeFiles = (files) => {
  if (!files.length) return "The Arcana has no files yet.";
  return [
    `${files.length} file(s) in the Arcana:`,
    ...files
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((file) => {
        const parts = [];
        if (typeof file.size === "number") parts.push(formatBytes(file.size));
        parts.push(file.status || "indexed");
        parts.push(`${file.chunks} chunk(s)`);
        if (file.tags.length) parts.push(`tags: ${file.tags.join(", ")}`);
        if (file.markdown) parts.push(`Markdown: ${markdownFileName(file.name)}`);
        return `- ${file.name} — ${parts.join(" · ")}`;
      }),
  ].join("\n");
};

const describeIndex = (files) => {
  const status = classifyArcanaFiles(files);
  const pending = files.filter((file) => file.status === "stored");
  const failed = files.filter(
    (file) => file.status !== "stored" && !isArcanaIndexed(file.status),
  );
  return [
    `Index status: ${status} (${files.length} file(s)).`,
    ...(pending.length
      ? [
          `Not indexed yet: ${pending.map((file) => file.name).join(", ")}. The service converts and indexes them in the background.`,
        ]
      : []),
    ...(failed.length
      ? [
          `Failed: ${failed
            .map((file) => `${file.name} (${arcanaFailureReason(file.status) ?? file.status})`)
            .join("; ")}.`,
        ]
      : []),
  ].join("\n");
};

const describeSearch = (query, mode, count, results, raw) => {
  if (!results.length) {
    return `No matching passages for "${query}".${raw && !/no (matching|results)/i.test(raw) ? `\n${truncate(raw, MAX_SEARCH_CHARS)}` : ""}`;
  }
  const lines = [`Search for "${query}" (${mode}, ${count} requested) returned ${results.length} result(s):`];
  let used = 0;
  for (const [index, result] of results.entries()) {
    const text = String(result.text ?? "").trim();
    const room = Math.min(MAX_HIT_CHARS, MAX_SEARCH_CHARS - used);
    if (room <= 0) break;
    used += Math.min(text.length, room);
    lines.push(
      `${index + 1}. ${result.filename}${typeof result.score === "number" ? ` (score ${result.score.toFixed(3)})` : ""}\n${truncate(text, room)}`,
    );
  }
  return lines.join("\n\n");
};

/**
 * Feed files to the model as text, whatever kind they are.
 *
 * A converted document is downloaded through `downloadFile`, which asks the
 * service for the indexed Markdown; everything else is the original bytes.
 */
async function readFileText(provider, display, file) {
  if (file.markdown) {
    const { blob } = await provider.downloadFile(display, file);
    return { text: await blob.text(), kind: "markdown" };
  }
  if (!isTextFileName(file.name)) return { text: null, kind: "binary" };
  const { blob } = await provider.downloadFile(display, file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { text: new TextDecoder().decode(bytes), kind: "text" };
}

/**
 * The text that would restore an existing file, or null when the proposal can
 * not undo writing over it.
 *
 * Only a plain text file is restorable: a converted document's indexed Markdown
 * is not its original bytes, and a binary or oversized file would either come
 * back corrupted or fill the stored thread.
 */
async function restoreTextFor(provider, display, file) {
  if (!file || file.markdown || !isTextFileName(file.name)) return null;
  const { blob } = await provider.downloadFile(display, file);
  if (blob.size > MAX_ARCANA_RESTORE_BYTES) return null;
  return blob.text();
}

/**
 * The Arcana tools, plus the proposals they produced.
 *
 * `run(name, args)` is what the model sees. `takeProposals()` hands the app the
 * changes to put into the approval card and resets the list, so a repeated call
 * is proposed once. Nothing here writes to the collection.
 */
export function createArcanaChatToolRunner({ collection, attachments = [] }) {
  const display = ragCollectionDisplayName(collection);
  const provider = arcanasProvider();
  const proposals = [];
  /**
   * The pages the answer quotes. Unlike a proposal, a citation is read-only, so
   * it is collected as soon as the tool reads it; the app turns each one into a
   * source card and the model gets the text as the tool result.
   */
  const documents = [];

  const listFiles = () =>
    provider.listFiles(display, { includeTags: true }).then((files) =>
      Array.isArray(files) ? files : [],
    );

  const requireWrite = () => {
    if (!collection.can_write) {
      throw new Error("This Arcana is read-only for this user.");
    }
  };

  const safeName = (value) => {
    const name = String(value ?? "").trim();
    if (!name || name === "." || name === ".." || /[\\/\u0000]/.test(name)) {
      throw new Error("A file name must not be empty and must not contain folders.");
    }
    return name;
  };

  const propose = (value) => {
    // A proposal carries the collection's reference (`owner/name`), which is the
    // identity the page URL, the thread id and the approval card use. The
    // display segment below is only what the provider's calls and paths take; a
    // marker naming the display segment would never match the chat's own id.
    const action = normalizeArcanaAction({
      ...value,
      collection: collection.collection,
    });
    if (!action) throw new Error("That change could not be proposed.");
    const key = arcanaActionKey(action);
    if (!proposals.some((entry) => arcanaActionKey(entry) === key)) {
      proposals.push(action);
    }
    return action;
  };

  const proposed = (what) =>
    `Proposed: ${what}. Nothing has been written yet. Tell the user to accept it in the approval card below your answer, then stop; do not call this tool again for the same change.`;

  /**
   * Record one cited page range. A repeated call replaces the stored excerpt
   * (the file may have changed) instead of adding a second card row.
   */
  const addDocument = (value) => {
    const document = normalizeArcanaDocument({
      ...value,
      collection: collection.collection,
    });
    if (!document) return null;
    const key = arcanaDocumentKey(document);
    const existing = documents.find(
      (entry) => arcanaDocumentKey(entry) === key,
    );
    if (existing) {
      Object.assign(existing, document);
      return existing;
    }
    documents.push(document);
    return document;
  };

  /** The page a hit for `query` reports for `filename`, if the service names one. */
  const bestPage = async (filename, query) => {
    const { results } = await provider.search(
      display,
      query,
      "chunks",
      MAX_SEARCH_COUNT,
    );
    return results.find((result) => result.filename === filename)?.page;
  };

  const run = async (name, args = {}) => {
    switch (name) {
      case "list_files":
        return describeFiles(await listFiles());

      case "read_file": {
        const files = await listFiles();
        const file = findFile(files, args.filename);
        if (!file) {
          return `No file named "${args.filename}". Files: ${
            files.map((entry) => entry.name).join(", ") || "(none)"
          }`;
        }
        const { text, kind } = await readFileText(provider, display, file);
        if (text === null) {
          return `${file.name} is a binary file (${typeof file.size === "number" ? formatBytes(file.size) : "unknown size"}). Text extraction is only available once the service indexed it; use the Download button for its bytes.`;
        }
        return `${file.name} (${kind}${file.markdown ? ", indexed Markdown" : ""}):\n${truncate(text, MAX_READ_CHARS)}`;
      }

      case "search": {
        const query = String(args.query ?? "").trim();
        if (!query) return "A search needs a query.";
        const mode = ["previews", "documents", "chunks"].includes(args.mode)
          ? args.mode
          : "previews";
        const count = Math.min(
          MAX_SEARCH_COUNT,
          Math.max(
            1,
            Number.isFinite(Number(args.count))
              ? Math.floor(Number(args.count))
              : DEFAULT_SEARCH_COUNT,
          ),
        );
        const tags = normalizeTagList(args.tags);
        if (tags.length && !provider.supportsTool("set_file_tags")) {
          return "This Arcana service cannot filter a search by tags, so nothing was searched. Run the search again without tags and tell the user tag filtering is unavailable there.";
        }
        const { results, raw } = await provider.search(
          display,
          query,
          mode,
          count,
          tags,
        );
        return describeSearch(query, mode, count, results, raw);
      }

      case "retrieve_document": {
        const files = await listFiles();
        const file = findFile(files, args.filename);
        if (!file) {
          return `No file named "${args.filename}". Files: ${
            files.map((entry) => entry.name).join(", ") || "(none)"
          }`;
        }
        if (!file.markdown && !isTextFileName(file.name)) {
          return `${file.name} is a binary file, so it has no text pages to quote. Use search and report the hit instead.`;
        }
        let page = Math.floor(Number(args.page));
        if (!(Number.isFinite(page) && page >= 1)) {
          const query = String(args.query ?? "").trim();
          page = query ? await bestPage(file.name, query) : undefined;
        }
        // A plain text file has no page markers: its whole text is the excerpt,
        // and the card opens the file itself.
        const excerpt =
          file.markdown && page
            ? await provider.readDocumentExcerpt(display, file.name, page)
            : file.markdown
              ? await provider.readDocumentExcerpt(display, file.name, 1)
              : (await readFileText(provider, display, file)).text;
        if (excerpt === null || !excerpt.trim()) {
          return `"${file.name}" has no readable text${page ? ` on page ${page}` : ""}. Use search to find a passage that was indexed.`;
        }
        const blocks = splitDocumentPages(excerpt).filter(
          (block) => block.page !== null,
        );
        const document = addDocument({
          collection: collection.collection,
          filename: file.name,
          // The excerpt itself decides the page: a converted document always
          // writes `[Page N]: #`, and a plain text file never does.
          page: blocks.length ? blocks[0].page : undefined,
          pages: Math.min(blocks.length || 1, MAX_ARCANA_DOCUMENT_PAGES),
          excerpt,
        });
        const shownPage = blocks.length ? blocks[0].page : undefined;
        const shownPages = Math.min(
          blocks.length || 1,
          MAX_ARCANA_DOCUMENT_PAGES,
        );
        const where = shownPage
          ? ` page ${shownPage}${shownPages > 1 ? `-${shownPage + shownPages - 1}` : ""}`
          : "";
        return `${file.name}${where} (shown as a source card under your answer):\n${truncate(excerpt, MAX_READ_CHARS)}${document ? `\n\nCite "${file.name}"${shownPage ? `, page ${shownPage}` : ""} in your answer.` : ""}`;
      }

      case "get_index_status":
        return describeIndex(await listFiles());

      case "list_members": {
        const members = await provider.listMembers(display);
        if (!members.length) return "Only the owner can open this Arcana.";
        return [
          "People and groups with access:",
          ...members.map(
            (member) =>
              `- ${member.user} — ${member.role}${member.kind === "group" ? " (group)" : ""}`,
          ),
        ].join("\n");
      }

      case "upload_attachment": {
        requireWrite();
        const wanted = String(args.filename ?? "").trim();
        const available = attachments.filter((entry) => entry?.file);
        if (!available.length) {
          return "This chat has no attachment to upload. Ask the user to attach the file to their message first.";
        }
        const attachment = wanted
          ? available.find(
              (entry) =>
                entry.name === wanted ||
                entry.name.toLowerCase() === wanted.toLowerCase(),
            )
          : available.length === 1
            ? available[0]
            : null;
        if (!attachment) {
          return `Which attachment? Available: ${available
            .map((entry) => entry.name)
            .join(", ")}`;
        }
        const files = await listFiles();
        propose({
          op: "upload_attachment",
          filename: attachment.name,
          fileId: attachment.fileId,
          size: attachment.file.size,
          existed: Boolean(findFile(files, attachment.name)),
        });
        return proposed(
          `store "${attachment.name}" (${formatBytes(attachment.file.size)}) in "${collection.name}"`,
        );
      }

      case "write_text_file": {
        requireWrite();
        const filename = safeName(args.filename);
        const content = String(args.content ?? "");
        const size = new TextEncoder().encode(content).byteLength;
        const files = await listFiles();
        const existing = findFile(files, filename);
        propose({
          op: "write_text_file",
          filename,
          content,
          size,
          existed: Boolean(existing),
          previousText: await restoreTextFor(provider, display, existing),
        });
        return proposed(
          `write "${filename}" (${formatBytes(size)}) into "${collection.name}"${existing ? ", overwriting the stored file" : ""}`,
        );
      }

      case "delete_file": {
        requireWrite();
        const filename = safeName(args.filename);
        const files = await listFiles();
        const file = findFile(files, filename);
        if (!file) {
          return `No file named "${filename}" exists, so there is nothing to delete.`;
        }
        propose({
          op: "delete_file",
          filename,
          size: file.size,
          restoreText: await restoreTextFor(provider, display, file),
        });
        return proposed(`delete "${filename}" and its index entries`);
      }

      case "start_index": {
        requireWrite();
        propose({ op: "start_index" });
        return proposed(
          `index every stored file of "${collection.name}". Large documents take longer; get_index_status follows the rows`,
        );
      }

      case "set_file_tags": {
        requireWrite();
        const filename = safeName(args.filename);
        const tags = Array.isArray(args.tags)
          ? args.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [];
        const files = await listFiles();
        const file = findFile(files, filename);
        if (!file) {
          return `No file named "${filename}" exists, so there are no tags to change.`;
        }
        propose({
          op: "set_file_tags",
          filename,
          tags,
          previousTags: Array.isArray(file.tags) ? file.tags : [],
        });
        return proposed(
          `set the tags of "${filename}" to ${tags.length ? tags.join(", ") : "(none)"}`,
        );
      }

      default:
        throw new Error(`Unknown Arcana tool: ${name}`);
    }
  };

  return {
    run,
    takeProposals() {
      return proposals.splice(0, proposals.length);
    },
    /** Every citation captured in this turn, deduplicated. */
    getDocuments() {
      return [...documents];
    },
  };
}
