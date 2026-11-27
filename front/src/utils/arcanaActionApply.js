// Applies and reverts the Arcana chat's approved changes.
//
// The approval card imports this module only when the user clicks Accept or
// Revert, so neither the saia-rag provider nor the MCP SDK it runs on is part of
// the entry chunk. `arcanaActions.js` builds and validates the action objects;
// this file only performs them, and it is the single place that can write to a
// collection from the chat.
import { loadFile } from "../db";
import {
  ARCANA_FILES_CHANGED_EVENT,
  arcanasProvider,
} from "../workspace/arcanas";
import { arcanaActionKey } from "./arcanaActions";

/** One-shot byte stream for `provider.write`. */
const streamOf = (bytes) =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

const announce = (collection) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ARCANA_FILES_CHANGED_EVENT, {
      detail: { collection },
    }),
  );
};

const writeText = async (provider, collection, filename, text) => {
  const bytes = new TextEncoder().encode(text);
  await provider.write(
    `/${collection}/${filename}`,
    streamOf(bytes),
    { size: bytes.byteLength, overwrite: true },
  );
};

const removeIfPresent = async (provider, collection, filename) => {
  const files = await provider.listFiles(collection, { includeTags: false });
  const rows = Array.isArray(files) ? files : [];
  if (!rows.some((file) => file.name === filename)) return;
  await provider.removeFile(collection, filename);
};

const applyOne = async (provider, action) => {
  const collection = action.collection;

  switch (action.op) {
    case "upload_attachment": {
      const file = await loadFile(action.fileId);
      if (!file) {
        throw new Error(
          `The attachment "${action.filename}" is no longer in this tab.`,
        );
      }
      await provider.uploadFile(collection, file);
      return;
    }

    case "write_text_file":
      await writeText(provider, collection, action.filename, action.content);
      return;

    case "delete_file":
      // Deleting a file that is already gone is the state the proposal wanted,
      // so a retried Accept (after one item of a batch failed) succeeds.
      await removeIfPresent(provider, collection, action.filename);
      return;

    case "start_index":
      await provider.indexCollection(collection);
      return;

    case "set_file_tags":
      await provider.setFileTags(collection, action.filename, action.tags);
      return;

    default:
      throw new Error(`Unknown Arcana action: ${action.op}`);
  }
};

const revertOne = async (provider, action) => {
  const collection = action.collection;

  switch (action.op) {
    case "upload_attachment":
      if (action.existed !== true) {
        await removeIfPresent(provider, collection, action.filename);
      }
      return;

    case "write_text_file":
      if (action.existed === true && typeof action.previousText === "string") {
        await writeText(
          provider,
          collection,
          action.filename,
          action.previousText,
        );
      } else {
        await removeIfPresent(provider, collection, action.filename);
      }
      return;

    case "delete_file":
      if (typeof action.restoreText === "string") {
        await writeText(
          provider,
          collection,
          action.filename,
          action.restoreText,
        );
      }
      return;

    case "set_file_tags":
      await provider.setFileTags(
        collection,
        action.filename,
        action.previousTags ?? [],
      );
      return;

    case "start_index":
      // Indexing is not a document change and cannot be undone.
      return;

    default:
      throw new Error(`Unknown Arcana action: ${action.op}`);
  }
};

const runBatch = async (actions, perform, { reverse = false } = {}) => {
  const provider = arcanasProvider();
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const ordered = reverse ? [...list].reverse() : list;
  const applied = [];
  const failures = [];
  const changed = new Set();

  for (const action of ordered) {
    try {
      await perform(provider, action);
      applied.push(arcanaActionKey(action));
      changed.add(action.collection);
    } catch (error) {
      failures.push({
        action,
        reason: error?.message || String(error),
      });
    }
  }

  for (const collection of changed) announce(collection);

  return { applied, failures };
};

/** Perform every action; one failing item does not stop the rest. */
export function applyArcanaActions(actions) {
  return runBatch(actions, applyOne);
}

/** Undo what the actions captured, latest first. */
export function revertArcanaActions(actions) {
  return runBatch(actions, revertOne, { reverse: true });
}
