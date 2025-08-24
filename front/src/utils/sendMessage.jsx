/* eslint-disable no-unused-vars */
import { useSelector } from "react-redux";
import { setLockConversation } from "../Redux/reducers/conversationsSlice";
import { editMemory, addMemory, selectAllMemories } from "../Redux/reducers/userSettingsReducer";
import { chatCompletions } from "../apis/chatCompletions";
import generateMemory from "../apis/generateMemory";
import generateTitle from "../apis/generateTitle";
import { loadFile, loadFileMeta, updateConversation } from "../db";
import { readFileAsBase64 } from "./attachments";

// Convert content items to standard OpenAI API
export async function processContentItems(items, ignoreImages = false, ignoreAudio = false, ignoreVideo = false, ignoreFiles = false) {
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

      // Ignore unsupported files
      if (ignoreImages && file.type.startsWith("image/")) continue;
      else if (ignoreAudio && file.type.startsWith("audio/")) continue;
      else if (ignoreVideo && file.type.startsWith("video/")) continue;
      else if (ignoreFiles
        && !file.type.startsWith("image/")
        && !file.type.startsWith("audio/")
        && !file.type.startsWith("video/"))
        continue;

      // Load supported files
      const file = await loadFile(item.fileId);
      if (!file) {
        console.warn(`File data not found for fileId=${item.fileId}`);
        continue;
      }

      const mimeType = meta.type.toLowerCase();

      if (mimeType.startsWith('image')) {
        // Get Base64 data URL for image
        const dataUrl = await readFileAsBase64(file);
        output.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }

      if (mimeType.startsWith('video')) {
        // Get Base64 data URL for image
        const dataUrl = await readFileAsBase64(file);
        output.push({
          type: "video_url",
          video_url: { url: dataURL }
        });
      }

      else if (mimeType.startsWith('audio')) {
        // Base64 encode without the data prefix
        const base64Data = await readFileAsBase64(file);
        // Determine audio format from the MIME type
        let format = 'mp3';
        if (mimeType.includes('wav')) {
          format = 'wav';
        }
        output.push({
          type: "input_audio",
          input_audio: {
            data: base64Data.split(",")[1], // No prefix
            format
          }
        });
      }

      // TODO handle generic files

      else {
        try {
          // Base64 encode without the data prefix
          // const base64Data = await readFileAsBase64(file);
          // output.push({
          //   type: "file",
          //   file: {
          //     file_data: base64Data, // No prefix
          //     filename: meta.name,
          //   }
          // });
          // Load data
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
  const processedMessages = await Promise.all(
    localState.messages.map(async (message) => {
      if (Array.isArray(message.content)) {
        return {
          role: message.role,
          content: await processContentItems(message.content)
        };
      }
      return message;
    })
  );

  return {
    ...localState,
    messages: processedMessages
  };
}

const sendMessage = async ({
  localState,
  setLocalState,
  openModal,
  notifyError,
  notifySuccess,
  dispatch,
  timeout,
}) => {
  const memories = []// TODO get memories useSelector(selectAllMemories);
  const conversationId = `${localState.id}`

  try {
    const isArcanaSupported = (localState.settings.model?.input?.includes("arcana") || false)    
    let finalConversationForState; // For local state updates
    // Deepcopy of localState

      //   const textContent = textFiles.map((file) => ({
      //     name: file.name,
      //     fileType: file.fileType || "text",
      //     content:
      //       file.fileType === "pdf" ||
      //       file.fileType === "docx" ||
      //       file.fileType === "excel"
      //         ? `${file.name}: ${file.processedContent}`
      //         : `${file.name}: ${file.content}`,
      //     type: "text",
      //     size: file.size,
      //   }));

    let conversationForAPI = await buildConversationForAPI(localState);

    // Prepare system prompt
    let systemPromptAPI = localState.messages[0].role == "system"
      ? localState.messages[0].content.text
      : "";
    if (memories.length > 0) {
      const memoryContext = memories.map((memory) => memory.text).join("\n");
      const memorySection = `\n\n--- User Memory ---\nThe following information represents the user's preferences, important details, and context from previous conversations. Use this information when relevant to provide a more personalized and contextual response:\n\n${memoryContext}\n--- End User Memory ---`;
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
      let currentResponse = "";
      for await (const chunk of chatCompletions(conversationForAPI, timeout)) {
        currentResponse += chunk;
        // UI update happens here in the caller
        setLocalState(prev => {
          if (prev.id !== conversationId) {return prev;}
          const messages = [...prev.messages];
          messages[messages.length - 2] = {
            role: "assistant",
            content: [
              { type: "text", text: currentResponse }
            ],
            loading: true,
          };
          return { ...prev, messages };
        });
      }
      return currentResponse;
    }

    let response = "";
    let inBackground = false;
    try {
      // Get chat completion response
      response = await getChatChunk(conversationId);
    } catch (error) {
      console.error("Error fetching chat chunk:", error);
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
              { role: "assistant", content: [{ type: "text", text: response}], loading: false },
              { role: "user", content: [{ type: "text", text: "" }] },
              // TODO what if prompt changes before switching?
            ]
          })
          return prev;
        }
        const messages = [...prev.messages];
        messages[messages.length - 2] = {
          role: "assistant",
          content: [
            { type: "text", text: response }
          ],
          loading: false,
        };
        return { ...prev, messages };
      });
    }

    // Handle errors
    if (response === 401) {
      // TODO clean up localState
      openModal("errorSessionExpired")
      return;
    } else if (response === 413) {
      // TODO clean up localState
      openModal("errorBadRequest")
      return;
    }
    
    // If not successful don't continue
    if (!response) {
      // TODO clean up localState
      return;
    }

    // Generate title if conversation is new
    conversationForAPI.messages = [
      ...conversationForAPI.messages,
      { role: "assistant", content: response },
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
              { role: "assistant", content: [{ type: "text", text: response}] },
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

    // Update memory if necessary
    try {
      if (memories.length >= 2) {
        const memoryResponse = await generateMemory(
          conversationForAPI.messages,
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
