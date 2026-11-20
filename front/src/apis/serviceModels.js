// Services that the SAIA engine lists like a model.
//
// A service is registered in the engine as a model inside an access group, so
// `/v1/models` returns it for every user who was granted that group. That list
// is how the app learns whether a service is available, but a service is not a
// chat model: `saia-agent` is the OpenCode agent service and `saia-fs` is the
// account filesystem. Neither belongs in the model selector, and no chat may
// send a completion to one.
//
// Read availability from the unfiltered list (`hooks/useAgentServiceAccess`,
// `hooks/useSaiaFsAccess`) and filter it only where models are offered.

export const AGENT_SERVICE_MODEL = "saia-agent";
export const SAIA_FS_SERVICE_MODEL = "saia-fs";

export const SERVICE_MODEL_IDS = new Set([
  AGENT_SERVICE_MODEL,
  SAIA_FS_SERVICE_MODEL,
]);

export const isServiceModel = (model) => SERVICE_MODEL_IDS.has(model?.id);

/** The chat model list: everything the engine lists, minus its services. */
export const withoutServiceModels = (models) =>
  Array.isArray(models)
    ? models.filter((model) => !isServiceModel(model))
    : models;
