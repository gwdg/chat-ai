import OpenAI from "openai";

// Controller for handling API request cancellation
let controller = new AbortController();
let signal = controller.signal;

async function chatCompletions (
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
    console.log("Model is ", model)
    let headers = {
      "Content-Type": "application/json"
    };

    // Define openai object
    const baseURL = import.meta.env.VITE_BACKEND_ENDPOINT
    // TODO Support relative URLs
    // const url = String(new URL('/relative-url-to/api-docs', document.baseURI));
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
    console.log(response);
    console.log(response.statusText);

    // Handle auth error
    if (response.status === 401) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: prevState.responses.slice(0, -1),
        prompt:
          prevState.messages[prevState.messages.length - 1].content,
        messages: prevState.messages.slice(0, -1),
      }));
      //setShowModalSession(true);
      return 401;
    }

    // Handle request size error
    if (response.status === 413) {
      setLocalState((prevState) => ({
        ...prevState,
        responses: prevState.responses.slice(0, -1),
        messages: prevState.messages.slice(0, -1),
      }));
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
        currentResponse += decodedChunk;
        console.log(currentResponse);
        // setLocalState((prevState) => ({
        //   ...prevState,
        //   responses: [
        //     ...prevState.responses.slice(0, -1),
        //     {
        //       ...prevState.responses[prevState.responses.length - 1],
        //       response: currentResponse,
        //     },
        //   ],
        // }));
      }
      return currentResponse;
    } catch (error) {
      // Handle AbortError specifically during streaming
      if (error.name === "AbortError") {
        // Only update state with partial response if we have content
        if (currentResponse) {
          setLocalState((prevState) => ({
            ...prevState,
            messages: [
              ...prevState.messages,
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

export { chatCompletions, cancelRequest, isRequestActive };
