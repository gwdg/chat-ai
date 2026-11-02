const CONVERTIBLE_FILE_TYPES = new Set(["pdf", "docx"]);

export const canConvertDocumentLocally = (fileType) =>
  CONVERTIBLE_FILE_TYPES.has(fileType);

async function extractPdfTextWithWorker(bytes, wasmUrl) {
  const { PDFiumWorkerClient } = await import("@hyzyla/pdfium/worker");
  const client = await PDFiumWorkerClient.spawn({ wasmUrl });

  try {
    const document = await client.loadDocument(bytes);

    try {
      const pages = [];
      for await (const page of document.pages()) {
        try {
          pages.push(await page.getText());
        } finally {
          await page.close();
        }
      }
      return pages.join("\n\n").trim();
    } finally {
      await document.destroy();
    }
  } finally {
    await client.destroy();
  }
}

async function extractPdfTextOnMainThread(bytes, wasmUrl) {
  const { PDFiumLibrary } = await import("@hyzyla/pdfium");
  const library = await PDFiumLibrary.init({ wasmUrl });

  try {
    const document = await library.loadDocument(bytes);

    try {
      const pages = [];
      for (const page of document.pages()) {
        try {
          pages.push(page.getText());
        } finally {
          page.close();
        }
      }
      return pages.join("\n\n").trim();
    } finally {
      document.destroy();
    }
  } finally {
    library.destroy();
  }
}

async function convertPdf(file) {
  const wasmModule = await import("@hyzyla/pdfium/pdfium.wasm?url");
  const wasmUrl = new URL(wasmModule.default, document.baseURI).href;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    return await extractPdfTextWithWorker(bytes.slice(), wasmUrl);
  } catch (error) {
    console.warn(
      "PDF worker unavailable, falling back to main thread:",
      error,
    );
    return await extractPdfTextOnMainThread(bytes, wasmUrl);
  }
}

async function convertDocx(file) {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();

  if (typeof mammoth.convertToMarkdown === "function") {
    const options = mammoth.images
      ? { convertImage: mammoth.images.imgElement(() => ({})) }
      : undefined;
    const result = await mammoth.convertToMarkdown({ arrayBuffer }, options);
    return result.value.trim();
  }

  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

export async function convertDocumentLocally(file, fileType) {
  if (!canConvertDocumentLocally(fileType)) {
    return {
      success: false,
      content: null,
      error: `Unsupported file type for browser conversion: ${fileType}`,
    };
  }

  try {
    const content =
      fileType === "pdf" ? await convertPdf(file) : await convertDocx(file);

    if (!content) {
      return {
        success: false,
        content: null,
        error: "No text could be extracted from the document",
      };
    }

    return { success: true, content, error: null };
  } catch (error) {
    console.error("Browser document conversion failed:", error);
    return {
      success: false,
      content: null,
      error: error?.message || "Document conversion failed",
    };
  }
}
