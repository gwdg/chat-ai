import type { FileProvider, ProviderEntry } from "./providers/types";

/** Provider listings are paginated (Arcana, MCP); read every page up to the same safety cap. */
export async function listAllEntries(
  provider: Pick<FileProvider, "list">,
  path: string,
): Promise<ProviderEntry[]> {
  const entries: ProviderEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const result = await provider.list(path, cursor);
    entries.push(...result.entries);
    cursor = result.next;
    if (!cursor) break;
  }
  return entries;
}
