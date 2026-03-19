import type { FrontConfig } from "../../secrets/front.config";

export const MODELS_ENDPOINT: FrontConfig["modelsPath"] = __MODELS_ENDPOINT__;
export const BACKEND_ENDPOINT: FrontConfig["backendPath"] = __BACKEND_ENDPOINT__;
export const USERDATA_ENDPOINT: FrontConfig["userDataPath"] = __USERDATA_ENDPOINT__;
export const DEFAULT_SETTINGS: FrontConfig["default"] = __DEFAULT_SETTINGS__;
export const TITLE_GENERATION_MODEL: FrontConfig["titleGenerationModel"] = __TITLE_GENERATION_MODEL__;
export const MEMORY_GENERATION_MODEL: FrontConfig["memoryGenerationModel"] = __MEMORY_GENERATION_MODEL__;
export const PROPOSAL_GENERATION_MODEL: FrontConfig["proposalGenerationModel"] = __PROPOSAL_GENERATION_MODEL__;
export const ANNOUNCEMENT: FrontConfig["announcement"] = __ANNOUNCEMENT__;

export const MODULE_TOOLS: FrontConfig["modules"]["tools"] = __MODULE_TOOLS__;
export const MODULE_FEEDBACK: FrontConfig["modules"]["feedback"] = __MODULE_FEEDBACK__;
export const MODULE_CHOICES: FrontConfig["modules"]["choices"] = __MODULE_CHOICES__;