// The tag lists saia-rag takes, built from what a model or a caller spelled out.
//
// The service's filter is an AND over distinct tags, so a repeated tag would
// only narrow the same set again. A model may also send one comma-separated
// string instead of an array, because both spellings are common in tool calls.

/**
 * The tags a caller named: trimmed, non-empty, without case duplicates.
 *
 * Anything that is neither a list nor a string yields no tags, so an absent or
 * malformed argument means "no filter" rather than an error.
 */
export const normalizeTagList = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    const tag = String(entry ?? "").trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
};
