export const processPdfDocument = async (pdfFile) => {
  try {
    const formData = new FormData();
    formData.append("pdf", pdfFile);

    const response = await fetch("/process-pdf", {
      method: "POST",
      headers: {
        "inference-id": crypto.randomUUID(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      content: data.text || data.content,
      error: null,
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    return {
      success: false,
      content: null,
      error: error.message || "Failed to process PDF",
    };
  }
};
