export interface BaseModelInfo {
  id: string;
  object: "model";
  input: string[];
  output: string[];
  owned_by: string;
  name: string;
  demand: number;
  status: "ready" | "offline";
  created: number;
};

export interface ExtendedModelInfo extends BaseModelInfo {
  releaseDate: string;
  company: string;
  modelFamily: string;
  contextLength: string;
  numParameters: string;
  description: string;
  external: boolean;
};

export type ModelInfo = BaseModelInfo | ExtendedModelInfo;