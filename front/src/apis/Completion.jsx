let controller = new AbortController();
let signal = controller.signal;

async function generateTitle(conversation, settings) {
  const titlePrompt =
    "Create a very short title (maximum 4 words) for this conversation that captures its main topic. Respond only with the title - no quotes, punctuation, or additional text.";
  try {
    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: "meta-llama-3.1-8b-instruct",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...conversation.slice(1),
          { role: "user", content: titlePrompt },
        ],
        temperature: settings.temperature,
        top_p: settings.top_p,
      }),
    });

    if (!response.ok) throw new Error(response.statusText);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let title = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      title += decoder.decode(value, { stream: true });
    }

    return title?.trim();
  } catch (error) {
    console.error("Title generation failed:", error);
    return "Untitled Conversation";
  }
}

async function getDataFromLLM(
  conversation,
  customInstructions,
  chooseModelApi,
  temperatureGlobal,
  tpopGlobal,
  arcana,
  setLocalState,
  setShowModelSession,
  setShowBadRequest,
  updatedConversation
) {
  try {
    const instructModels = ["mixtral-8x7b-instruct"];
    const isInstruct = instructModels.includes(chooseModelApi);

    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: chooseModelApi,
        messages: isInstruct
          ? [
              {
                role: "user",
                content:
                  customInstructions + "\n" + updatedConversation[1].content,
              },
              ...updatedConversation.slice(2),
            ]
          : [
              { role: "system", content: customInstructions },
              ...updatedConversation.slice(1),
            ],
        temperature: temperatureGlobal,
        top_p: tpopGlobal,
        arcana: arcana,
      }),
      signal: signal,
    });

    if (response.status === 401) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: prevState.responses.slice(0, -1),
        prompt:
          prevState.conversation[prevState.conversation.length - 1].content,
        conversation: prevState.conversation.slice(0, -1),
      }));
      setShowModelSession(true);
      return;
    }

    if (response.status === 413) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: prevState.responses.slice(0, -1),
        conversation: prevState.conversation.slice(0, -1),
      }));
      setShowBadRequest(true);
      return;
    }

    if (!response.ok) {
      throw new Error(response.statusText || "An unknown error occurred");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let newResponse = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const decodedChunk = decoder.decode(value, { stream: true });
        newResponse += decodedChunk;

        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses.slice(0, -1),
            {
              ...prevState.responses[prevState.responses.length - 1],
              response: newResponse,
            },
          ],
        }));
      }

      const updatedConversation = [
        ...conversation,
        { role: "assistant", content: newResponse },
      ];

      setLocalState((prevState) => ({
        ...prevState,
        conversation: updatedConversation,
      }));

      // Generate title if this is the first exchange
      if (conversation.length <= 2) {
        const title = await generateTitle(updatedConversation, {
          model_api: chooseModelApi,
          temperature: temperatureGlobal,
          top_p: tpopGlobal,
        });

        setLocalState((prevState) => ({
          ...prevState,
          title,
        }));
      }

      return newResponse;
    } catch (error) {
      if (error.name === "AbortError" && newResponse) {
        setLocalState((prevState) => ({
          ...prevState,
          conversation: [
            ...prevState.conversation,
            { role: "assistant", content: newResponse },
          ],
        }));
      }
      throw error;
    }
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
