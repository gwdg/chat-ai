// The agent's tools. pi's own file tools are pointed at the conversation's virtual filesystem
// through their `operations` hooks; the media tools call the chat-ai endpoints from the browser
// and keep every input and output as a file, so the model refers to media by path.
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { minimatch } from "minimatch";
import { createEditTool } from "pi-coding-agent/core/tools/edit.js";
import { createFindTool } from "pi-coding-agent/core/tools/find.js";
import { createLsTool } from "pi-coding-agent/core/tools/ls.js";
import { createReadTool } from "pi-coding-agent/core/tools/read.js";
import { createWriteTool } from "pi-coding-agent/core/tools/write.js";
import { detectSupportedImageMimeType } from "pi-coding-agent/utils/mime.js";
import { Type, type TSchema } from "typebox";
import { convertDocument, editImage, explainImage, generateImage, generateSpeech, transcribeAudio, DEFAULT_VOICE } from "../apis/agentEndpoints";
import { createCodemodeTool } from "./codemode";
import { markdownToDocx } from "./docx";
import { enoent, normalize, type Vfs, walk } from "./vfs";

export const CWD = "/";

const DOCUMENT_EXT = /\.(pdf|docx?|pptx?|xlsx?|odt|odp|ods|rtf|epub|html?)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|opus|m4a|flac|webm)$/i;
const MAX_INLINE_CHARS = 20_000;

const text = (value: string): AgentToolResult<any> => ({ content: [{ type: "text", text: value }], details: undefined });
const baseName = (path: string) => path.split("/").pop() || "file";
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const clip = (value: string) =>
  value.length > MAX_INLINE_CHARS ? `${value.slice(0, MAX_INLINE_CHARS)}\n\n[... truncated, read the file for the rest]` : value;

function tool<T extends TSchema>(
  name: string,
  description: string,
  parameters: T,
  execute: (args: any, signal?: AbortSignal) => Promise<AgentToolResult<any>>,
): AgentTool<T> {
  return { name, label: name, description, parameters, execute: (_id, args, signal) => execute(args, signal) };
}

export interface ToolOptions {
  /** The model can see images: offer image tools whose results it can look at. */
  vision: boolean;
  /** The conversation's tool toggles (`settings.tools`); a missing key counts as on. */
  enabled?: Record<string, boolean>;
}

// Tool toggles in the UI and the agent tools they switch. Reading, listing, searching and the
// converters are always on.
const TOGGLES: Record<string, string[]> = {
  write_access: ["write", "edit"],
  codemode: ["codemode"],
  create_docx: ["create_docx"],
  image_generation: ["generate_image"],
  image_modification: ["edit_image"],
  audio_generation: ["generate_speech"],
};

