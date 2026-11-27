import {
  Document,
  DocumentAudio,
  DocumentBlank,
  DocumentPdf,
  DocumentVideo,
  DocumentWordProcessor,
  Markdown,
} from "@carbon/icons-react";

import { getFileType } from "../../utils/attachments";
import { resolveMimeType } from "../../utils/mime";

const ICONS = {
  pdf: DocumentPdf,
  markdown: Markdown,
  docx: DocumentWordProcessor,
  audio: DocumentAudio,
  video: DocumentVideo,
  text: DocumentBlank,
  code: DocumentBlank,
  csv: DocumentBlank,
  excel: DocumentBlank,
};

/**
 * The Carbon icon that names a file's type.
 *
 * The preview header, the Arcana file list and a source card all name a file, and
 * a Markdown document should look like a Markdown document instead of an unnamed
 * sheet of paper. `type` is the same classification the preview uses to pick a
 * renderer, so the icon and the body cannot disagree. A provider that reports no
 * MIME type (saia-rag, saia-fs, a local folder) is classified from the name.
 */
export function fileTypeIcon(name, mime) {
  const type = getFileType({ name, type: resolveMimeType(name, mime) });
  return { type, Icon: ICONS[type] ?? Document };
}

/** The icon on its own, where the caller does not need the type name. */
export function FileTypeIcon({ name, mime, size = 16, ...rest }) {
  const { Icon } = fileTypeIcon(name, mime);
  return <Icon size={size} {...rest} />;
}
