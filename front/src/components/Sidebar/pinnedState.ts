/**
 * A pinned workspace or agent is rendered twice: once in the top-level pinned
 * section and once in its own sidebar section. Both copies are the same
 * component, so their fold state has to be keyed separately — otherwise folding
 * the row in one place folds its twin in the other.
 *
 * The prefix is applied to the persisted `collapsed_topics` / `expanded_agents`
 * ids of the pinned copy only; the ids of the real section stay unchanged.
 */
export const PINNED_STATE_PREFIX = "__pinned__:";

export const pinnedStateId = (id: string) => `${PINNED_STATE_PREFIX}${id}`;
