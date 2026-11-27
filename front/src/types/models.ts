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
  /**
   * Whether requests to this model may send user data outside the institution.
   * Reported by the SAIA engine; absent on a plain OpenAI-compatible endpoint,
   * where the caller falls back to the "(External)" name marker
   * (utils/modelExternality.js).
   */
  external?: boolean;
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