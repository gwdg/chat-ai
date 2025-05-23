// PDF processing function
export const processPdfDocument = async (pdfFile) => {
  try {
    const formData = new FormData();
    formData.append("document", pdfFile);

    const response = await fetch(new URL('/process-pdf', import.meta.env.VITE_BACKEND_ENDPOINT), {
      method: "POST",
      body: formData,
    });

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
    console.error("Error processing PDF:", error);
    return {
      success: false,
      content: null,
      error: error.message || "Failed to process PDF",
    };
  }
};
