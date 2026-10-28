// A small Markdown subset to .docx, for the create_docx tool.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

/** **bold**, *italic* / _italic_ and `code` spans. */
function runs(line: string): TextRun[] {
  const out: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > last) out.push(new TextRun(line.slice(last, match.index)));
    const token = match[0];
    if (token.startsWith("**")) out.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    else if (token.startsWith("`")) out.push(new TextRun({ text: token.slice(1, -1), font: "Consolas" }));
    else out.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    last = match.index + token.length;
  }
  if (last < line.length) out.push(new TextRun(line.slice(last)));
  return out;
}

export async function markdownToDocx(markdown: string, title?: string): Promise<Uint8Array> {
  const paragraphs: Paragraph[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) paragraphs.push(new Paragraph({ children: runs(paragraph.join(" ")) }));
    paragraph = [];
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      paragraphs.push(new Paragraph({ heading: HEADINGS[heading[1].length - 1], children: runs(heading[2]) }));
    } else if (bullet) {
      flush();
      paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: runs(bullet[1]) }));
    } else if (numbered) {
      flush();
      paragraphs.push(new Paragraph({ numbering: { reference: "numbered", level: 0 }, children: runs(numbered[1]) }));
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();

  const doc = new Document({
    title,
    numbering: {
      config: [{ reference: "numbered", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }],
    },
    sections: [{ children: paragraphs }],
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
