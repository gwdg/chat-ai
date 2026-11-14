export const GIT_LOG_MARKER = "CHATAI_GIT_LOG";
export const FILE_STAT_MARKER = "CHATAI_FILE_STAT";

const INTERNAL_SHELL_MARKERS = [GIT_LOG_MARKER, FILE_STAT_MARKER];

export const isInternalShellCommand = (value) => {
  const command =
    typeof value === "string" ? value : String(value?.command ?? "");
  return INTERNAL_SHELL_MARKERS.some((marker) => command.includes(marker));
};

export const isInternalGitLogCommand = isInternalShellCommand;

export const formatGitLog = (raw) =>
  raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [meta, message = ""] = line.split("\t");
      const match = meta.match(
        /^[0-9a-f]+ ([0-9a-f]+) (.*) <([^>]*)> (\d+) ([+-]\d{4})$/,
      );
      if (!match) return line;
      const [, hash, author, , timestamp] = match;
      const date = new Date(Number(timestamp) * 1000).toLocaleString();
      const label = message.replace(/^commit(?: \([^)]*\))?:\s*/, "");
      return [
        `━━━ ${hash.slice(0, 8)} ━━━`,
        `Date:   ${date}`,
        `Author: ${author}`,
        "",
        `    ${label}`,
      ].join("\n");
    })
    .reverse()
    .join("\n\n");
