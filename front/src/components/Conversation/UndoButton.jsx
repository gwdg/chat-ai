import { useTranslation } from "react-i18next";
import Tooltip from "../Others/Tooltip";
import icon_undo from "../../assets/icons/undo.svg";

export default function UndoButton ({localState, setLocalState}) {
  const { t } = useTranslation();
  const loading = false; // TODO handle loading

  // Function to handle retry of last message
  const handleUndo = (e) => {
    e.preventDefault();

    // Find the last actual user-assistant pair (skip info objects)
    // let lastResponseIndex = -1;
    // for (let i = localState.responses.length - 1; i >= 0; i--) {
    //   if (!localState.responses[i]?.info) {
    //     lastResponseIndex = i;
    //     break;
    //   }
    // }

    // // If no actual response found, return early
    // if (lastResponseIndex === -1) {
    //   return;
    // }

    // const lastResponse = localState.responses[lastResponseIndex];

    // // Set prompt to last response's prompt
    // setLocalState((prevState) => ({
    //   ...prevState,
    //   prompt: lastResponse.prompt,
    // }));

    // Handle any images from last response
    // if (lastResponse?.images?.length > 0) {
    //   const imageFileList = convertBase64ArrayToImageList(lastResponse.images);
    //   setSelectedFiles((prevFiles) => [...prevFiles, ...imageFileList]);
    // }

    // // Handle any audio files from last response
    // if (lastResponse?.audioFiles?.length > 0) {
    //   const audioFileList = lastResponse.audioFiles.map((audioFile) => ({
    //     name: audioFile.name,
    //     type: "audio",
    //     size: audioFile.size,
    //     text: audioFile.data, // raw base64
    //     format: audioFile.format,
    //   }));
    //   setSelectedFiles((prevFiles) => [...prevFiles, ...audioFileList]);
    // }

    // // Handle any video files from last response
    // if (lastResponse?.videos?.length > 0) {
    //   const videoFileList = lastResponse.videos.map((videoFile, index) => ({
    //     name: `video_${index + 1}`,
    //     type: "video",
    //     size: 0, // We don't have size info from the response
    //     text: videoFile.video_url.url,
    //   }));
    //   setSelectedFiles((prevFiles) => [...prevFiles, ...videoFileList]);
    // }

    // // Only handle text files if they were actually part of the original request
    // // Check if the original conversation message had text files
    // const originalUserMessage = localState.messages.find(
    //   (msg, idx) =>
    //     msg.role === "user" &&
    //     Array.isArray(msg.content) &&
    //     msg.content.some(
    //       (item) =>
    //         item.type === "text" && item.text.includes(lastResponse.prompt)
    //     )
    // );

    // if (originalUserMessage && lastResponse?.textFiles?.length > 0) {
    //   const textFileList = lastResponse.textFiles.map((file) => {
    //     if (file.fileType === "pdf") {
    //       return {
    //         ...file,
    //         content: file.content,
    //       };
    //     }
    //     return file;
    //   });
    //   setSelectedFiles((prevFiles) => [...prevFiles, ...textFileList]);
    // }

    // // Rest of the function remains the same...
    // setTimeout(() => {
    //   adjustHeight();
    // }, 0);

    // // Conversation trimming logic remains the same...
    // const originalConversation = [...localState.messages];
    // let pairsToKeep = 0;
    // for (let i = 0; i < lastResponseIndex; i++) {
    //   if (!localState.responses[i]?.info) {
    //     pairsToKeep++;
    //   }
    // }

    // const filteredConversation = localState.messages.filter(
    //   (message) => message.role !== "info"
    // );

    // const slicedFiltered = filteredConversation.slice(0, pairsToKeep * 2 + 1);

    // let newMessages = [];
    // let filteredIndex = 0;

    // if (slicedFiltered.length === 0) {
    //   newMessages = originalConversation.filter(
    //     (message) => message.role === "system" || message.role === "info"
    //   );
    // } else {
    //   for (const originalMessage of originalConversation) {
    //     if (originalMessage.role === "info") {
    //       const lastKeptMessage = slicedFiltered[slicedFiltered.length - 1];
    //       const lastKeptOriginalIndex =
    //         originalConversation.indexOf(lastKeptMessage);
    //       const currentOriginalIndex =
    //         originalConversation.indexOf(originalMessage);

    //       if (currentOriginalIndex <= lastKeptOriginalIndex) {
    //         newMessages.push(originalMessage);
    //       }
    //     } else {
    //       if (
    //         filteredIndex < slicedFiltered.length &&
    //         originalMessage === slicedFiltered[filteredIndex]
    //       ) {
    //         newMessages.push(originalMessage);
    //         filteredIndex++;
    //       }
    //     }
    //   }
    // }

    // const newResponses = localState.responses.slice(0, lastResponseIndex);
    setLocalState((prevState) => ({
      ...prevState,
      messages: localState.messages.slice(0, -2),
    }));
  };

  return (
    <Tooltip text={t("description.undo")}>
      <button
        className="h-[26px] w-[26px] cursor-pointer"
        onClick={handleUndo}
        disabled={loading} // TODO handle loading
      >
        <img
          className="cursor-pointer h-[26px] w-[26px]"
          src={icon_undo}
          alt="undo"
        />
      </button>
    </Tooltip>
  );
};
