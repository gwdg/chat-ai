/* eslint-disable no-unused-vars */
import OpenAI from "openai";
import { useSelector } from "react-redux";
import { editMemory, addMemory, selectAllMemories } from "../Redux/reducers/userSettingsReducer";
import { chatCompletions } from "../apis/chatCompletions";
import generateMemory from "../apis/generateMemory";
import generateChoiceProposal from "../apis/generateChoiceProposal";
import generateTitle from "../apis/generateTitle";
import { loadFile, loadFileMeta, saveFile, updateConversation, updateConversationMeta } from "../db";
import { getFileType, readFileAsBase64, readFileAsText } from "./attachments";

// Text to be appended to system prompt for memories
const memoryExplanation = "The following list of memories was gathered by the system from previous conversations and may be irrelevant now. You may refer to relevant items only if justified to provide a more personalized and contextual response. Do not make any assumptions based on memories, instead focus on the user messages and requests:"

// Convert content items to standard OpenAI API
export async function processContentItems({
  items,
  ignoreImages = false, 
  ignoreAudio = false, 
  ignoreVideo = false, 
  ignoreDocs = false,
  convertDocs = true,
}) {
  const output = [];
  for (const item of items) {
    if (item.type === 'text') {
      if (item.text && items.length === 1) {
        return item.text
      }
      output.push(item)
      continue;
    }

    if (item.type === 'file' && item.fileId) {
      const meta = await loadFileMeta(item.fileId);
      if (!meta) {
        console.warn(`File meta not found for fileId=${item.fileId}`);
        continue;
      }
      const mimeType = meta.type.toLowerCase();
      const fileType = getFileType(meta);
      // Skip unsupported files
      if (ignoreImages && fileType === "image") continue;
      else if (ignoreAudio && fileType === "audio") continue;
      else if (ignoreVideo && fileType === "video") continue;
      else if (ignoreDocs
        && fileType !== "image"
        && fileType !== "audio"
        && fileType !== "video")
        continue;
      // Load supported files
      const file = await loadFile(item.fileId);
      if (!file) {
        console.warn(`File data not found for fileId=${item.fileId}`);
        continue;
      }
      
      // Handle based on generic file type
      if (fileType === "image") {
        // Send as Base64 data URL for image
        const dataUrl = await readFileAsBase64(file);
        output.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }
      else if (fileType === "video") {
        // Send as Base64 data URL for video
        const dataUrl = await readFileAsBase64(file);
        output.push({
          type: "video_url",
          video_url: { url: dataUrl }
        });
      }
      else if (fileType === "audio") {
        // Base64 encoding without data prefix for audio
        const base64Data = await readFileAsBase64(file);
        // Determine audio format from MIME type
        let format = 'mp3';
        if (mimeType.includes('wav')) {
          format = 'wav';
        }
        output.push({
          type: "input_audio",
          input_audio: {
            data: base64Data.split(",")[1], // Remove prefix
            format
          }
        });
      }
      else if (convertDocs) {
        if (fileType === "pdf") {
          // Shouldn't send unprocessed PDF file
          continue;
        }
        // Try to add file as text
        try {
          const textContent = await readFileAsText(file);
          output.push({
            type: "text",
            text: textContent
          });
        } catch (error) {
          console.warn(`Unsupported file type: ${mimeType}, ${error}`);
        }
      } else {
          // Try to add file in OpenAI format
          try {
            const base64Data = await readFileAsBase64(file);
            output.push({
              type: "file",
              file: {
                file_data: base64Data,
                filename: file.name,
              }
            });
          } catch (error) {
            console.warn(`Unsupported file type: ${mimeType}, ${error}`);
          }
      }
    }
  }
  if (output.length == 1 && typeof output[0]?.text === "string")
    return output[0].text;
  return output;
}

function receiveFile(base64Data, mimeType, filename = null, conversationId = null, ext = null) {
  // Decode base64 data
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // Create File object
  let file;

  if (filename) {
    file = new File([byteArray], filename, { type: mimeType });
  }
  else if (ext) {
    file = new File([byteArray], "file." + ext, { type: mimeType });
  } else {
    file = new File([byteArray], "file." + mimeType.split("/")[1], { type: mimeType });
  }

  // Save file
  // TODO replace id with conversation id
  const fileId = saveFile(conversationId, file);
  return fileId;
}

