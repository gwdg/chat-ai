// Opens a cited Arcana document in the docked preview, at the cited page.
//
// The source card only carries the collection reference, the file name and the
// page. Reading the bytes happens here, on the click, so a page full of cards
// costs nothing until one is opened. The file is read through the same provider
// the Arcanas panel uses, which is why the preview shows the original upload
// (the PDF) and not the Markdown the service indexed from it.
import { arcanasProvider, arcanaDisplayName } from "../workspace/arcanas";
import { isTextFileName } from "../workspace/providers/saiaRag";

/**
 * Read `document`'s original file and hand it to the preview.
 *
 * A text file opens as text, so Markdown and CSV get the same renderer they get
 * everywhere else. Everything else is an object URL: a PDF or an image keeps its
 * bytes, and the preview appends the page to the viewer's `#page=` fragment.
 *
 * @param {object} options
 * @param {import("./arcanaDocuments").ArcanaDocument} options.document
 * @param {(request: object) => void} options.openFilePreview
 */
export async function openArcanaDocumentPreview({
  document,
  openFilePreview,
}) {
  const provider = arcanasProvider();
  const collections = await provider.listCollections();
  const collection = collections.find(
    (row) => row.collection === document.collection,
  );
  if (!collection) {
    throw new Error(`Collection not found: ${document.collection}`);
  }
  const display = arcanaDisplayName(collection);
  const files = await provider.listFiles(display, { includeTags: false });
  const file = files.find((row) => row.name === document.filename);
  if (!file) {
    throw new Error(`File not found: ${document.filename}`);
  }

  const original = await provider.readOriginalFile(display, file);
  const entry = {
    name: original.name,
    mime: original.mime,
    size: original.size,
  };

  if (isTextFileName(file.name)) {
    const text = await original.blob.text();
    openFilePreview({ entry, text, page: document.page });
    return;
  }

  const url = URL.createObjectURL(original.blob);
  openFilePreview({
    entry,
    url,
    page: document.page,
    release: () => URL.revokeObjectURL(url),
  });
}
