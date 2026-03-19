export type FrontMode = "prod" | "dev" | string;

export interface FrontModulesConfig {
  tools: boolean;
  feedback: boolean;
  choices: boolean;
}

export interface FrontDefaultModel {
  id: string;
  name?: string;
}

export interface FrontDefaultMessage {
  role: "system" | "user" | "assistant" | "info";
  content: string;
}

export interface FrontDefaultToolsConfig {
  web_search: boolean;
  image_generation: boolean;
  image_modification: boolean;
  audio_generation: boolean;
  video_generation: boolean;
  arcana: boolean;
  mcp: boolean;
}

export interface FrontDefaultSettings {
  model: FrontDefaultModel;
  messages: FrontDefaultMessage[];
  top_p: number;
  temperature: number;
  enable_tools: boolean;
  tools: FrontDefaultToolsConfig;
}

export interface FrontOverrides {
    ui?: {
        hideFooter?: boolean;
        hideImportConversationButton?: boolean;
        hideImportPersonaButton?: boolean;
    };
    features?: {
    };
    models?: {
    };
    branding?: "gwdg" | "mpg";
}

export interface FrontConfig {
  mode: FrontMode;
  port: number;
  backendPath: string;
  modelsPath: string;
  userDataPath: string;
  titleGenerationModel: string;
  memoryGenerationModel: string;
  proposalGenerationModel: string;
  modules: FrontModulesConfig;
  default: FrontDefaultSettings;
  announcement: string;
  overrides?: FrontOverrides;
}