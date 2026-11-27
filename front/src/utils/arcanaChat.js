// The Arcana chat's tools: one fixed collection, read through saia-rag.
//
// The page selects the collection, so no tool takes a collection argument and a
// prompt cannot point a call at somebody else's Arcana. Reads run as soon as the
// model asks for them; every write (upload, overwrite, delete, index, tags) is
// shown to the user as a confirmation dialog first and only runs when it is
// accepted. The tool result is what the model sees, so a refused confirmation
// is reported back as "cancelled" instead of being silently skipped.
import { formatBytes } from "./formatBytes";
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
    "Search inside the Arcana and return matching passages with their file name. Use this to test whether the collection answers a question.",
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
    },
    ["query"],
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
    "Store one file the user attached to this chat in the Arcana. The service converts and indexes it in the background. Asks the user before writing.",
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
    "Create or overwrite a text file in the Arcana with the given content. Asks the user before writing.",
    {
      filename: { type: "string", description: "File name, no folders" },
      content: { type: "string", description: "Complete UTF-8 text" },
    },
    ["filename", "content"],
  ),
  tool(
    "delete_file",
    "Remove a file and its index entries from the Arcana. Asks the user first.",
    { filename: { type: "string", description: "Exact file name" } },
    ["filename"],
  ),
  tool(
    "start_index",
    "Convert and index every stored file of the Arcana. Asks the user first.",
  ),
  tool(
    "set_file_tags",
    "Replace the tag list of one file. Asks the user first.",
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

The collection's contents are not embedded in this prompt. Use the tools for every current value: list_files, read_file, search, get_index_status and list_members. The data can change between turns, so call the tool again instead of assuming an earlier answer still applies. Never invent a file name, chunk count, tag, search hit or member. If a tool returns nothing useful, say so plainly.

${
  canWrite
    ? `You may change the collection, but only when the user explicitly asks for that change: upload_attachment stores a file the user attached to this chat, write_text_file creates or overwrites a text file, delete_file removes one, start_index converts and indexes the stored files, and set_file_tags replaces one file's tags. Every one of those opens a confirmation dialog that the user must accept; never say an action is done before its tool result arrives, and report a cancelled confirmation as cancelled.`
    : `This collection is read-only for the user, so no write tools are available. Explain that the owner has to change files or access instead of offering an upload.`
}

Search is how the user tests the collection: run the query they ask for and report which file each hit came from. Plain text is searchable once indexed; PDFs, Office documents and images are converted through docling first, which is why a file can be stored but not searchable yet. A converted file offers its indexed Markdown for download, while the collection keeps the original upload. The service indexes an upload in the background, so a new file may sit at "stored" for a while.

Answer in the same language as the user's question. Be concise and concrete.`;
}

const truncate = (text, limit) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… (truncated at ${limit} characters)`;
};

/** One-shot byte stream for `provider.write`. */
const streamOf = (bytes) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

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
 * Run one tool call for `collection`.
 *
 * `confirm` resolves to true only after the user accepted the dialog. The
 * runner never writes without it and never invents a result the service did not
 * return. `attachments` are the files attached to the current chat, so
 * `upload_attachment` can store them without the model ever seeing their bytes.
 */
export function createArcanaChatToolRunner({
  collection,
  attachments = [],
  confirm,
  onChange,
}) {
  const display = ragCollectionDisplayName(collection);
  const provider = arcanasProvider();

  const listFiles = () =>
    provider.listFiles(display, { includeTags: true }).then((files) =>
      Array.isArray(files) ? files : [],
    );

  const ask = async (props) => {
    if (!confirm) return false;
    return Boolean(await confirm(props));
  };

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

  const changed = () => onChange?.();

  return async function runTool(name, args = {}) {
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
        const { results, raw } = await provider.search(
          display,
          query,
          mode,
          count,
        );
        return describeSearch(query, mode, count, results, raw);
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
        const accepted = await ask({
          messageKey: "arcana_chat.confirm_upload",
          messageValues: {
            name: attachment.name,
            size: formatBytes(attachment.file.size),
            collection: collection.name,
          },
          confirmKey: "arcana_chat.confirm_upload_yes",
          danger: false,
        });
        if (!accepted) return "The upload was cancelled; nothing was stored.";
        await provider.uploadFile(display, attachment.file);
        changed();
        return `Stored "${attachment.name}" in "${collection.name}". The service converts and indexes it in the background, so use get_index_status or search to follow it.`;
      }

      case "write_text_file": {
        requireWrite();
        const filename = safeName(args.filename);
        const content = String(args.content ?? "");
        const accepted = await ask({
          messageKey: "arcana_chat.confirm_write",
          messageValues: {
            name: filename,
            size: formatBytes(new TextEncoder().encode(content).byteLength),
          },
          confirmKey: "arcana_chat.confirm_write_yes",
          danger: false,
        });
        if (!accepted) return "The write was cancelled; nothing changed.";
        const bytes = new TextEncoder().encode(content);
        await provider.write(
          `/${display}/${filename}`,
          streamOf(bytes),
          { size: bytes.byteLength, overwrite: true },
        );
        changed();
        return `Wrote "${filename}" (${formatBytes(bytes.byteLength)}) into "${collection.name}". The service indexes it in the background.`;
      }

      case "delete_file": {
        requireWrite();
        const filename = safeName(args.filename);
        const files = await listFiles();
        if (!findFile(files, filename)) {
          return `No file named "${filename}" exists, so nothing was deleted.`;
        }
        const accepted = await ask({
          messageKey: "arcana_chat.confirm_delete",
          messageValues: { name: filename },
          confirmKey: "arcana_chat.confirm_delete_yes",
          danger: true,
        });
        if (!accepted) return "The deletion was cancelled; nothing was removed.";
        await provider.removeFile(display, filename);
        changed();
        return `Removed "${filename}" and its index entries.`;
      }

      case "start_index": {
        requireWrite();
        const accepted = await ask({
          messageKey: "arcana_chat.confirm_index",
          messageValues: { collection: collection.name },
          confirmKey: "arcana_chat.confirm_index_yes",
          danger: false,
        });
        if (!accepted) return "Indexing was cancelled; nothing was started.";
        const jobId = await provider.indexCollection(display);
        changed();
        return `Indexing started${jobId ? ` (job ${jobId})` : ""}. Large documents take longer; use get_index_status to follow the rows.`;
      }

      case "set_file_tags": {
        requireWrite();
        const filename = safeName(args.filename);
        const tags = Array.isArray(args.tags)
          ? args.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [];
        const files = await listFiles();
        if (!findFile(files, filename)) {
          return `No file named "${filename}" exists, so no tags were changed.`;
        }
        const accepted = await ask({
          messageKey: "arcana_chat.confirm_tags",
          messageValues: {
            name: filename,
            tags: tags.length ? tags.join(", ") : "—",
          },
          confirmKey: "arcana_chat.confirm_tags_yes",
          danger: false,
        });
        if (!accepted) return "The tag change was cancelled; nothing changed.";
        await provider.setFileTags(display, filename, tags);
        changed();
        return `Set the tags of "${filename}" to: ${tags.length ? tags.join(", ") : "(none)"}.`;
      }

      default:
        throw new Error(`Unknown Arcana tool: ${name}`);
    }
  };
}
