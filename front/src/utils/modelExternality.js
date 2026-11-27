/**
 * Whether a model is marked external, i.e. its requests may send user data
 * outside the institution.
 *
 * This is the one reader for that label: the data-safety warning (header and
 * prompt box), the model-selector scope filter, the brand policy and the Arcana
 * settings all use it, so they cannot disagree.
 *
 * The deployment reports it as data (`external` in `/models`), because
 * "(External)" in the display name is a routing and accounting label that a
 * client must not parse. The field is derived from the description marker the
 * bridge copies from each upstream model, so a bridge that fronts in-house
 * models does not mark those external. A deployment without the field (an older
 * engine, a plain OpenAI-compatible endpoint) falls back to the marker in the
 * name, which is where the field came from.
 *
 * An explicit `external: false` wins over a name that still carries the marker:
 * the engine only answers `false` for a model it does not consider external, so
 * an administrator who cleaned up the display name must not be re-marked by
 * this client.
 */
export function isExternalModel(model) {
  if (!model || typeof model !== "object") return false;
  if (model.external === true) return true;
  if (model.external === false) return false;
  return (
    typeof model.name === "string" &&
    model.name.toLowerCase().includes("external")
  );
}
