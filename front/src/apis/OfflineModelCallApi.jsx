// Tests if a specific model is available and responsive
async function checkModelAvailability(modelName) {
  try {
    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant",
          },
          {
            role: "user",
            content: "hi",
          },
        ],
        temperature: 0.5,
        top_p: 0.5,
      }),
    });

    return response;
  } catch (error) {
    console.error("Model availability check failed:", error);
    throw error;
  }
}

export { checkModelAvailability };
