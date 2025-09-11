import OpenAI from "openai";

// Controller for handling API request cancellation
let controller = new AbortController();

async function* chatCompletions (
  conversation,
  timeout = 30000,
  stream = true,
) {
  try {
    const model = typeof conversation.settings.model === 'string'
      ? conversation.settings.model
      : conversation.settings.model?.id; // TODO fall back to defaultModel

    // Define base URL from config
    let baseURL = import.meta.env.VITE_BACKEND_ENDPOINT;
    try {
      // If absolute, parse directly
      baseURL = new URL(baseURL).toString();
    } catch {
      // If relative, resolve against current origin
      baseURL = new URL(baseURL, window.location.origin).toString();
    }

    // Initialize params
    const params = {
      model: model,
      messages: conversation.messages,
      temperature: conversation.settings.temperature,
      top_p: conversation.settings.top_p,
      stream: stream,
      stream_options: {include_usage: true },
      timeout: timeout,
    };

    // Handle tools
    if (conversation.settings?.enable_tools) {
      params.enable_tools = true;
      params.tools = conversation?.settings?.tools || [];
    }

    if (conversation.settings?.arcana && conversation.settings.arcana.id !== "") {
      params.arcana = conversation.settings.arcana;
    }

    // Define openai object to call backend
    const openai = new OpenAI({
      baseURL : baseURL,
      apiKey: null,
      dangerouslyAllowBrowser: true,
      timeout: timeout
    });

    // Get chat completion response
    const streamResponse = await openai.chat.completions.create(
      params, { 
      signal: controller.signal,
    });

    if (!stream) {
      const result = streamResponse;
      return result;
    }

    let answer = ""
    for await (const chunk of streamResponse) {
      try {
        answer += chunk.choices[0].delta?.content || ""
        yield (chunk.choices[0].delta)
        if (chunk?.choices?.[0]?.finish_reason === 'stop') {
          // res.status(200).end();
          return answer
        }
      }
      catch (err) {
        // console.error(err);
        console.log("Warning: ", err)
        console.log(chunk)
        // TODO forward exact error
        //res.status(response.status).send(response.statusText);
        // res.status(500).end();
      }
      //console.log(answer);
    }

    // // Handle auth error
    // if (response.status === 401) {
    //   //setShowModalSession(true);
    //   return 401;
    // }

    // // Handle request size error
    // if (response.status === 413) {
    //   // setShowBadRequest(true);
    //   return 413;
    // }

    // if (!response.ok) {
    //   throw new Error(response.statusText || "Error: " + response.status);
    // }

    // const reader = response.body.getReader();
    // const decoder = new TextDecoder();
    // let currentResponse = "";
    // let streamComplete = false;

    // try {
    //   // Stream and process response chunks
    //   while (!streamComplete) {
    //     const { value, done } = await reader.read();
    //     if (done) {
    //       streamComplete = true;
    //       break;
    //     }
    //     const decodedChunk = decoder.decode(value, { stream: true });
    //     yield decodedChunk
    //     currentResponse += decodedChunk;
    //   }
    //   return currentResponse;
    // } catch (error) {
    //   // Handle AbortError specifically during streaming
    //   if (error.name === "AbortError") {
    //     console.log("Request aborted by user")
    //     return currentResponse;
    //   }
    //   throw error;
    // }
  } catch (error) {
    // Handle AbortError at the top level
    if (error.name === "AbortError") {
      return null;
    }
    console.error("An error occurred", error);
    throw error;
  }
}

function abortRequest() {
  if (controller) {
    controller.abort(); // stops the stream/fetch
  }
  controller = new AbortController();
}

export { chatCompletions, abortRequest };
