// Resolves the "applies to models" list typed next to an imported key.
//
// The field accepts model ids (exact) and display names (case-insensitive), so a
// user can type "qwen3-235b-a22b, Mistral Large" without looking up ids.
// Unknown tokens are reported instead of silently dropped, and a display name
// shared by several models binds all of them.

/** Splits on commas, semicolons and newlines and trims each entry. */
export function parseModelTokens(value) {
  return String(value ?? "")
    .split(/[,\n;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * @returns {{matched: object[], unknown: string[]}} models in input order,
 *   deduplicated by id, plus the tokens that matched nothing.
 */
export function resolveModelTokens(models, tokens) {
  const list = Array.isArray(models) ? models : [];
  const matched = [];
  const unknown = [];
  const seen = new Set();

  for (const token of tokens || []) {
    if (!token) continue;
    const exact = list.find((model) => model?.id === token);
    const byName = exact
      ? []
      : list.filter(
          (model) =>
            String(model?.name ?? "").toLowerCase() === token.toLowerCase(),
        );
    const found = exact ? [exact] : byName;
    if (!found.length) {
      unknown.push(token);
      continue;
    }
    for (const model of found) {
      if (!model?.id || seen.has(model.id)) continue;
      seen.add(model.id);
      matched.push(model);
    }
  }

  return { matched, unknown };
}

/** A key label derived from the models it applies to, or "" when it has none. */
export function modelKeyName(matched) {
  return (matched || [])
    .map((model) => model?.name || model?.id || "")
    .filter(Boolean)
    .join(", ");
}
