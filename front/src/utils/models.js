export function compareModelsByName(a, b) {
  const aName = a?.name || a?.id || "";
  const bName = b?.name || b?.id || "";

  const nameComparison = aName.localeCompare(bName, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return (a?.id || "").localeCompare(b?.id || "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortModelsByName(models = []) {
  return [...models].sort(compareModelsByName);
}

export function matchesModelSearch(model, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    model?.name,
    model?.id,
    model?.owned_by,
    ...(model?.input || []),
    ...(model?.output || []),
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}
