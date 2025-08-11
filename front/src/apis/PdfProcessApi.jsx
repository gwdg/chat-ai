// Generic document processing function
export const processDocument = async (documentFile) => {
  try {
    const formData = new FormData();
    formData.append("document", documentFile);

    const response = await fetch(
      import.meta.env.VITE_BACKEND_ENDPOINT + "/process-pdf",
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
      content: data.markdown,
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
export const processPdfDocument = processDocument;
export const processExcelDocument = processDocument;
export const processDocxDocument = processDocument;
