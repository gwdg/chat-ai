// parseReferences.js
// SUPER SIMPLE: parse only the section after the explicit References delimiter.
// Keep every [RREFn] in order, from its tag up to (but not including) the next [RREFm] tag.

const extractTitleFromReferenceLine = (line, rrefNumber, url) => {
  let title = (line || "").replace(/\s*\[RREF\d+\]\s*/i, "").trim();

  // [Title](url) -> Title
  const md = title.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (md) return md[1].trim();

  // <a href="...">Title</a> -> Title
  const html = title.match(/<a[^>]*>([^<]+)<\/a>/i);
  if (html) return html[1].trim();

  // Strip plain URLs on edges + similarity scores
  title = title
    .replace(/^(https?:\/{1,2}\S+)\s*/i, "")
    .replace(/\s*(https?:\/{1,2}\S+)$/i, "")
    .replace(/[\(\[\{]\s*\d+\.\d+\s*[\)\]\}]\s*$/i, "")
    .trim();

  if (!title || /^https?:\/{1,2}/i.test(title) || title.length < 3) {
    if (url) {
      try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        const last = parts[parts.length - 1] || u.hostname;
        const candidate = last
          .replace(/\.(md|html?|php|jsp|asp)$/i, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
        return candidate.length >= 3
          ? candidate
          : u.hostname.replace(/^www\./, "");
      } catch {
        /* ignore bad URL */
      }
    }
    return `Reference ${rrefNumber}`;
  }
  return title;
};

export const parseReferences = (content) => {
  if (!content || typeof content !== "string") return [];

  // We assume `content` is ONLY the references section (everything after the delimiter).
  // Find every [RREFn] in order and slice blocks between them.
  const tagRe = /\[RREF(\d+)\]/gi;
  const matches = [];
  let m;

  while ((m = tagRe.exec(content)) !== null) {
    matches.push({ rrefNumber: parseInt(m[1], 10), index: m.index });
    if (m.index === tagRe.lastIndex) tagRe.lastIndex++;
  }

  if (matches.length === 0) return [];

  const refs = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const start = cur.index;
    const end = next ? next.index : content.length;

    const block = content.slice(start, end).trim();
    const lines = block.split("\n");
    const firstLine = lines[0] || "";

    // URL: prefer markdown link on first line, else any URL in block (:/ or ://)
    let url = null;
    const mdUrl = firstLine.match(/\[([^\]]+)\]\(([^)]+)\)/i);
    if (mdUrl) url = (mdUrl[2] || "").trim();
    if (!url) {
      const anyUrl = block.match(/https?:\/{1,2}\S+/i);
      if (anyUrl) url = (anyUrl[0] || "").trim();
    }

    const title = extractTitleFromReferenceLine(
      firstLine,
      cur.rrefNumber,
      url || ""
    );

    refs.push({
      number: cur.rrefNumber - 1, // zero-based badge if you need it
      rrefNumber: cur.rrefNumber, // the actual RREFn
      title,
      url: url || null,
      content: block, // RAW markdown from [RREFn] ... up to next tag
    });
  }

  // Keep original order; do NOT filter by length; do NOT dedupe.
  return refs;
};