// Build OpenAI standard conversation from localState
async function buildConversationForAPI(localState) {
  // Determine supported file types from model
  const model = localState.settings.model;
  const ignoreAudio = !(localState.settings.enable_tools || (model?.input?.includes("audio") || false));
  const ignoreVideo = !(localState.settings.enable_tools || (model?.input?.includes("video") || false));
  const ignoreImages = !(localState.settings.enable_tools || (model?.input?.includes("image") || false));
  // Convert to API standard, ignore unsupported files and system message
  const processedMessages = await Promise.all(
    localState.messages.map(async (message) => {
      if (Array.isArray(message.content)) {
        return {
          role: message.role,
          content: await processContentItems({
            items: message.content,
            ignoreImages,
            ignoreAudio,
            ignoreVideo,
        })
        };
      }
      return message;
    })
  );
  // Return full standard conversation
  return {
    ...localState,
    messages: processedMessages,
    settings: {...localState.settings},
  };
}

const sendMessage = async ({
  localState,
  setLocalState,
  memories,
  openModal,
  notifyError,
  notifySuccess,
  dispatch,
  timeout,
}) => {
  const conversationId = localState.id

  try {
    const isArcanaSupported = localState.settings.model?.input?.includes("arcana") || (localState.settings?.enable_tools && !!localState.settings.tools.arcana)   
    let finalConversationForState; // For local state updates
    let conversationForAPI = await buildConversationForAPI(localState);
    // Prepare system prompt
    let systemPromptAPI = localState.messages[0].role == "system"
      ? localState.messages[0].content[0].text
      : "";
    if (localState.settings?.memory != 0 && memories.length > 0) {
      const memoryContext = memories.map((memory) => memory.text).join("\n");
      const memorySection = `\n\n--- Begin User Memory ---\n${memoryExplanation}\n\n${memoryContext}\n--- End User Memory ---`;
      systemPromptAPI = systemPromptAPI + memorySection;
    }
    
    // Handle tools
    if (conversationForAPI.settings?.enable_tools) {
      // Inject the current date and time to the system prompt in human-readable format
      const currentDate = new Date().toLocaleString();
      systemPromptAPI = `\n\n--- Begin System Context ---\nCurrent Date: ${currentDate}\n--- End System Context ---` + systemPromptAPI;
      // Convert tools dictionary to OpenAI-compatible tools list
      conversationForAPI.settings.tools = Object.entries(localState.settings.tools)
                .filter(([_, enabled]) => enabled)
                .map(([toolKey]) => ({ type: toolKey }));
      //console.log(conversationForAPI.settings.tools);
      // if (conversationForAPI.settings?.enable_web_search) {
      //   conversationForAPI.settings.tools.push({ type: "web_search" });
      //   conversationForAPI.settings.tools.push({ type: "fetch_url" });
      // }
      // If arcana id exists and isn't empty string ""
      if (conversationForAPI.settings?.arcana?.id && conversationForAPI.settings.arcana.id !== "") {
        conversationForAPI.settings.arcana.limit = 3;
      }
      conversationForAPI.settings.tools.push({ type: "audio_transcription" });
      // Always enable image and audio generation for now
      // conversationForAPI.settings.tools.push({ type: "image_generation" });
      // conversationForAPI.settings.tools.push({ type: "image_modify" });
      // conversationForAPI.settings.tools.push({ type: "audio_generation" });
      // conversationForAPI.settings.tools.push({ type: "runRscript" }); // Disabled for now
    } else {
      delete conversationForAPI.settings.tools;
    }

    if (!isArcanaSupported) delete conversationForAPI.settings?.arcana;

    // Clean conversation for API call
    conversationForAPI = {
      ...conversationForAPI,
      messages: conversationForAPI.messages.filter(
        (message) => 
        message.role === "user"
        || message.role === "assistant"
      ),
    };

    // Set system prompt in conversationForAPI
    if (systemPromptAPI) {
      conversationForAPI = {
        ...conversationForAPI,
        messages: [{
          role: "system",
          content: systemPromptAPI, // content is string here
        },
        ...conversationForAPI.messages,
      ]}
    }

    // Ensure timeout value is within valid range
    const timeoutAPI = (timeout >= 5000 && timeout <= 900000) ? timeout : 300000;
    
    const isfeedbackMode = import.meta.env.VITE_FEEDBACK_MODE || false;
    if(isfeedbackMode){
      // add feedback information
      if (conversationForAPI.settings?.tools == undefined){
        conversationForAPI.settings.tools = {
            enabled: true
          }
      }else{
        conversationForAPI.settings.tools.enabled = true;
      }
      let message = localState.messages[localState.messages.length - 1];
      if (Array.isArray(message.content)) {
        if (message?.feedback){
            conversationForAPI.settings.feedback = message.feedback;
        }
      }
    }
    
    if(! setLocalState){   
      // console.log(conversationForAPI);
      // send the message WITHOUT changing the UI with any response
      // TODO handle errors and print them to the user
      for await (const chunk of chatCompletions(conversationForAPI, timeoutAPI)){
        console.log(chunk);
      }
      return;
    }
    // Pushing message into conversation history
    setLocalState((prev) => ({
      ...prev,
      // Add two new placeholder messages
      messages: [
        ...prev.messages,
        { role: "assistant", content: [{ type: "text", text: ""}], loading: true },
        { role: "user", content: [{ type: "text", text: "" }] },
      ],
      flush: true // Save to DB immediately
    }));

    // Stream assistant response into localState
    async function getChatChunk(conversationId, messageId = null) {
      let currentContent = [{"type": "text", "text": ""}];
      let usage = null;
      let process_block = "";
      let inThinking = false;
      let message_text = "";
      for await (const chunk of chatCompletions(conversationForAPI, timeoutAPI)) {
        const delta = chunk?.choices[0]?.delta;
        if (chunk?.usage) usage = chunk.usage;
        if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
          try {
            if (delta.tool_calls[0]?.function?.name === "tools.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "error") {
                process_block += "Could not use tools: " + String(arg?.msg) + "\n\n";
              } 
            }
            if (delta.tool_calls[0]?.function?.name === "mcp.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "call") {
                process_block += "Calling MCP server: " + String(arg?.server) 
                + "\n\nfunction: `" 
                + String(arg?.function) 
                + "` with args: `"
                + String(arg?.arguments)
                + "`\n\n";
              } else if (arg.event === "result") {
                process_block += "MCP response received of type `" + String(arg?.type) + "`\n\n";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "rscript.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "preparing_script") {
                process_block += "Running R Script:\n```r\n" + String(arg?.script) + "\n```\n\n";
              } 
              if (arg.event === "error") {
                process_block += "Cannot use Rscript: " + String(arg?.msg) + "\n\n";
              } 
            }
            // Handle web search events
            if (delta.tool_calls[0]?.function?.name === "websearch.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "begin") {
                process_block += "Searching for \"" + arg.query + "\" on ";
              } else if (arg.event === "config") {
                process_block += String(arg?.["search-engine"]) + "\n\n";
              } else if (arg.event === "websearch_done") {
                process_block += "Web search completed. Used " + String(arg.selected) + " relevant sources.\n\n";
              } else if (arg.event === "websearch_page_cache" || arg.event === "fetch") {
                process_block += "Reading source: " + String(arg?.url) + "\n\n";
              } else if (arg.event === "error") {
                process_block += "Websearch Error: " + String(arg?.msg) + "\n\n";
              } else {
                process_block += "";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "arcana.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "accessing") {
                process_block += `Reading arcana "${arg.arcana}" \n\n`;
              } else if (arg.event === "done") {
                process_block += "";// "Arcana retrieval completed.";
              } else {
                process_block += "";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "image.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "image_creation_begin") {
                process_block += `Generating image: "${arg.query}" \n\n`;
              } else if (arg.event === "image_modify_begin") {
                process_block += "Modifying image: " + String(arg?.query) + "\n\n";
              } else if (arg.event === "done") {
                process_block += "";// "Image generation completed.";
              } if (arg.event === "error") {
                process_block += "Image generation failed: " + String(arg?.msg) + "\n\n";
              } else {
                process_block += "";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "video.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "begin") {
                process_block += `Generating video: "${arg.query}" \n\n`;
              } if (arg.event === "error") {
                process_block += "Video generation failed: " + String(arg?.msg) + "\n\n";
              } else {
                process_block += "";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "audio.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "audio_creation_begin") {
                process_block += `Generating audio: "${arg.query}" \n\n`;
              } else if (arg.event === "done") {
                process_block += "";// "Audio generation completed.";
              } if (arg.event === "error") {
                process_block += "Audio generation failed: " + String(arg?.msg) + "\n\n";
              } else {
                process_block += "";
              }
            }
            if (delta.tool_calls[0]?.function?.name === "audio_transcription.event") {
              let arg = delta.tool_calls[0].function.arguments;
              if (typeof arg === "string") arg = JSON.parse(arg);
              if (arg.event === "begin") {
                process_block += `Transcribing audio: `;
              } else if (arg.event === "done") {
                process_block += arg.transcription + "\n\n";// "Audio transcription completed.";
              } if (arg.event === "error") {
                process_block += "Audio transcription failed: " + String(arg?.msg) + "\n\n";
              } else {
                process_block += "";
              }
            }
          } catch (err) {
            console.warn("Didn't understand: ", delta)
          }
        }
        
        // Attempt to receive file
        let fileId = null;
        if (delta?.audio) {
          // Process audio output
          try {
            console.log("Receiving audio...");
            const base64_data = delta.audio?.data;
            const transcript = delta.audio?.transcript;

            const format = delta.audio?.format || "wav";
            const filename = delta.audio?.filename || `output.${format}`;
            const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
            fileId = await receiveFile(base64_data, mimeType, filename, conversationId, format);
          } catch (err) {
            console.error("Error receiving audio file:", err);
          }
        } else if (delta?.content && typeof delta.content !== String) {
          // Attempt to save file
            try {
              if (delta.content?.type === "image") {
                // Process image input
                console.log("Receiving image...");
                const base64_dataURL = delta.content?.image_url;

                // Extract base64 and mime type
                const matches = base64_dataURL.match(/^data:(.+);base64,(.*)$/);
                if (!matches) {
                  throw new Error("Invalid base64 image data");
                }

                const mimeType = matches[1];
                const base64Data = matches[2];
                fileId = await receiveFile(base64Data, mimeType, "image_output", conversationId);
              }
            } catch (err) {
              console.error("Error processing image chunk:", err);
              continue;
            }
        }
        if (fileId) {
          // Attach new file to model output
          currentContent.push({"type": "file", "fileId": fileId})
          setLocalState(prev => {
            if (prev.id !== conversationId) {
              return prev;
            }
            const messages = [...prev.messages];
            messages[messages.length - 2] = {
              role: "assistant",
              content: currentContent,
              loading: true,
            };
            return { ...prev, messages, ignoreConflict: true };
          });
        }
        if (process_block) {
          if (!inThinking) {
            message_text += "<think>";
            inThinking = true;
          }
          message_text += process_block;
          process_block = "";
        }
        if (delta?.content && typeof delta.content === "string") {
          if (inThinking) {
            message_text += "</think>";
            inThinking = false;
          }
          // Process string input
          message_text += delta.content;
        }
        // UI update
        currentContent[0].text = message_text;
        setLocalState(prev => {
          if (prev.id !== conversationId) {
            return prev;
          }
          const messages = [...prev.messages];
          messages[messages.length - 2] = {
            role: "assistant",
            content: currentContent,
            loading: true,
          };
          return { ...prev, messages, ignoreConflict: true };
        });
      }
      if (inThinking) {
        message_text += "</think>";
        inThinking = false;
        currentContent[0].text = message_text
      }
      return {
        answer: currentContent,
        usage
      }
    }

    let responseContent = "";
    let usage = null;
    let chatChunk = null;
    let meta = undefined;
    let choicesProposed = [];
    try {
      // Get chat completion response
      chatChunk = await getChatChunk(conversationId);
      responseContent = chatChunk?.answer || ""
      usage = chatChunk?.usage;
      meta = {
        model: localState.settings.model?.name || localState.settings.model?.id || "",
        usage
      };
    } catch (error) {
      const errorType = error?.type || "Error";
      const errorMsg = error?.error?.message || error?.error || error?.message || "An unknown error occurred";
      const errorStatus = error?.status ? `(${error.status})` : "";
      notifyError(`${errorType}: ${errorMsg.toString()} ${errorStatus}`);
      console.error(error);
    } finally {
      // Update choices
      if(localState.settings.choiceProposer == 1){
        try {
          const content = localState.messages.map((message) => {
          if (Array.isArray(message.content)){
            return message.role + ": " + message.content[0].text;
          }
          });
          content.push("assistant: " + responseContent[0].text)
          console.log(content.join("\n\n"))

          const response = await generateChoiceProposal(
            content.join("\n\n")
          );
          choicesProposed = response;
        } catch (error) {
          console.error("Failed to generate choices: ", error.name, error.message);
          notifyError("Failed to generate choices.");
        }
      }

      // Set loading to false
      setLocalState(prev => {
        if (prev.id !== conversationId) {
          // Handle save when conversation is not active, ideally save directly into DB (TODO)
          const messages = [...localState.messages,
            { role: "assistant", content: responseContent, loading: false, meta },
            { role: "user", content: [{ type: "text", text: "" }] },
          ];
          updateConversation(
            conversationId,
            { ...localState, messages },
            true
          );
          return prev;
        }
        const choices = choicesProposed;
        const messages = [...prev.messages];
        messages[messages.length - 2] = {
          role: "assistant",
          content: responseContent,
          loading: false,
          meta
        };
        return { ...prev, messages, choices, flush: true };
      });
    }

    // Handle errors
    // if (response === 401) {
    //   // TODO clean up localState
    //   openModal("errorSessionExpired")
    //   return;
    // } else if (response === 413) {
    //   // TODO clean up localState
    //   openModal("errorBadRequest")
    //   return;
    // }
    
    // If not successful don't continue
    if (!responseContent) {
      // TODO clean up localState
      return;
    }

    delete conversationForAPI.settings?.arcana;

    // Keep last message sent by user for possible memory update
    let newUserMessage = undefined;
    try {
      newUserMessage = conversationForAPI.messages.at(-1).content;
      if (Array.isArray(newUserMessage)) newUserMessage = newUserMessage[0].text;
    } catch (error) {
      console.log("Warning: couldn't find new user message. Memory will not be updated");
    }

    // Generate title if conversation is new
    // Change model if defined in config
    try {
      conversationForAPI.messages = [
        ...conversationForAPI.messages,
        { role: "assistant", content: responseContent },
        { role: "user", content: "" }
      ];
      if (conversationForAPI.messages.length <= 4) {
        const title = await generateTitle(conversationForAPI.messages);
        console.log("Generated title is ", title)
        setLocalState(prev => {
          if (prev.id !== conversationId) {
            updateConversationMeta(conversationId, {title})
            return prev;
          }
          return { ...prev, title, flush: true, };
        });
      }
    } catch (error) {
      console.error("Failed to generate title: ", error);
    }

    // Update memory if enabled
    try {
      if (localState.settings?.memory == 2 && newUserMessage) {
        const memoryResponse = await generateMemory(
          newUserMessage,
          memories
        );
        const cleanedResponse = memoryResponse.replace(/,(\s*[}$])/g, "$1");
        const jsonResponse = JSON.parse(cleanedResponse);
        if (jsonResponse.store) {
          const memoryText = jsonResponse.memory_sentence.trim();
          if (jsonResponse.replace) {
            const line_number = jsonResponse.line_number - 1;
            dispatch(editMemory({ index: line_number, text: memoryText }));
          } else {
            dispatch(addMemory({ text: memoryText }));
          }
          notifySuccess("Memory updated successfully.");
        }
      }
    } catch (error) {
      console.error("Failed to update memory: ", error.name, error.message);
      notifyError("Failed to update memory.");
    }

  } catch (error) {
    // ‌Handle Errors
    if (error.name === "AbortError") {
      notifyError("Request aborted.");
    } else if (error.message) {
      console.log(error)
      notifyError(error.message);
    } else {
      notifyError("An unknown error occurred");
    }
  }
};

export default sendMessage;
