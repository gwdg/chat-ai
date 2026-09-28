// PDF processing function
export const processFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("image_export_mode", "placeholder");
    formData.append("to_formats", "md");
    formData.append("pdf_backend", "dlparse_v4");
    formData.append("include_images", "false");

    const response = await fetch(
      import.meta.env.VITE_BACKEND_ENDPOINT + "/documents/convert/file",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      content: data?.document?.md_content || "",
      error: null,
    };
  } catch (error) {
    console.error("Error processing document:", error);
    return {
      success: false,
      content: null,
      error: error.message || "Failed to process document",
    };
  }
};

// Keep these for backward compatibility if needed
export const processPdfDocument = processFile;
export const processExcelDocument = processFile;
export const processDocxDocument = processFile;
