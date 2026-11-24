/**
 * Three-way merge for `user_settings`.
 *
 * A settings object is small, but it is not a document: a key changed on one
 * device must follow that device, and a key changed on both must not silently
 * flip a switch. So the merge is per key, with the last agreed payload as the
 * common ancestor.
 *
 * Arrays of records (`memories`, `memory_groups`, `e2ee_keys`, `mcp_servers`)
 * and the `e2ee_models` map are additionally merged by element id. Two devices
 * that add a memory keep both; a memory one device deleted stays deleted unless
 * the other side changed it.
 */

export type MergeResult = { payload: any; conflicts: string[] };

const MERGE_BY_ID = new Set([
  "memories",
  "memory_groups",
  "e2ee_keys",
  "mcp_servers",
]);

const MERGE_BY_KEY = new Set(["e2ee_models"]);

export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (typeof left === "object") {
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const aKeys = Object.keys(a).filter((key) => a[key] !== undefined);
    const bKeys = Object.keys(b).filter((key) => b[key] !== undefined);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]),
    );
  }
  return false;
}

const has = (value: any, key: string) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const clone = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));

const idOf = (value: any): string | null => {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id === "string" && value.id) return value.id;
  if (typeof value.keyId === "string" && value.keyId) return value.keyId;
  return null;
};

/**
 * Three-way merge of two arrays of records that carry an id.
 *
 * The result keeps the local order first, then records only the remote side
 * has. A record changed on one side follows that side; changed on both, the
 * local version wins and the caller reports the conflict.
 */
export function mergeById(
  baseList: any[] | undefined,
  localList: any[] | undefined,
  remoteList: any[] | undefined,
): { list: any[]; conflicts: string[] } {
  const base = new Map<string, any>();
  for (const item of baseList ?? []) {
    const id = idOf(item);
    if (id) base.set(id, item);
  }
  const local = new Map<string, any>();
  for (const item of localList ?? []) {
    const id = idOf(item);
    if (id) local.set(id, item);
  }
  const remote = new Map<string, any>();
  for (const item of remoteList ?? []) {
    const id = idOf(item);
    if (id) remote.set(id, item);
  }

  const conflicts: string[] = [];
  const order: string[] = [];
  for (const id of local.keys()) order.push(id);
  for (const id of remote.keys()) if (!local.has(id)) order.push(id);

  const out: any[] = [];
  for (const id of order) {
    const l = local.get(id);
    const r = remote.get(id);
    const b = base.get(id);
    if (l !== undefined && r !== undefined) {
      if (deepEqual(l, r)) {
        out.push(l);
        continue;
      }
      if (b !== undefined && deepEqual(l, b)) {
        out.push(r);
        continue;
      }
      if (b !== undefined && deepEqual(r, b)) {
        out.push(l);
        continue;
      }
      // Changed on both sides (or introduced independently): keep the local one.
      conflicts.push(id);
      out.push(l);
      continue;
    }
    if (l !== undefined) {
      // Present here, absent remotely: a remote deletion, unless local changed.
      if (b !== undefined && deepEqual(l, b)) continue;
      if (b !== undefined) conflicts.push(id);
      out.push(l);
      continue;
    }
    if (r !== undefined) {
      // Absent here: deleted locally, unless remote changed since the base.
      if (b !== undefined && deepEqual(r, b)) continue;
      if (b !== undefined) conflicts.push(id);
      out.push(r);
    }
  }
  return { list: out, conflicts };
}

/** Three-way merge of a `{ id: value }` map such as `e2ee_models`. */
function mergeByKey(
  baseMap: any,
  localMap: any,
  remoteMap: any,
): { value: Record<string, any>; conflicts: string[] } {
  const keys = new Set<string>([
    ...Object.keys(localMap ?? {}),
    ...Object.keys(remoteMap ?? {}),
    ...Object.keys(baseMap ?? {}),
  ]);
  const value: Record<string, any> = {};
  const conflicts: string[] = [];
  for (const key of [...keys].sort()) {
    const l = localMap?.[key];
    const r = remoteMap?.[key];
    const b = baseMap?.[key];
    if (l !== undefined && r !== undefined) {
      if (deepEqual(l, r)) value[key] = l;
      else if (b !== undefined && deepEqual(l, b)) value[key] = r;
      else if (b !== undefined && deepEqual(r, b)) value[key] = l;
      else {
        conflicts.push(key);
        value[key] = l;
      }
      continue;
    }
    if (l !== undefined) {
      if (b !== undefined && deepEqual(l, b)) continue;
      value[key] = l;
      continue;
    }
    if (r !== undefined) {
      if (b !== undefined && deepEqual(r, b)) continue;
      value[key] = r;
    }
  }
  return { value, conflicts };
}

/**
 * Merge `local` and `remote` settings against the last agreed `base`.
 *
 * `conflicts` names the keys that changed on both sides; the local value was
 * kept for those, so the UI can report "N settings kept from this device".
 */
export function mergeSettings(
  base: any,
  local: any,
  remote: any,
): MergeResult {
  const keys = new Set<string>([
    ...Object.keys(local ?? {}),
    ...Object.keys(remote ?? {}),
    ...Object.keys(base ?? {}),
  ]);
  const payload: Record<string, any> = {};
  const conflicts: string[] = [];

  for (const key of [...keys].sort()) {
    const l = local?.[key];
    const r = remote?.[key];
    const b = base?.[key];

    if (MERGE_BY_ID.has(key)) {
      const merged = mergeById(
        Array.isArray(b) ? b : undefined,
        Array.isArray(l) ? l : undefined,
        Array.isArray(r) ? r : undefined,
      );
      payload[key] = merged.list;
      for (const id of merged.conflicts) conflicts.push(`${key}.${id}`);
      continue;
    }

    if (MERGE_BY_KEY.has(key)) {
      const merged = mergeByKey(b, l, r);
      payload[key] = merged.value;
      for (const id of merged.conflicts) conflicts.push(`${key}.${id}`);
      continue;
    }

    if (deepEqual(l, r)) {
      if (has(local, key)) payload[key] = clone(l);
      continue;
    }

    const baseHas = has(base, key);
    if (baseHas && deepEqual(l, b)) {
      if (has(remote, key)) payload[key] = clone(r);
      continue;
    }
    if (baseHas && deepEqual(r, b)) {
      if (has(local, key)) payload[key] = clone(l);
      continue;
    }

    if (!has(local, key)) {
      // Deleted here, changed (or added) there: adding it back loses less than
      // dropping the other device's value.
      if (has(remote, key)) payload[key] = clone(r);
      conflicts.push(key);
      continue;
    }
    if (!has(remote, key)) {
      // Removed there, changed here: the local edit wins.
      payload[key] = clone(l);
      conflicts.push(key);
      continue;
    }
    // Changed on both sides: keep the local value so no switch flips silently.
    payload[key] = clone(l);
    conflicts.push(key);
  }

  return { payload, conflicts };
}
