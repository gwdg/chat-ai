import getModelDefaults from "../config/getModelDefaults";
import { createBackendClient } from "./openaiClient";

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

    const modelDefaults = getModelDefaults(model);
    // Initialize params
    const params = {
      model: model,
      messages: conversation.messages,
      temperature: conversation.settings.temperature,
      top_p: conversation.settings.top_p,
      stream: stream,
      stream_options: {include_usage: true },
    };

    // Handle reasoning settings
    try {
      if (modelDefaults?.reasoning_effort !== undefined && modelDefaults?.reasoning_effort !== null) {
        let reasoning_effort = modelDefaults.reasoning_effort;
        if (conversation.settings?.reasoning_effort !== undefined && conversation.settings?.reasoning_effort !== null) {
          reasoning_effort = Math.min(conversation.settings.reasoning_effort, modelDefaults.reasoning_options.length - 1)
        }
        if (model?.toLowerCase().includes("mistral") || model?.toLowerCase().includes("openai") ) {
          // Handle mistral and openai models separately
          params.reasoning_effort = modelDefaults.reasoning_options[reasoning_effort];
        }
        else {
          if (reasoning_effort == 0) {
            params.chat_template_kwargs = {enable_thinking: false};
          } else if (modelDefaults.reasoning_options[reasoning_effort] == "on") {
            params.chat_template_kwargs = {enable_thinking: true};
          } else {
            params.chat_template_kwargs = {enable_thinking: true, reasoning_effort: modelDefaults.reasoning_options[reasoning_effort]};
          }
        }
      }
    }  catch {
      console.warn("Could not find reasoning setting")
    }

    // Handle tools
    if (conversation.settings?.enable_tools) {
      params.enable_tools = true;
      params.tools = conversation?.settings?.tools || [];
    }

    if (conversation.settings?.arcana && conversation.settings.arcana.id !== "") {
      params.arcana = conversation.settings.arcana;
    }

    if (conversation.settings?.feedback) {
      params.feedback = conversation.settings.feedback;
    }

    if (conversation.settings?.mcp_servers && conversation.settings.mcp_servers.length > 0) {
      params["mcp-servers"] = [conversation.settings.mcp_servers];
    }

    // Define openai object to call backend
    const openai = createBackendClient(timeout);

    // Get chat completion response
    const streamResponse = await openai.chat.completions.create(
      params, { 
      signal: controller.signal,
    });

    if (!stream) {
      const result = streamResponse;
      console.error("Error:", result);
      return result;
    }

    let answer = ""
    let completed = false
    for await (const chunk of streamResponse) {
      //console.log(chunk);
      if (chunk?.object == "error") {
        console.error(chunk)
          const err = new Error(chunk?.message || "Unknown error");
          err.type = chunk?.type;
          err.status = chunk?.status || chunk?.code;
          err.code = chunk?.code || chunk?.status;
          throw err;
      }
      try {
        if (!completed) {
          answer += chunk.choices[0].delta?.content || ""
          // yield (chunk.choices[0].delta)
          yield chunk
        } else {
          yield chunk;
          return {
            answer, 
            usage: chunk?.usage || null
          };
        }
        if (chunk?.choices?.[0]?.finish_reason === 'stop') {
          completed = true
          // return answer
        }
      }
      catch (err) {
        console.warn("Warning: ", err)
        console.log(chunk)
        // TODO forward exact error
        // res.status(response.status).send(response.statusText);
        // res.status(500).end();
      }
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
    if (error?.name === "AbortError") {
      return null;
    }
    throw error; // Propagate other errorsrs
  }
}

function abortRequest() {
  if (controller) {
    controller.abort(); // stops the stream/fetch
  }
  controller = new AbortController();
}

export { chatCompletions, abortRequest };
