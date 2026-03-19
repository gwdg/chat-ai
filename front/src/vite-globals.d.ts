import type { FrontConfig } from "../../secrets/front.config";

declare global {
	const __MODELS_ENDPOINT__: FrontConfig["modelsPath"];
	const __BACKEND_ENDPOINT__: FrontConfig["backendPath"];
	const __USERDATA_ENDPOINT__: FrontConfig["userDataPath"];
	const __DEFAULT_SETTINGS__: FrontConfig["default"];
	const __TITLE_GENERATION_MODEL__: FrontConfig["titleGenerationModel"];
	const __MEMORY_GENERATION_MODEL__: FrontConfig["memoryGenerationModel"];
	const __PROPOSAL_GENERATION_MODEL__: FrontConfig["proposalGenerationModel"];
	const __ANNOUNCEMENT__: FrontConfig["announcement"];
	const __MODULE_TOOLS__: FrontConfig["modules"]["tools"];
	const __MODULE_FEEDBACK__: FrontConfig["modules"]["feedback"];
	const __MODULE_CHOICES__: FrontConfig["modules"]["choices"];
}

export {};