import OpenAI from "openai";

// Controller for handling API request cancellation
let controller = new AbortController();
let signal = controller.signal;

async function chatCompletions (
  customInstructions,
  localState,
  setLocalState,
  updatedConversation,
  isArcanaSupported,
  timeout = 30000
) {
  try {
    const model = typeof localState.settings.model === 'string'
                ? localState.settings.model
                : localState.settings.model?.id;
    const temperature = localState.settings.temperature;
    const top_p = localState.settings.top_p;
    const arcana = localState.arcana;

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
      messages: [
              { role: "system", content: customInstructions },
              ...updatedConversation.slice(1),
            ],
      temperature: temperature,
      top_p: top_p,
      stream: true,
      stream_options: {include_usage: true },
      timeout: timeout,
      extra_body: {arcana: (isArcanaSupported || localState?.settings?.useGWDGTools) ? arcana : ""}
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
