let controller = new AbortController();
let signal = controller.signal;

async function getDataFromLLM(
  conversation,
  customInstructions,
  chooseModel,
  temperatureGlobal,
  tpopGlobal,
  setShowModelSession,
  setPrompt,
  setShowBadRequest
) {
  try {
    const instructModels = ["mixtral-8x7b-instruct"];
    const isInstruct = instructModels.includes(chooseModel);

    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: chooseModel,
        messages: isInstruct
          ? [
              {
                role: "user",
                content: customInstructions + "\n" + conversation[1].content,
              },
              ...conversation.slice(2),
            ]
          : [
              { role: "system", content: customInstructions },
              ...conversation.slice(1),
            ],
        temperature: temperatureGlobal,
        top_p: tpopGlobal,
      }),
      signal: signal,
    });

    if (response.status === 401) {
      setShowModelSession(true);
      return;
    } else if (response.status === 413) {
      setShowBadRequest(true);
      return;
    } else if (response.status === 404) {
      // Handle 404 error: provide a temporary markdown response
      const temporaryMarkdownResponse =
        "### Oops! Something went wrong.\n\nIt looks like the requested information couldn't be retrieved. Please try again later or modify your query.";
      return temporaryMarkdownResponse;
    } else {
      if (!response.ok) {
        let error = response.statusText;
        throw new Error(error || "An unknown error occurred");
      }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let newResponse = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const decodedChunk = decoder.decode(value, { stream: true });
      newResponse += decodedChunk;
    }

    return newResponse;
  } catch (error) {
    console.error("An error occurred", error);
    throw error;
  }
}

function abortFetch() {
  controller.abort();
  controller = new AbortController();
  signal = controller.signal;
}

export { getDataFromLLM, abortFetch };
