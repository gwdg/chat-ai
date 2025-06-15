import { getDefaultSettings } from "../utils/settingsUtils";

// Controller for handling API request cancellation
let controller = new AbortController();
let signal = controller.signal;

async function generateConversationTitle(conversation, settings) {
  const defaultSettings = getDefaultSettings();

  let processedConversation = conversation.map((message) => {
    // Handle case where content is an array (containing text and image objects)
    if (message.role === "user" && Array.isArray(message.content)) {
      return {
        role: "user",
        content: message.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n"),
      };
    }
    // Handle case where content is a string but contains image data
    else if (
      message.content &&
      typeof message.content === "string" &&
      message.content.includes("data:image")
    ) {
      // Remove the image data URL portion
      return {
        role: message.role,
        content: message.content.replace(
          /data:image\/[^;]+;base64,[^"]+/g,
          "[Image]"
        ),
      };
    }
    // Return unchanged for other cases
    return message;
  });

  const titlePrompt =
    "Create a very short title (maximum 4 words) for this conversation that captures its main topic. Respond only with the title - no quotes, punctuation, or additional text.";

  try {
    const response = await fetch(import.meta.env.VITE_BACKEND_ENDPOINT, {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: defaultSettings.model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          ...processedConversation.slice(1),
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
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "Untitled Conversation";
    }
    console.error("Title generation failed:", error);
    return "Untitled Conversation";
  }
}

async function updateMemory(conversation, memories) {
  const defaultSettings = getDefaultSettings();

  const memoryPrompt =
    "Determine if the new user message provided below contains any NEW personal information worth storing for future conversations, that is not already stored in current memory.\n" +
    "Current memory was provided in the system prompt, DO NOT repeat anything from the current memory!" +
    "Look for personal information in the new user message including new details about name, nickname, pronouns, projects, preferences, interests, and other useful context. " +
    "If there is no useful information, or if the info was already in the current memory list provided in the system prompt, respond like this:\n" +
    "{" +
    '"store": false,' +
    '"memory_sentence": ""' +
    "}\n\n" +
    "Otherwise, only if there is new information in the new user message THAT IS NOT GIVEN IN THE CURRENT MEMORY LIST, respond with JSON as in the following example:\n" +
    "{" +
    '"store": true,' +
    '"memory_sentence": "User likes chocolate cookies"' +
    "}\n\n" +
    "It is always safer to respond store=false when you are unsure. Only create a new memory when the info is new and not provided in the system prompt.\nHere is the new user message:\n" +
    conversation.at(-1).content;

  const memoryUpdateSchema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
      store: {
        type: "boolean",
      },
      memory_sentence: {
        type: "string",
      },
    },
    required: ["store", "memory_sentence"],
  };

  try {
    const response = await fetch(import.meta.env.VITE_BACKEND_ENDPOINT, {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: defaultSettings.model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Here is the current memory list:\n" +
              memories.map((memory) => memory.text).join("\n"),
          },
          { role: "user", content: memoryPrompt },
        ],
        temperature: 0.1,
        top_p: 0.1,
        extra_body: { guided_json: memoryUpdateSchema },
      }),
    });
    if (!response.ok) throw new Error(response.statusText);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let memory = "";
    let streamComplete = false;

    // Stream response until complete
    while (!streamComplete) {
      const { value, done } = await reader.read();
      if (done) {
        streamComplete = true;
        break;
      }
      memory += decoder.decode(value, { stream: true });
    }

    return memory?.trim();
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "";
    }
    console.error("Memory update failed:", error);
    return "";
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
  isArcanaSupported,
  timeoutTime = 30000
) {
  try {
    // Models that require different message formatting
    const instructModels = ["mixtral-8x7b-instruct"];
    const isInstruct = instructModels.includes(modelName);

    const response = await fetch(import.meta.env.VITE_BACKEND_ENDPOINT, {
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
        timeout: timeoutTime,
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

      const cleanedConversation = updatedConversation.map((message) => {
        if (message.role === "user" && Array.isArray(message.content)) {
          return {
            role: "user",
            content: message.content.map((item) => {
              if (item.type === "video_url") {
                return {
                  type: "video_url",
                  video_url: {
                    hasVideo: true,
                    url: "",
                  },
                };
              }
              return item;
            }),
          };
        }
        return message;
      });

      setLocalState((prevState) => ({
        ...prevState,
        conversation: cleanedConversation,
      }));

      // Generate title for new conversations
      if (conversation.length <= 2) {
        const title = await generateConversationTitle(conversation, {
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
      // Handle AbortError specifically during streaming
      if (error.name === "AbortError") {
        // Only update state with partial response if we have content
        if (currentResponse) {
          setLocalState((prevState) => ({
            ...prevState,
            conversation: [
              ...prevState.conversation,
              { role: "assistant", content: currentResponse },
            ],
          }));
        }
        // Don't re-throw AbortError - it's expected behavior
        return currentResponse;
      }
      throw error;
    }
  } catch (error) {
    // Handle AbortError at the top level
    if (error.name === "AbortError") {
      return null; // or handle as appropriate for your app
    }

    console.error("An error occurred", error);
    throw error;
  }
}

function cancelRequest() {
  // Check if there's an active request to cancel
  if (!controller.signal.aborted) {
    controller.abort();
  }

  // Create new controller for next request
  controller = new AbortController();
  signal = controller.signal;
}

// Additional helper function to check if a request is active
function isRequestActive() {
  return !controller.signal.aborted;
}

export { fetchLLMResponse, cancelRequest, isRequestActive, updateMemory };
