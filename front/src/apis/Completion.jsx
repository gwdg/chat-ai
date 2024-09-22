let controller = new AbortController();
let signal = controller.signal;

async function getDataFromLLM(
  conversation,
  customInstructions,
  chooseModelApi,
  temperatureGlobal,
  tpopGlobal,
  setResponses,
  setConversation,
  setShowModelSession,
  setPrompt,
  setShowBadRequest
) {
  try {
    const instructModels = ["mixtral-8x7b-instruct"];
    const isInstruct = instructModels.includes(chooseModelApi);

    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        model: chooseModelApi,
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

    // If the response is not ok (status not in the range 200-299),
    // throw original error from the API
    if (response.status === 401) {
      // Reload the current page
      setResponses((prevResponses) => [
        ...prevResponses.slice(0, prevResponses.length - 1),
      ]);
      // Set prompt
      setPrompt(conversation[conversation.length - 1].content);
      // Set conversation
      setConversation([...conversation.slice(0, conversation.length - 1)]);
      // Show a dialog box to user
      setShowModelSession(true);
      return;
    } else if (response.status === 413) {
      // Reload the current page
      setResponses((prevResponses) => [
        ...prevResponses.slice(0, prevResponses.length - 1),
      ]);
      setConversation([...conversation.slice(0, conversation.length - 1)]);
      // Show a dialog box to user
      setShowBadRequest(true);
      return;
    } else {
      if (!response.ok) {
        let error = response.statusText;
        setConversation([...conversation, { role: "assistant", content: "" }]);
        throw new Error(error || "An unknown error occurred");
      }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let newResponse = "";

    let { value, done } = await reader.read();
    do {
      if (done) {
        break;
      }
      const decodedChunk = decoder.decode(value, { stream: true });
      newResponse += "" + decodedChunk;

      setResponses((prevResponses) => [
        ...prevResponses.slice(0, prevResponses.length - 1),
        {
          ...prevResponses[prevResponses.length - 1],
          response: newResponse,
        },
      ]);
      setConversation([
        ...conversation,
        { role: "assistant", content: newResponse },
      ]);

      const readResult = await reader.read();
      value = readResult.value;
      done = readResult.done;
    } while (!done);
    return newResponse;
  } catch (error) {
    console.error("An eurror occurred", error);
    throw error;
  }
}

function abortFetch() {
  controller.abort();
  controller = new AbortController();
  signal = controller.signal;
}

export { getDataFromLLM, abortFetch };
