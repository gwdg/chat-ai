/* eslint-disable no-unused-vars */
import { setIsResponding } from "../Redux/reducers/conversationsSlice";
import { editMemory, addMemory } from "../Redux/reducers/userMemorySlice";
import { chatCompletions } from "../apis/chatCompletions";
import generateMemory from "../apis/generateMemory";
import generateTitle from "../apis/generateTitle";
import { useToast } from "../hooks/useToast";

const sendMessage = async ({
  localState,
  setLocalState,
  modelsData,
  openModal,
  // === OPERATION CONFIG ===
  operationType, // 'new', 'resend', 'edit'
  index = null,
  editedText = null,
  updatedConversation = null,
  notifyError,
  notifySuccess,

  // === REACT STATE & DISPATCHERS ===
  dispatch,
  setLoading = null, // only for 'new'
  setLoadingResend = null, // only for 'resend' and 'edit'

  // === FILES (only for 'new' operation) ===
  selectedFiles = [],
  setSelectedFiles = null,

  // === EXTERNAL DATA ===
  memories,

  // === EXTERNAL FUNCTIONS ===
  timeoutTime,
}) => {
  // Update partial local state while preserving other values
  const updateLocalState = (updates) => {
    setLocalState((prev) => ({
      ...prev,
      ...updates,
    }));
  };
  
  // Set loading state
  dispatch(setIsResponding(true));
  if (operationType === "new") {
    setLoading(true);
  } else {
    setLoadingResend(true);
  }

  let processedConversation = updatedConversation;

  try {
    const isArcanaSupported = (localState.settings.model?.input?.includes("arcana") || false)    
    let finalConversationForState; // For local state updates

    if (operationType === "new") {
      // === NEW MESSAGE LOGIC (from getRes) ===

      // Check model support first
      const imageSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("image")
      );
      const videoSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("video")
      );
      const audioSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("audio")
      );
      console.log("I am here");
      console.log(processedConversation);
      // Process conversation based on image/video/audio support
      if (!imageSupport && !videoSupport && !audioSupport) {
        processedConversation = processedConversation.map((message) => {
          if (message.role === "user" && Array.isArray(message.content)) {
            return {
              role: "user",
              content: message.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("\n"),
            };
          }
          return message;
        });
      }

      // Process selected files
      if (selectedFiles.length > 0) {
        const imageFiles = selectedFiles.filter(
          (file) => file.type === "image"
        );
        const videoFiles = selectedFiles.filter(
          (file) => file.type === "video"
        );
        const textFiles = selectedFiles.filter(
          (file) =>
            file.type !== "image" &&
            file.type !== "video" &&
            file.type !== "audio"
        );
        const audioFiles = selectedFiles.filter(
          (file) => file.type === "audio"
        );

        // Create content arrays for response storage
        const audioContent = audioFiles.map((audioFile) => ({
          type: "input_audio",
          input_audio: {
            data: audioFile.text, // Raw base64
            format: audioFile.format, // "wav" or "mp3"
          },
        }));

        const imageContent = imageFiles.map((imageFile) => ({
          type: "image_url",
          image_url: {
            url: imageFile.text,
          },
        }));

        const videoContent = videoFiles.map(() => ({
          type: "video_url",
          video_url: {
            url: "",
          },
        }));

        const textContent = textFiles.map((file) => ({
          name: file.name,
          fileType: file.fileType || "text",
          content:
            file.fileType === "pdf" ||
            file.fileType === "docx" ||
            file.fileType === "excel"
              ? `${file.name}: ${file.processedContent}`
              : `${file.name}: ${file.content}`,
          type: "text",
          size: file.size,
        }));

        // FIXED: Store audio files properly for resend functionality
        const audioFilesForStorage = audioFiles.map((audioFile) => ({
          name: audioFile.name,
          format: audioFile.format,
          data: audioFile.text, // Raw base64
          size: audioFile.size,
          type: "audio",
        }));

        // Add response entry with files
        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses,
            {
              prompt: prevState.prompt,
              images: imageContent,
              videos: videoContent,
              textFiles: textContent,
              audio: audioContent, // For API request format
              audioFiles: audioFilesForStorage, // For resend functionality
              response: "",
            },
          ],
        }));
      } else {
        // Add response entry without images
        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses,
            {
              prompt: prevState.prompt,
              response: "",
            },
          ],
        }));
      }

      // Clear prompt after processing
      updateLocalState({ prompt: "" });
      finalConversationForState = processedConversation;
    } else {
      // === RESEND/EDIT LOGIC ===

      // Validate index
      if (index < 0 || index >= localState.responses.length) {
        notifyError("Something went wrong");
        dispatch(setIsResponding(false));
        setLoadingResend(false);
        return;
      }

      // Get prompt based on operation
      let currentPrompt;
      if (operationType === "edit") {
        if (!editedText || !editedText?.trim()) {
          notifyError("Prompt cannot be empty!");
          dispatch(setIsResponding(false));
          setLoadingResend(false);
          return;
        }
        currentPrompt = editedText;
      } else {
        // resend
        currentPrompt = localState.responses[index]?.prompt;
        // if (!currentPrompt || currentPrompt?.trim() === "") {
        //   notifyError("Invalid or empty prompt at the specified index.");
        //   dispatch(setIsResponding(false));
        //   setLoadingResend(false);
        //   return;
        // }
      }

      // Get existing files from the response
      let imageFiles = [];
      let textFiles = [];
      let audioFiles = [];
      let audioFilesForStorage = [];

      if (localState.responses[index]?.images?.length > 0) {
        imageFiles = localState.responses[index]?.images;
      }
      if (localState.responses[index]?.textFiles?.length > 0) {
        textFiles = localState.responses[index]?.textFiles;
      }

      // FIXED: Handle audio files properly for resend
      if (localState.responses[index]?.audio?.length > 0) {
        audioFiles = localState.responses[index]?.audio; // For API format
      }
      if (localState.responses[index]?.audioFiles?.length > 0) {
        audioFilesForStorage = localState.responses[index]?.audioFiles; // For resend functionality
      }

      // Reconstruct conversation
      const originalConversation = [...localState.messages];

      // Count actual user-assistant pairs in responses (excluding info objects)
      let actualPairIndex = 0;
      for (let i = 0; i <= index; i++) {
        if (!localState.responses[i]?.info) {
          if (i === index) break;
          actualPairIndex++;
        }
      }

      // Filter out info messages to do proper slicing
      const filteredConversation = localState.messages.filter(
        (message) => message.role !== "info"
      );

      // Do the slice on filtered conversation using the actual pair index
      const slicedFiltered = filteredConversation.slice(
        0,
        actualPairIndex * 2 + 1
      );

      // Now reconstruct conversation with info messages back in their original positions
      let newConversation = [];
      let filteredIndex = 0;

      for (const originalMessage of originalConversation) {
        if (originalMessage.role === "info") {
          // Check if this info message should be included (appears before our cutoff)
          const lastKeptMessage = slicedFiltered[slicedFiltered.length - 1];
          const lastKeptOriginalIndex =
            originalConversation.indexOf(lastKeptMessage);
          const currentOriginalIndex =
            originalConversation.indexOf(originalMessage);

          if (currentOriginalIndex <= lastKeptOriginalIndex) {
            newConversation.push(originalMessage);
          }
        } else {
          // Non-info message - check if it's in our sliced array
          if (
            filteredIndex < slicedFiltered.length &&
            originalMessage === slicedFiltered[filteredIndex]
          ) {
            newConversation.push(originalMessage);
            filteredIndex++;
          }
        }
      }

      // Update responses
      let newResponses = [...localState.responses].slice(0, index);
      updateLocalState({ responses: newResponses });

      // Add small delay to ensure state updates properly
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Prepare new message content based on whether there are attachments
      if (
        imageFiles?.length > 0 ||
        textFiles?.length > 0 ||
        audioFiles?.length > 0
      ) {
        // Start with the prompt text
        const newPromptContent = [
          {
            type: "text",
            text: currentPrompt,
          },
        ];

        // Add images if they exist
        if (imageFiles?.length > 0) {
          newPromptContent.push(...imageFiles);
        }

        // Add audio if it exists
        if (audioFiles?.length > 0) {
          newPromptContent.push(...audioFiles);
        }

        // Add text content if text files exist
        if (textFiles?.length > 0) {
          // Process all text files and append their content
          const textContent = textFiles
            .map((file) => file.content)
            .join("\n\n");

          // Only add if there's actually content
          if (textContent.trim()) {
            newPromptContent[0].text += `\n${textContent}`;
          }
        }

        newConversation.push({ role: "user", content: newPromptContent });
      } else {
        // If no attachments, just use the text prompt
        newConversation.push({ role: "user", content: currentPrompt });
      }

      // Update local state with new response entry
      if (
        imageFiles?.length > 0 ||
        textFiles?.length > 0 ||
        audioFiles?.length > 0
      ) {
        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses,
            {
              prompt: currentPrompt,
              images: imageFiles,
              textFiles: textFiles,
              audio: audioFiles, // For API format
              audioFiles: audioFilesForStorage, // For resend functionality
              response: "",
            },
          ],
        }));
      } else {
        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses,
            {
              prompt: currentPrompt,
              response: "",
            },
          ],
        }));
      }

      // Process conversation for model support
      const imageSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("image")
      );
      const videoSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("video")
      );
      const audioSupport = modelsData.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("audio")
      );

      // Create updated conversation array for processing - REMOVE "info" role objects
      let updatedConversation = [...newConversation].filter(
        (message) => message.role !== "info"
      );

      // If model doesn't support images/videos/audio, remove multimedia content
      if (!imageSupport && !videoSupport && !audioSupport) {
        updatedConversation = updatedConversation.map((message) => {
          if (message.role === "user" && Array.isArray(message.content)) {
            return {
              role: "user",
              content: message.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("\n"),
            };
          }
          return message;
        });
      }

      processedConversation = updatedConversation;
      finalConversationForState = newConversation;
    }

    // === COMMON PROCESSING FOR ALL OPERATIONS ===

    // Filter out info messages only for API call
    const conversationForAPI = processedConversation.filter(
      (message) => message.role !== "info"
    );

    // Prepare system prompt with memory if enabled
    let finalSystemPrompt = localState.settings.systemPrompt;

    if (localState.settings.memory >= 1 && memories.length > 0) {
      const memoryContext = memories.map((memory) => memory.text).join("\n");
      const memorySection = `\n\n--- User Memory ---\nThe following information represents the user's preferences, important details, and context from previous conversations. Use this information when relevant to provide a more personalized and contextual response:\n\n${memoryContext}\n--- End User Memory ---`;
      finalSystemPrompt = finalSystemPrompt + memorySection;
    }

    if (localState.arcana?.id) {
      localState.arcana["limit"] = 1
    }

    // Fetch LLM response
    const response = await chatCompletions(
      finalSystemPrompt,
      localState,
      setLocalState,
      conversationForAPI, // Filtered conversation without "info" objects (for API)
      isArcanaSupported,
      timeoutTime
    );

    // Handle errors
    if (response === 401) {
      openModal("errorSessionExpired")
    } else if (response === 413) {
      openModal("errorBadRequest")
    }

    // Original conversation with "info" objects (for local state)
    const messages = finalConversationForState;
    // Update conversation
    const updatedMessages = [
      ...messages,
      { role: "assistant", content: response },
    ];

    // Clean conversation to avoid bloating
    const cleanedMessages = updatedMessages.map((message) => {
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

    // Save conversation to state
    setLocalState((prevState) => ({
      ...prevState,
      messages: cleanedMessages,
    }));

    // Generate title if conversation is new
    if (messages.length <= 2) {
      const title = await generateTitle(messages, {
        temperature: 0.2,
        top_p: 0.2,
      });

      setLocalState((prevState) => ({
        ...prevState,
        title,
      }));
    }

    // Update memory if necessary
    try {
      if (localState.settings.memory >= 2) {
        const memoryResponse = await generateMemory(
          finalConversationForState,
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

    // Clear loading states
    dispatch(setIsResponding(false));
    if (operationType === "new") {
      setLoading(false);
      setSelectedFiles([]);
    } else {
      setLoadingResend(false);
    }
  } catch (error) {
    // Handle errors
    dispatch(setIsResponding(false));
    if (operationType === "new") {
      setLoading(false);
      setSelectedFiles([]);
    } else {
      setLoadingResend(false);
    }

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
