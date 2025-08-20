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
  extended: false;
};

export interface ExtendedModelInfo extends Omit<BaseModelInfo, 'extended'> {
  extended: true;
  releaseDate: string;
  company: string;
  modelFamily: string;
  contextLength: string;
  numParameters: string;
  description: string;
};

export type ModelInfo = BaseModelInfo | ExtendedModelInfo;