async function offlineModelCall(model) {
  try {
    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: model,
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

    return response; // Return data to use elsewhere
  } catch (error) {
    console.error("An error occurred", error);
    throw error;
  }
}

export { offlineModelCall };
