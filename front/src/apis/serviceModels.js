// Entries the SAIA engine may list in `/v1/models` that are not chat models.
//
// `saia-fs` is the account filesystem: an MCP server, not a model. When it was
// still registered in the engine it appeared in `/v1/models` for every user
// granted its access group, so it has to stay out of the model selector even if
// an old deployment still lists it.
//
// `saia-agent` is different: it answers `/chat/completions` like any other
// model (including the tunnel deployment), so it belongs in the selector and is
// deliberately not filtered here. `AGENT_SERVICE_MODEL` stays exported because
// `apis/agentService.js` and `hooks/useAgentServiceAccess` use the id.
//
// `saia-fs` availability is a real health probe (`apis/saiaFs.js`), not a model
// list lookup.

export const AGENT_SERVICE_MODEL = "saia-agent";
export const SAIA_FS_SERVICE_MODEL = "saia-fs";

export const SERVICE_MODEL_IDS = new Set([SAIA_FS_SERVICE_MODEL]);

export const isServiceModel = (model) => SERVICE_MODEL_IDS.has(model?.id);

/** The chat model list: everything the engine lists, minus its services. */
export const withoutServiceModels = (models) =>
  Array.isArray(models)
    ? models.filter((model) => !isServiceModel(model))
    : models;
