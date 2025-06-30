/* eslint-disable no-unused-vars */
import { setIsResponding } from "../Redux/reducers/conversationsSlice";
import { editMemory, addMemory } from "../Redux/reducers/userMemorySlice";

const handleLLMResponse = async ({
  // === OPERATION CONFIG ===
  operationType, // 'new', 'resend', 'edit'
  index = null,
  editedText = null,
  updatedConversation = null,

  // === REACT STATE & DISPATCHERS ===
  dispatch,
  localState,
  updateLocalState,
  setLocalState,
  setLoading = null, // only for 'new'
  setLoadingResend = null, // only for 'resend' and 'edit'

  // === FILES (only for 'new' operation) ===
  selectedFiles = [],
  setSelectedFiles = null,

  // === EXTERNAL DATA ===
  modelList,
  memories,
  isArcanaSupported,

  // === EXTERNAL FUNCTIONS ===
  updateMemory,
  fetchLLMResponse,
  notifyError,
  notifySuccess,
  setShowModalSession,
  setShowBadRequest,
  timeoutTime
}) => {
  // Set loading state
  dispatch(setIsResponding(true));
  if (operationType === "new") {
    setLoading(true);
  } else {
    setLoadingResend(true);
  }

  try {
    let processedConversation;
    let finalConversationForState; // For local state updates

    if (operationType === "new") {
      // === NEW MESSAGE LOGIC (from getRes) ===

      // Check model support first
      const imageSupport = modelList.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("image")
      );
      const videoSupport = modelList.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("video")
      );

      // Process conversation based on image/video support
      processedConversation = updatedConversation;
      if (!imageSupport && !videoSupport) {
        processedConversation = updatedConversation.map((message) => {
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
          (file) => file.type !== "image" && file.type !== "video"
        );

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
          fileType: "text",
          content:
            file.fileType === "pdf"
              ? `${file.name}: ${file.processedContent}`
              : `${file.name}: ${file.content}`,
          type: "text",
          size: file.size,
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
        if (!currentPrompt || currentPrompt?.trim() === "") {
          notifyError("Invalid or empty prompt at the specified index.");
          dispatch(setIsResponding(false));
          setLoadingResend(false);
          return;
        }
      }

      // Get existing files
      let imageFiles = [];
      let textFiles = [];
      if (localState.responses[index]?.images?.length > 0) {
        imageFiles = localState.responses[index]?.images;
      }
      if (localState.responses[index]?.textFiles?.length > 0) {
        textFiles = localState.responses[index]?.textFiles;
      }

      // Reconstruct conversation
      const originalConversation = [...localState.conversation];

      // Count actual user-assistant pairs in responses (excluding info objects)
      let actualPairIndex = 0;
      for (let i = 0; i <= index; i++) {
        if (!localState.responses[i]?.info) {
          if (i === index) break;
          actualPairIndex++;
        }
      }

      // Filter out info messages to do proper slicing
      const filteredConversation = localState.conversation.filter(
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

      // Prepare new message content based on whether there are images or text files
      if (imageFiles?.length > 0 || textFiles?.length > 0) {
        // Start with the prompt text
        const newPromptContent = [
          {
            type: "text",
            text: currentPrompt,
          },
        ];

        // Add images if they exist (keeping the original image structure)
        if (imageFiles?.length > 0) {
          newPromptContent.push(...imageFiles);
        }

        // Add text content if text files exist
        if (textFiles?.length > 0) {
          // Process all text files and append their content
          const textContent = textFiles
            .map((file) => file.content)
            .join("\n\n");

          // Only add if there's actually content
          if (textContent.trim()) {
            newPromptContent.push({
              type: "text",
              text: textContent,
            });
          }
        }

        newConversation.push({ role: "user", content: newPromptContent });
      } else {
        // If no attachments, just use the text prompt
        newConversation.push({ role: "user", content: currentPrompt });
      }

      // Update local state with new response entry
      if (imageFiles?.length > 0 || textFiles?.length > 0) {
        setLocalState((prevState) => ({
          ...prevState,
          responses: [
            ...prevState.responses,
            {
              prompt: currentPrompt,
              images: imageFiles,
              textFiles: textFiles,
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
      const imageSupport = modelList.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("image")
      );
      const videoSupport = modelList.some(
        (modelX) =>
          modelX.name === localState.settings["model-name"] &&
          modelX.input.includes("video")
      );

      // Create updated conversation array for processing - REMOVE "info" role objects
      let updatedConversation = [...newConversation].filter(
        (message) => message.role !== "info"
      );

      // If model doesn't support images/videos, remove image/video content
      if (!imageSupport && !videoSupport) {
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

    // Fetch LLM response
    const response = await fetchLLMResponse(
      finalConversationForState, // Original conversation with "info" objects (for local state)
      finalSystemPrompt,
      localState.settings.model,
      localState.settings.temperature,
      localState.settings.top_p,
      localState.arcana,
      setLocalState,
      setShowModalSession,
      setShowBadRequest,
      conversationForAPI, // Filtered conversation without "info" objects (for API)
      isArcanaSupported,
      timeoutTime
    );

    // Update memory if necessary
    try {
      if (localState.settings.memory >= 2) {
        const memoryResponse = await updateMemory(
          finalConversationForState,
          memories
        );
        const cleanedResponse = memoryResponse.replace(/,(\s*[}$])/g, "$1");
        const jsonResponse = JSON.parse(cleanedResponse);
        if (jsonResponse.store) {
          const memoryText = jsonResponse.memory_sentence.trim();
          if (jsonResponse.replace) {
            const line_number = jsonResponse.line_number - 1
            dispatch(editMemory({ index: line_number, text: memoryText }));
            console.log("Edited memory:", memoryText);
          } else {
            dispatch(addMemory({ text: memoryText }));
            console.log("New memory:", memoryText);
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
      notifyError(error.message);
    } else {
      notifyError("An unknown error occurred");
    }
  }
};

export default handleLLMResponse;
