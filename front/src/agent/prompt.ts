import { SKILL_EXPLAIN_IMAGE } from "./tools";
import type { WorkspaceRow } from "../db/dbTypes";

export const DEFAULT_WORKSPACE_PERSONA =
  "You are a careful, practical collaborator. Be concise, explain decisions, and keep the user's files tidy.";

export function buildWorkspaceInstructions(
  workspace: Pick<WorkspaceRow, "name" | "rootPath">,
  skills: string[],
): string {
  const lines = [
    `You are the local agent of the workspace "${workspace.name}".`,
    `Your working directory is "${workspace.rootPath}" in a browser-local virtual file system.`,
    "",
    "Rules:",
    "- Use the file tools to inspect and change the workspace. Paths are relative to the workspace root.",
    "- Never use '..' or absolute host paths. You can only see this workspace's folder.",
    "- List the files first when you are unsure what exists.",
    "- Prefer small, focused edits. Do not overwrite a file you have not read unless the user asked you to.",
    "- The virtual file system is the only filesystem available. There is no shell and no network command runner.",
    "- When you create or change files, mention the paths in your final answer.",
  ];
  if (skills.includes(SKILL_EXPLAIN_IMAGE)) {
    lines.push(
      "- The explain_image skill is enabled. Use the explain_image tool to read or describe images; read_file only works for text.",
    );
  }
  return lines.join("\n");
}

export function createInitialWorkspaceSystemMessage(
  workspace: Pick<WorkspaceRow, "name" | "rootPath" | "skills" | "settings">,
) {
  const persona = (workspace.settings?.system_prompt ?? "").trim() || DEFAULT_WORKSPACE_PERSONA;
  return {
    role: "system" as const,
    content: buildWorkspaceInstructions(workspace, workspace.skills ?? []),
    sections: { persona },
    timestamp: 0,
  };
}

export function createPersonaUpdateMessage(persona: string) {
  return {
    role: "system" as const,
    content: "",
    sections: { persona },
    timestamp: Date.now(),
  };
}
