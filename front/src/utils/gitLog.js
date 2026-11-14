export const GIT_LOG_MARKER = "CHATAI_GIT_LOG";

export const isInternalGitLogCommand = (value) => {
  const command =
    typeof value === "string" ? value : String(value?.command ?? "");
  return command.includes(GIT_LOG_MARKER);
};

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
