import getModelDefaults from "../config/getModelDefaults";

// Generic modalities that mean the model can accept any binary document
// directly instead of requiring it to be converted to text first.
const GENERIC_BINARY_CAPABILITIES = new Set([
  "file",
  "files",
  "binary",
  "document",
  "documents",
]);

const FILE_TYPE_CAPABILITIES = {
  pdf: ["pdf"],
  docx: ["docx", "word", "wordprocessingml"],
};

const GENERIC_FLAGS = [
  "supports_binary",
  "supportsBinary",
  "supports_binary_data",
  "supportsBinaryData",
  "supports_binary_input",
  "supportsBinaryInput",
  "supports_file_input",
  "supportsFileInput",
];

const DEFAULT_GENERIC_FLAGS = [
  "supports_binary",
  "supports_binary_data",
  "supports_binary_input",
  "supports_file_input",
];

export const BINARY_DOCUMENT_TYPES = ["pdf", "docx"];

function capabilityValues(model) {
  if (!model || typeof model !== "object") return [];
  return [
    ...(Array.isArray(model.input) ? model.input : []),
    ...(Array.isArray(model.capabilities) ? model.capabilities : []),
  ].map((value) => String(value).toLowerCase());
}

function hasGenericFlag(model) {
  if (model && typeof model === "object") {
    if (GENERIC_FLAGS.some((flag) => model[flag] === true)) return true;
  }
  const id = typeof model === "string" ? model : model?.id;
  const defaults = id ? getModelDefaults(id) : undefined;
  return DEFAULT_GENERIC_FLAGS.some((flag) => defaults?.[flag] === true);
}

// True when the model advertises any form of binary/file input.
export function modelSupportsBinaryData(model) {
  const values = capabilityValues(model);
  return (
    hasGenericFlag(model) ||
    values.some(
      (value) =>
        GENERIC_BINARY_CAPABILITIES.has(value) ||
        BINARY_DOCUMENT_TYPES.includes(value)
    )
  );
}

// True when the model can accept this specific document type unprocessed.
export function modelSupportsFileType(model, fileType) {
  if (!BINARY_DOCUMENT_TYPES.includes(fileType)) return false;
  const values = capabilityValues(model);
  const specific = FILE_TYPE_CAPABILITIES[fileType] || [];
  return (
    hasGenericFlag(model) ||
    values.some(
      (value) =>
        GENERIC_BINARY_CAPABILITIES.has(value) || specific.includes(value)
    )
  );
}
