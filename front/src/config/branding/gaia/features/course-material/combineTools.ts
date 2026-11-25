// Merges the tool contributions of one brand feature into the single
// `{ definitions, run }` shape `config/brandFeatures.js` expects.

type Contribution = {
  definitions?: Array<{ function?: { name?: string } }>;
  run: (name: string, args?: Record<string, unknown>) => unknown;
};

type Combined = {
  definitions: NonNullable<Contribution["definitions"]>;
  run: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
};

export function combineTools(
  ...contributions: Array<Contribution | null | undefined>
): Combined | null {
  const runners = new Map<
    string,
    (args?: Record<string, unknown>) => unknown
  >();
  const definitions: NonNullable<Contribution["definitions"]> = [];

  for (const contribution of contributions) {
    if (!contribution) continue;
    for (const definition of contribution.definitions || []) {
      const name = definition?.function?.name;
      if (!name || runners.has(name)) continue;
      runners.set(name, (args) => contribution.run(name, args));
      definitions.push(definition);
    }
  }

  if (definitions.length === 0) return null;
  return {
    definitions,
    run: async (name, args) => {
      const runner = runners.get(name);
      if (!runner) throw new Error(`Unknown tool: ${name}`);
      return runner(args);
    },
  };
}
