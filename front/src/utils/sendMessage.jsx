/* eslint-disable no-unused-vars */
import { useSelector } from "react-redux";
import { setLockConversation } from "../Redux/reducers/conversationsSlice";
import { editMemory, addMemory, selectAllMemories } from "../Redux/reducers/userSettingsReducer";
import { chatCompletions } from "../apis/chatCompletions";
import generateMemory from "../apis/generateMemory";
import generateTitle from "../apis/generateTitle";
import { updateConversationMeta } from "../db";

const sendMessage = async ({
  localState,
  setLocalState,
  openModal,
  // === OPERATION CONFIG ===
  notifyError,
  notifySuccess,

  // === REACT STATE & DISPATCHERS ===
  dispatch,

  // === EXTERNAL FUNCTIONS ===
  timeout,
}) => {
  const memories = []// useSelector(selectAllMemories);
  // Set loading state
  dispatch(setLockConversation(true));
  // if (operationType === "new") {
  //   setLoading(true);
  // } else {
  //   setLoadingResend(true);
  // }

  try {
    const isArcanaSupported = (localState.settings.model?.input?.includes("arcana") || false)    
    let finalConversationForState; // For local state updates
    // Deepcopy of localState
      // === NEW MESSAGE LOGIC (from getRes) ===

      // Check model support first
      // const imageSupport = modelsData.some(
      //   (modelX) =>
      //     modelX.name === localState.settings.model.name &&
      //     modelX.input.includes("image")
      // );
      // const videoSupport = modelsData.some(
      //   (modelX) =>
      //     modelX.name === localState.setting.model.name &&
      //     modelX.input.includes("video")
      // );
      // const audioSupport = modelsData.some(
      //   (modelX) =>
      //     modelX.name === localState.settings.model.name &&
      //     modelX.input.includes("audio")
      // );
      // console.log(processedConversation);
      // // Process conversation based on image/video/audio support
      // if (!imageSupport && !videoSupport && !audioSupport) {
      //   processedConversation = processedConversation.map((message) => {
      //     if (message.role === "user" && Array.isArray(message.content)) {
      //       return {
      //         role: "user",
      //         content: message.content
      //           .filter((item) => item.type === "text")
      //           .map((item) => item.text)
      //           .join("\n"),
      //       };
      //     }
      //     return message;
      //   });
      // }

      // Process selected files
      // if (selectedFiles.length > 0) {
      //   const imageFiles = selectedFiles.filter(
      //     (file) => file.type === "image"
      //   );
      //   const videoFiles = selectedFiles.filter(
      //     (file) => file.type === "video"
      //   );
      //   const textFiles = selectedFiles.filter(
      //     (file) =>
      //       file.type !== "image" &&
      //       file.type !== "video" &&
      //       file.type !== "audio"
      //   );
      //   const audioFiles = selectedFiles.filter(
      //     (file) => file.type === "audio"
      //   );

      //   // Create content arrays for response storage
      //   const audioContent = audioFiles.map((audioFile) => ({
      //     type: "input_audio",
      //     input_audio: {
      //       data: audioFile.text, // Raw base64
      //       format: audioFile.format, // "wav" or "mp3"
      //     },
      //   }));

      //   const imageContent = imageFiles.map((imageFile) => ({
      //     type: "image_url",
      //     image_url: {
      //       url: imageFile.text,
      //     },
      //   }));

      //   const videoContent = videoFiles.map(() => ({
      //     type: "video_url",
      //     video_url: {
      //       url: "",
      //     },
      //   }));

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

      //   // FIXED: Store audio files properly for resend functionality
      //   const audioFilesForStorage = audioFiles.map((audioFile) => ({
      //     name: audioFile.name,
      //     format: audioFile.format,
      //     data: audioFile.text, // Raw base64
      //     size: audioFile.size,
      //     type: "audio",
      //   }));

      //   // Add response entry with files
      //   setLocalState((prevState) => ({
      //     ...prevState,
      //     responses: [
      //       ...prevState.responses,
      //       {
      //         prompt: prevState.prompt,
      //         images: imageContent,
      //         videos: videoContent,
      //         textFiles: textContent,
      //         audio: audioContent, // For API request format
      //         audioFiles: audioFilesForStorage, // For resend functionality
      //         response: "",
      //       },
      //     ],
      //   }));
      // } else {
      //   // Add response entry without images
      //   setLocalState((prevState) => ({
      //     ...prevState,
      //     responses: [
      //       ...prevState.responses,
      //       {
      //         prompt: prevState.prompt,
      //         response: "",
      //       },
      //     ],
      //   }));
      // }
    // else {
    //   // === RESEND/EDIT LOGIC ===

    //   // Validate index
    //   if (index < 0 || index >= localState.responses.length) {
    //     notifyError("Something went wrong");
    //     dispatch(setLockConversation(false));
    //     setLoadingResend(false);
    //     return;
    //   }

    //   // Get prompt based on operation
    //   let currentPrompt;
    //   if (operationType === "edit") {
    //     if (!editedText || !editedText?.trim()) {
    //       notifyError("Prompt cannot be empty!");
    //       dispatch(setLockConversation(false));
    //       setLoadingResend(false);
    //       return;
    //     }
    //     currentPrompt = editedText;
    //   } else {
    //     // resend
    //     currentPrompt = localState.responses[index]?.prompt;
    //     // if (!currentPrompt || currentPrompt?.trim() === "") {
    //     //   notifyError("Invalid or empty prompt at the specified index.");
    //     //   dispatch(setIsResponding(false));
    //     //   setLoadingResend(false);
    //     //   return;
    //     // }
    //   }

    //   // Get existing files from the response
    //   let imageFiles = [];
    //   let textFiles = [];
    //   let audioFiles = [];
    //   let audioFilesForStorage = [];

    //   if (localState.responses[index]?.images?.length > 0) {
    //     imageFiles = localState.responses[index]?.images;
    //   }
    //   if (localState.responses[index]?.textFiles?.length > 0) {
    //     textFiles = localState.responses[index]?.textFiles;
    //   }

    //   // FIXED: Handle audio files properly for resend
    //   if (localState.responses[index]?.audio?.length > 0) {
    //     audioFiles = localState.responses[index]?.audio; // For API format
    //   }
    //   if (localState.responses[index]?.audioFiles?.length > 0) {
    //     audioFilesForStorage = localState.responses[index]?.audioFiles; // For resend functionality
    //   }

    //   // Reconstruct conversation
    //   const originalConversation = [...localState.messages];

    //   // Count actual user-assistant pairs in responses (excluding info objects)
    //   let actualPairIndex = 0;
    //   for (let i = 0; i <= index; i++) {
    //     if (!localState.responses[i]?.info) {
    //       if (i === index) break;
    //       actualPairIndex++;
    //     }
    //   }

    //   // Filter out info messages to do proper slicing
    //   const filteredConversation = localState.messages.filter(
    //     (message) => message.role !== "info"
    //   );

    //   // Do the slice on filtered conversation using the actual pair index
    //   const slicedFiltered = filteredConversation.slice(
    //     0,
    //     actualPairIndex * 2 + 1
    //   );

    //   // Now reconstruct conversation with info messages back in their original positions
    //   let newConversation = [];
    //   let filteredIndex = 0;

    //   for (const originalMessage of originalConversation) {
    //     if (originalMessage.role === "info") {
    //       // Check if this info message should be included (appears before our cutoff)
    //       const lastKeptMessage = slicedFiltered[slicedFiltered.length - 1];
    //       const lastKeptOriginalIndex =
    //         originalConversation.indexOf(lastKeptMessage);
    //       const currentOriginalIndex =
    //         originalConversation.indexOf(originalMessage);

    //       if (currentOriginalIndex <= lastKeptOriginalIndex) {
    //         newConversation.push(originalMessage);
    //       }
    //     } else {
    //       // Non-info message - check if it's in our sliced array
    //       if (
    //         filteredIndex < slicedFiltered.length &&
    //         originalMessage === slicedFiltered[filteredIndex]
    //       ) {
    //         newConversation.push(originalMessage);
    //         filteredIndex++;
    //       }
    //     }
    //   }

    //   // Update responses
    //   // let newResponses = [...localState.responses].slice(0, index);
    //   // updateLocalState({ responses: newResponses });

    //   // Add small delay to ensure state updates properly
    //   await new Promise((resolve) => setTimeout(resolve, 0));

    //   // Prepare new message content based on whether there are attachments
    //   if (
    //     imageFiles?.length > 0 ||
    //     textFiles?.length > 0 ||
    //     audioFiles?.length > 0
    //   ) {
    //     // Start with the prompt text
    //     const newPromptContent = [
    //       {
    //         type: "text",
    //         text: currentPrompt,
    //       },
    //     ];

    //     // Add images if they exist
    //     if (imageFiles?.length > 0) {
    //       newPromptContent.push(...imageFiles);
    //     }

    //     // Add audio if it exists
    //     if (audioFiles?.length > 0) {
    //       newPromptContent.push(...audioFiles);
    //     }

    //     // Add text content if text files exist
    //     if (textFiles?.length > 0) {
    //       // Process all text files and append their content
    //       const textContent = textFiles
    //         .map((file) => file.content)
    //         .join("\n\n");

    //       // Only add if there's actually content
    //       if (textContent.trim()) {
    //         newPromptContent[0].text += `\n${textContent}`;
    //       }
    //     }

    //     newConversation.push({ role: "user", content: newPromptContent });
    //   } else {
    //     // If no attachments, just use the text prompt
    //     newConversation.push({ role: "user", content: currentPrompt });
    //   }

    //   // Update local state with new response entry
    //   if (
    //     imageFiles?.length > 0 ||
    //     textFiles?.length > 0 ||
    //     audioFiles?.length > 0
    //   ) {
    //     setLocalState((prevState) => ({
    //       ...prevState,
    //       responses: [
    //         ...prevState.responses,
    //         {
    //           prompt: currentPrompt,
    //           images: imageFiles,
    //           textFiles: textFiles,
    //           audio: audioFiles, // For API format
    //           audioFiles: audioFilesForStorage, // For resend functionality
    //           response: "",
    //         },
    //       ],
    //     }));
    //   } else {
    //     setLocalState((prevState) => ({
    //       ...prevState,
    //       responses: [
    //         ...prevState.responses,
    //         {
    //           prompt: currentPrompt,
    //           response: "",
    //         },
    //       ],
    //     }));
    //   }

    //   // Process conversation for model support
    //   const imageSupport = modelsData.some(
    //     (modelX) =>
    //       modelX.name === localState.settings.model.name &&
    //       modelX.input.includes("image")
    //   );
    //   const videoSupport = modelsData.some(
    //     (modelX) =>
    //       modelX.name === localState.settings.model.name &&
    //       modelX.input.includes("video")
    //   );
    //   const audioSupport = modelsData.some(
    //     (modelX) =>
    //       modelX.name === localState.settings.model.name &&
    //       modelX.input.includes("audio")
    //   );

    //   // Create updated conversation array for processing - REMOVE "info" role objects
    //   let updatedConversation = [...newConversation].filter(
    //     (message) => message.role !== "info"
    //   );

    //   // If model doesn't support images/videos/audio, remove multimedia content
    //   if (!imageSupport && !videoSupport && !audioSupport) {
    //     updatedConversation = updatedConversation.map((message) => {
    //       if (message.role === "user" && Array.isArray(message.content)) {
    //         return {
    //           role: "user",
    //           content: message.content
    //             .filter((item) => item.type === "text")
    //             .map((item) => item.text)
    //             .join("\n"),
    //         };
    //       }
    //       return message;
    //     });
    //   }

    //   processedConversation = updatedConversation;
    //   finalConversationForState = newConversation;
    // }
    let conversationForAPI = {
        ...localState,
        messages: localState.messages.map((message) => {
          // Handle simple text messages
          if (Array.isArray(message.content)) {
            // Only handle texts for now
            return {
              role: message.role,
              content: message.content
              .filter((item) => item.type === "text")
              .map((item) => item.data)
              .join("\n"),
            };
            // TODO handle images and files here
          }
          return message;
        })
    };

    // === COMMON PROCESSING FOR ALL OPERATIONS ===
    console.log("Sending message with state", conversationForAPI.messages);
    // Prepare system prompt
    let systemPromptAPI = localState.messages[0].role == "system"
      ? localState.messages[0].content.data
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

    if (conversationForAPI.settings.arcana?.id !== "") {
      conversationForAPI.settings.arcana["limit"] = 3
      // TODO add arcana limit in settingsPanel
    }

    // Pushing message into conversation history
    setLocalState((prev) => ({
      ...prev,
      // Add two new placeholder messages
      messages: [
        ...prev.messages,
        { role: "assistant", content: [{ type: "text", data: "" }] },
        { role: "user", content: [{ type: "text", data: "" }] },
      ],
    }));

    // Stream assistant response into localState
    async function getChatChunk() {
      let currentResponse = "";
      for await (const chunk of chatCompletions(conversationForAPI, timeout)) {
        currentResponse += chunk;
        // UI update happens here in the caller
        setLocalState(prev => {
          const messages = [...prev.messages];
          messages[messages.length - 2] = {
            role: "assistant",
            content: [
              { type: "text", data: currentResponse }
            ]
          };
          return { ...prev, messages };
        });
      }
      return currentResponse;
    }
    const response = await getChatChunk();
    // Handle errors
    if (response === 401) {
      // TODO clean up localState
      openModal("errorSessionExpired")
    } else if (response === 413) {
      // TODO clean up localState
      openModal("errorBadRequest")
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
      setLocalState((prevState) => ({
        ...prevState,
        title,
      }));
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

    // // Edit last assistant message with response:
    // NOT NEEDED ANYMORE THANKS TO getChatChunk
    // setLocalState((prev) => {
    //   const messages = [...prev.messages];
    //   messages[messages.length - 2] = { role: "assistant", content: response }
    //   return { ...prev, messages };
    // });

    // Generate title when message stored in local
    // generateTitle(
    //   localState.messages,
    // )

    // Original conversation with "info" objects (for local state)
    // const messages = finalConversationForState;
    // // Update conversation
    // const updatedMessages = [
    //   ...messages,
    //   { role: "assistant", content: response },
    // ];

    // // Clean conversation to avoid bloating
    // const cleanedMessages = updatedMessages.map((message) => {
    //   if (message.role === "user" && Array.isArray(message.content)) {
    //     return {
    //       role: "user",
    //       content: message.content.map((item) => {
    //         if (item.type === "video_url") {
    //           return {
    //             type: "video_url",
    //             video_url: {
    //               hasVideo: true,
    //               url: "",
    //             },
    //           };
    //         }
    //         return item;
    //       }),
    //     };
    //   }
    //   return message;
    // });

    // Clear loading states
    // dispatch(setLockConversation(false));
    // if (operationType === "new") {
    //   setLoading(false);
    //   setSelectedFiles([]);
    // } else {
    //   setLoadingResend(false);
    // }
  } catch (error) {
    // Handle errors
    // dispatch(setLockConversation(false));
    // if (operationType === "new") {
    //   setLoading(false);
    //   setSelectedFiles([]);
    // } else {
    //   setLoadingResend(false);
    // }

    // Handle different error types
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
