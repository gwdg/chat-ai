import type { WorkspaceCapabilities, WorkspaceFileEntry } from "../db/dbTypes";
import { baseName, isWithinPath, joinPath, normalizePath } from "./paths";

export type TransferStrategy = "move" | "copy";
export type TransferIntent = "auto" | "move" | "copy";

export type TransferPlanInput = {
  intent: TransferIntent;
  alt?: boolean;
  sameSource: boolean;
  sourceKind: string;
  targetKind: string;
  entries: WorkspaceFileEntry[];
  sourcePath: string;
  targetPath: string;
  sourceCapabilities: WorkspaceCapabilities;
  targetCapabilities: WorkspaceCapabilities;
  freeBytes?: number | null;
  existingNames?: Set<string>;
};

export type TransferPlan = {
  strategy: TransferStrategy;
  itemCount: number;
  totalBytes: number;
  requiresConfirmation: boolean;
  requiresDelete: boolean;
  blocked: boolean;
  warnings: string[];
};

export function planTransfer(input: TransferPlanInput): TransferPlan {
  const warnings: string[] = [];
  let blocked = false;

  const explicitMove = input.intent === "move";
  const explicitCopy = input.intent === "copy";
  const sameSource = input.sameSource;
  const strategy: TransferStrategy = explicitMove
    ? "move"
    : explicitCopy
      ? "copy"
      : sameSource
        ? input.alt
          ? "copy"
          : "move"
        : input.alt
          ? "move"
          : "copy";

  if (
    strategy === "move" &&
    !input.sourceCapabilities.delete &&
    !sameSource
  ) {
    warnings.push("The source is read-only; the original cannot be deleted.");
    blocked = true;
  }

  if (!input.targetCapabilities.write) {
    warnings.push("The target is read-only.");
    blocked = true;
  }

  if (
    input.sourcePath &&
    input.targetPath &&
    isWithinPath(input.targetPath, input.sourcePath) &&
    normalizePath(input.targetPath) !== normalizePath(input.sourcePath)
  ) {
    warnings.push("A folder cannot be moved into its own descendant.");
    blocked = true;
  }

  const existing = input.existingNames ?? new Set<string>();
  const conflicts = input.entries.filter((entry) => existing.has(entry.name));
  if (conflicts.length) {
    warnings.push(
      conflicts.length === 1
        ? `"${conflicts[0].name}" already exists at the destination.`
        : `${conflicts.length} items already exist at the destination.`,
    );
  }

  const totalBytes = input.entries.reduce(
    (sum, entry) => sum + (entry.kind === "file" ? entry.size ?? 0 : 0),
    0,
  );
  if (
    totalBytes > 0 &&
    typeof input.freeBytes === "number" &&
    totalBytes > input.freeBytes
  ) {
    warnings.push("There is not enough free space at the destination.");
    blocked = true;
  }

  const requiresConfirmation =
    explicitMove ||
    (strategy === "move" && !sameSource) ||
    conflicts.length > 0;

  return {
    strategy,
    itemCount: input.entries.length,
    totalBytes,
    requiresConfirmation,
    requiresDelete: strategy === "move",
    blocked,
    warnings,
  };
}

export const transferTargetPath = (
  targetDir: string,
  entry: WorkspaceFileEntry,
): string => joinPath(targetDir, entry.name || baseName(entry.path));