export function createTools(fs: Vfs, { vision, enabled = {} }: ToolOptions): AgentTool<any>[] {
  const readFile = async (path: string) => Buffer.from(await fs.readFile(path));
  const writeFile = (path: string, content: string) => fs.writeFile(path, content);
  const access = async (path: string) => {
    if (!(await fs.stat(path))) throw enoent(path);
  };
  const exists = async (path: string) => (await fs.stat(path)) !== null;
  const detectImageMimeType = async (path: string) => detectSupportedImageMimeType(await fs.readFile(path)) ?? undefined;

  const read = createReadTool(CWD, { autoResizeImages: false, operations: { readFile, access, detectImageMimeType } });
  // pi's read decodes everything that is not an image as text; point the model at the converters instead.
  const readWithHints: AgentTool<any> = {
    ...read,
    execute: async (id, args, signal, onUpdate) => {
      const path = normalize(args.path ?? "");
      if (DOCUMENT_EXT.test(path) && !/\.html?$/i.test(path)) {
        const converted = `${path}.md`;
        if (await exists(converted)) return text(`${path} is a binary document. Its text is in ${converted}; read that instead.`);
        return text(`${path} is a binary document. Call convert_document on it first.`);
      }
      if (AUDIO_EXT.test(path)) {
        const transcript = `${path}.txt`;
        if (await exists(transcript)) return text(`${path} is audio. Its transcript is in ${transcript}.`);
        return text(`${path} is audio. Call transcribe_audio on it first.`);
      }
      return read.execute(id, args, signal, onUpdate);
    },
  };

  const fileTools: AgentTool<any>[] = [
    readWithHints,
    createWriteTool(CWD, { operations: { writeFile, mkdir: (dir) => fs.mkdir(dir) } }),
    createEditTool(CWD, { operations: { readFile, writeFile, access } }),
    createLsTool(CWD, {
      operations: {
        exists,
        stat: async (path) => {
          const stat = await fs.stat(path);
          if (!stat) throw enoent(path);
          return { isDirectory: () => stat.dir };
        },
        readdir: async (path) => (await fs.readdir(path)).map((entry) => entry.name),
      },
    }),
    createFindTool(CWD, {
      operations: {
        exists,
        glob: async (pattern, cwd, { ignore, limit }) => {
          const base = cwd === "/" ? "" : cwd;
          // Like fd, a pattern without a slash matches the file name at any depth.
          const options = { dot: true, matchBase: !pattern.includes("/") };
          return (await walk(fs, cwd))
            .map((path) => path.slice(base.length + 1))
            .filter((path) => minimatch(pattern.startsWith("/") ? `${base}/${path}` : path, pattern, options))
            .filter((path) => !ignore.some((skip) => minimatch(`/${path}`, skip, { dot: true })))
            .slice(0, limit);
        },
      },
    }),
  ];

  // A model with vision reads images itself; one without asks the vision model through this tool.
  const explainImageTool = tool(
    "explain_image",
    "Look at an image file (png, jpeg, gif, webp) and return a description. read cannot show you images; use this instead.",
    Type.Object({
      path: Type.String({ description: "Path of the image" }),
      question: Type.Optional(Type.String({ description: "A specific question about the image" })),
    }),
    async ({ path, question }, signal) => {
      path = normalize(path);
      const data = await fs.readFile(path);
      const mimeType = detectSupportedImageMimeType(data);
      if (!mimeType) return text(`${path} is not a supported image.`);
      return text(await explainImage(data, mimeType, question || "Describe this image in detail. Quote any text in it verbatim.", signal));
    },
  );

  const mediaTools: AgentTool<any>[] = [
    ...(vision ? [] : [explainImageTool]),
    tool(
      "convert_document",
      "Convert a document (PDF, DOCX, PPTX, XLSX, ...) to Markdown. The result is written next to it as <path>.md and returned.",
      Type.Object({ path: Type.String({ description: "Path of the document" }) }),
      async ({ path }, signal) => {
        path = normalize(path);
        const markdown = await convertDocument(await fs.readFile(path), baseName(path), signal);
        await fs.writeFile(`${path}.md`, markdown);
        return text(`Wrote ${path}.md\n\n${clip(markdown)}`);
      },
    ),
    tool(
      "transcribe_audio",
      "Transcribe an audio file (wav, mp3, ...) to text. The transcript is written next to it as <path>.txt and returned.",
      Type.Object({ path: Type.String({ description: "Path of the audio file" }) }),
      async ({ path }, signal) => {
        path = normalize(path);
        const transcript = await transcribeAudio(await fs.readFile(path), baseName(path), signal);
        await fs.writeFile(`${path}.txt`, transcript);
        return text(`Wrote ${path}.txt\n\n${clip(transcript)}`);
      },
    ),
    tool(
      "generate_speech",
      "Turn text into spoken audio (mp3). The file is shown to the user.",
      Type.Object({
        text: Type.String({ description: "What to say" }),
        voice: Type.Optional(Type.String({ description: `Kokoro voice id, default ${DEFAULT_VOICE}` })),
        path: Type.Optional(Type.String({ description: "Output path ending in .mp3; default /generated/speech-<time>.mp3" })),
      }),
      async (args, signal) => {
        const path = normalize(args.path || `/generated/speech-${stamp()}.mp3`);
        await fs.writeFile(path, await generateSpeech(args.text, args.voice || DEFAULT_VOICE, signal));
        return text(`Wrote ${path}`);
      },
    ),
    tool(
      "generate_image",
      "Generate an image (png) from a text prompt. The file is shown to the user.",
      Type.Object({
        prompt: Type.String({ description: "Description of the image" }),
        size: Type.Optional(Type.String({ description: "e.g. 1024x1024" })),
        path: Type.Optional(Type.String({ description: "Output path ending in .png; default /generated/image-<time>.png" })),
      }),
      async (args, signal) => {
        const path = normalize(args.path || `/generated/image-${stamp()}.png`);
        await fs.writeFile(path, await generateImage(args.prompt, args.size, signal));
        return text(`Wrote ${path}${vision ? ". Use read to look at it." : ""}`);
      },
    ),
    tool(
      "edit_image",
      "Change an existing image according to a prompt. The result (png) is shown to the user.",
      Type.Object({
        path: Type.String({ description: "Path of the image to edit" }),
        prompt: Type.String({ description: "What to change" }),
        output_path: Type.Optional(Type.String({ description: "Output path; default <path without extension>-edited.png" })),
      }),
      async (args, signal) => {
        const source = normalize(args.path);
        const path = normalize(args.output_path || `${source.replace(/\.[^./]+$/, "")}-edited.png`);
        await fs.writeFile(path, await editImage(await fs.readFile(source), baseName(source), args.prompt, signal));
        return text(`Wrote ${path}${vision ? ". Use read to look at it." : ""}`);
      },
    ),
    tool(
      "create_docx",
      "Create a Word document (.docx) from Markdown. Supports #-headings, paragraphs, - and 1. lists, **bold**, *italic* and `code`. The file is shown to the user.",
      Type.Object({
        markdown: Type.String({ description: "Content in Markdown" }),
        path: Type.String({ description: "Output path ending in .docx" }),
        title: Type.Optional(Type.String({ description: "Document title (metadata)" })),
      }),
      async (args) => {
        const path = normalize(args.path);
        await fs.writeFile(path, await markdownToDocx(args.markdown, args.title));
        return text(`Wrote ${path}`);
      },
    ),
  ];

  // Writing is opt-in: off unless switched on. The other toggles are on unless switched off.
  const isOff = (key: string) => (key === "write_access" ? enabled[key] !== true : enabled[key] === false);
  const off = new Set(Object.entries(TOGGLES).flatMap(([key, names]) => (isOff(key) ? names : [])));
  const on = (tool: AgentTool<any>) => !off.has(tool.name);
  // Scripts get the same file tools, so they cannot write either when writing is off
  const codemode = createCodemodeTool(fileTools.filter(on));
  return [...fileTools, codemode, ...mediaTools].filter(on);
}
