import OpenAI from "openai";

// Controller for handling API request cancellation
let controller = new AbortController();
let signal = controller.signal;

async function* chatCompletions (
  rawConversation,
  timeout = 30000
) {
  try {
    // Clean conversation for API call
    const conversation = {
      ...rawConversation,
      messages: rawConversation.messages.filter(
        (message) => message.role !== "info"
      ),
    };
    const model = typeof conversation.settings.model === 'string'
      ? conversation.settings.model
      : conversation.settings.model?.id;

    // Define base URL from config
    let baseURL = import.meta.env.VITE_BACKEND_ENDPOINT;
    try {
      // If absolute, parse directly
      baseURL = new URL(baseURL).toString();
    } catch {
      // If relative, resolve against current origin
      baseURL = new URL(baseURL, window.location.origin).toString();
    }

    // Define openai object
    const openai = new OpenAI({baseURL : baseURL, apiKey: null, dangerouslyAllowBrowser: true});
    const response = await openai.chat.completions.create({
      model: model,
      messages: conversation.messages,
      temperature: conversation.settings.temperature,
      top_p: conversation.settings.top_p,
      stream: true,
      stream_options: {include_usage: true },
      timeout: timeout,
      extra_body: {arcana: (conversation.settings.arcana && conversation.settings?.enable_tools) ? conversation.settings.arcana : ""}
    }).asResponse();

    console.log(response.statusText);

    // Handle auth error
    if (response.status === 401) {
      //setShowModalSession(true);
      return 401;
    }

    // Handle request size error
    if (response.status === 413) {
      // setShowBadRequest(true);
      return 413;
    }

    if (!response.ok) {
      throw new Error(response.statusText || "Error: " + response.status);
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
        yield decodedChunk
        currentResponse += decodedChunk;
      }
      return currentResponse;
    } catch (error) {
      // Handle AbortError specifically during streaming
      if (error.name === "AbortError") {
        console.log("Aborted error")
        return currentResponse;
      }
      throw error;
    }
  } catch (error) {
    // Handle AbortError at the top level
    if (error.name === "AbortError") {
      return null;
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

export { chatCompletions, cancelRequest, isRequestActive };
