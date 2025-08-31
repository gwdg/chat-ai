/* eslint-disable no-unused-vars */
import { useSelector } from "react-redux";
import { setLockConversation } from "../Redux/reducers/conversationsSlice";
import { editMemory, addMemory, selectAllMemories } from "../Redux/reducers/userSettingsReducer";
import { chatCompletions } from "../apis/chatCompletions";
import generateMemory from "../apis/generateMemory";
import generateTitle from "../apis/generateTitle";
import { loadFile, loadFileMeta, saveFile, updateConversation } from "../db";
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
          video_url: { url: dataURL }
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

  return output;
}

// Build OpenAI standard conversation from localState
async function buildConversationForAPI(localState) {
  // Determine supported file types from model
  const model = localState.settings.model;
  const ignoreAudio = !(model?.input?.includes("audio") || false)
  const ignoreVideo = !(model?.input?.includes("video") || false)
  const ignoreImages = !(model?.input?.includes("image") || false)
  // Convert to API standard, ignore unsupported files
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
    messages: processedMessages
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
  const conversationId = `${localState.id}`

  try {
    const isArcanaSupported = (localState.settings.model?.input?.includes("arcana") || false)    
    let finalConversationForState; // For local state updates
    let conversationForAPI = await buildConversationForAPI(localState);
    // Prepare system prompt
    let systemPromptAPI = localState.messages[0].role == "system"
      ? localState.messages[0].content.text
      : "";
    if (localState.settings?.memory != 0 && memories.length > 0) {
      const memoryContext = memories.map((memory) => memory.text).join("\n");
      const memorySection = `\n\n--- Begin User Memory ---\n${memoryExplanation}\n\n${memoryContext}\n--- End User Memory ---`;
      systemPromptAPI = systemPromptAPI + memorySection;
    }

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

    // Clean conversation for API call
    conversationForAPI = {
      ...conversationForAPI,
      messages: conversationForAPI.messages.filter(
        (message) => message.role === "system"
        || message.role === "user"
        || message.role === "assistant"
      ),
    };
    
    // Handle tools
    if (conversationForAPI.settings?.enable_tools) {
      conversationForAPI.settings.tools = [];
      if (conversationForAPI.settings?.enable_web_search) {
        conversationForAPI.settings.tools.push({ type: "web_search_preview" });
      }
      // If arcana id exists and isn't empty string ""
      if (conversationForAPI.settings?.arcana?.id && conversationForAPI.settings.arcana.id !== "") {
        conversationForAPI.settings.arcana.limit = 3;
      }
      // Always enable image generation for now
      conversationForAPI.settings.tools.push({ type: "image_generation" })
    } else {
      delete conversationForAPI.settings.arcana;
      delete conversationForAPI.settings.tools;
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
      for await (const chunk of chatCompletions(conversationForAPI, timeout)) {
        if (typeof chunk !== String) {
          // Attempt to save file
          let fileId = "";
          try {
            if (chunk?.type === "image") {
              console.log("Receiving file...");
              const base64_dataURL = chunk?.image_url;

              // Extract base64 and mime type
              const matches = base64_dataURL.match(/^data:(.+);base64,(.*)$/);
              if (!matches) {
                throw new Error("Invalid base64 image data");
              }

              const mimeType = matches[1];
              const base64Data = matches[2];
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);

              // Create File object
              const file = new File([byteArray], "image." + mimeType.split("/")[1], { type: mimeType });

              // Save file (assuming saveFile returns an ID)
              fileId = await saveFile(localState.messages[localState.messages.length - 2].id, file);
              currentContent.push({"type": "file", "fileId": fileId})
              setLocalState(prev => {
                if (prev.id !== conversationId) {return prev;}
                const messages = [...prev.messages];
                messages[messages.length - 2] = {
                  role: "assistant",
                  content: currentContent,
                  loading: true,
                };
                return { ...prev, messages };
              });
              continue
            }
          } catch (err) {
            console.error("Error processing image chunk:", err);
          }
        }
        currentContent[0].text += chunk;
        // UI update happens here in the caller
        setLocalState(prev => {
          if (prev.id !== conversationId) {return prev;}
          const messages = [...prev.messages];
          messages[messages.length - 2] = {
            role: "assistant",
            content: currentContent,
            loading: true,
          };
          return { ...prev, messages };
        });
      }
      return currentContent;
    }

    let responseContent = "";
    let inBackground = false;
    try {
      // Get chat completion response
      responseContent = await getChatChunk(conversationId);
    } catch (error) {
      notifyError(String(error))
      console.error("Error:", error);
    } finally {
      // Set loading to false
      setLocalState(prev => {
        if (prev.id !== conversationId) {
          // Handle save when conversation is not active
          // Save directly into DB
          updateConversation(conversationId, {
            ...localState,
            messages: [
              ...localState.messages,
              { role: "assistant", content: responseContent, loading: false },
              { role: "user", content: [{ type: "text", text: "" }] },
              // TODO what if prompt changes before switching?
            ]
          })
          return prev;
        }
        const messages = [...prev.messages];
        messages[messages.length - 2] = {
          role: "assistant",
          content: responseContent,
          loading: false,
        };
        return { ...prev, messages };
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

    // Keep last message sent by user for possible memory update
    let newUserMessage = undefined;
    try {
      newUserMessage = conversationForAPI.messages.at(-1).content;
      if (Array.isArray(newUserMessage)) newUserMessage = newUserMessage[0].text;
    } catch (error) {
      console.log("Warning: couldn't find new user message. Memory will not be updated");
    }

    // Generate title if conversation is new
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
          updateConversation(conversationId, {
            ...localState,
            messages: [
              ...localState.messages,
              { role: "assistant", content: [{ type: "text", text: responseContent[0].text}] },
              { role: "user", content: [{ type: "text", text: "" }] },
              // TODO what if prompt changes before switching?
            ],
            title
          })
          return prev;
        }
        return { ...prev, title };
      });
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
