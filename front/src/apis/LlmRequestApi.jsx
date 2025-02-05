// Controller for handling API request cancellation
let controller = new AbortController();
let signal = controller.signal;

async function generateConversationTitle(conversation, settings) {
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
    let streamComplete = false;

    // Stream response until complete
    while (!streamComplete) {
      const { value, done } = await reader.read();
      if (done) {
        streamComplete = true;
        break;
      }
      title += decoder.decode(value, { stream: true });
    }

    return title?.trim();
  } catch (error) {
    console.error("Title generation failed:", error);
    return "Untitled Conversation";
  }
}

async function fetchLLMResponse(
  conversation,
  customInstructions,
  modelName,
  temperature,
  topP,
  arcana,
  setLocalState,
  setShowModalSession,
  setShowBadRequest,
  updatedConversation,
  isArcanaSupported
) {
  try {
    // Models that require different message formatting
    const instructModels = ["mixtral-8x7b-instruct"];
    const isInstruct = instructModels.includes(modelName);

    const response = await fetch("/chat-ai-backend", {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: modelName,
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
        temperature: temperature,
        top_p: topP,
        arcana: isArcanaSupported ? arcana : "",
      }),
      signal: signal,
    });

    // Handle auth error
    if (response.status === 401) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: prevState.responses.slice(0, -1),
        prompt:
          prevState.conversation[prevState.conversation.length - 1].content,
        conversation: prevState.conversation.slice(0, -1),
      }));
      setShowModalSession(true);
      return;
    }

    // Handle request size error
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
    let currentResponse = "";
    let streamComplete = false;

    try {
      // Stream and process response chunks
      while (!streamComplete) {
        const { value, done } = await reader.read();
        if (done) {
          streamComplete = true;
          break;
        }

        const decodedChunk = decoder.decode(value, { stream: true });
        currentResponse += decodedChunk;

        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses.slice(0, -1),
            {
              ...prevState.responses[prevState.responses.length - 1],
              response: currentResponse,
            },
          ],
        }));
      }

      const updatedConversation = [
        ...conversation,
        { role: "assistant", content: currentResponse },
      ];

      setLocalState((prevState) => ({
        ...prevState,
        conversation: updatedConversation,
      }));

      // Generate title for new conversations
      if (conversation.length <= 2) {
        const title = await generateConversationTitle(updatedConversation, {
          model_api: modelName,
          temperature: temperature,
          top_p: topP,
        });

        setLocalState((prevState) => ({
          ...prevState,
          title,
        }));
      }

      return currentResponse;
    } catch (error) {
      if (error.name === "AbortError" && currentResponse) {
        setLocalState((prevState) => ({
          ...prevState,
          conversation: [
            ...prevState.conversation,
            { role: "assistant", content: currentResponse },
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

function cancelRequest() {
  controller.abort();
  controller = new AbortController();
  signal = controller.signal;
}

export { fetchLLMResponse, cancelRequest };
