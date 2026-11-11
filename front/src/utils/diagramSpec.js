const VEGA_MARK_TYPES = ["mark", "layer", "facet", "hconcat", "vconcat", "repeat", "spec"];

export const detectJsonDiagram = (content) => {
  let spec;
  try {
    spec = JSON.parse(content);
  } catch {
    return null;
  }
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return null;

  const schema = typeof spec.$schema === "string" ? spec.$schema.toLowerCase() : "";
  if (schema.includes("vega-lite")) return { type: "vega", language: "vega-lite" };
  if (schema.includes("vega")) return { type: "vega", language: "vega" };

  if (
    typeof spec.type === "string" &&
    spec.data &&
    Array.isArray(spec.data.datasets)
  ) {
    return { type: "chartjs", language: "chartjs" };
  }

  if (VEGA_MARK_TYPES.some((key) => key in spec)) {
    return { type: "vega", language: "vega-lite" };
  }

  return null;
};
