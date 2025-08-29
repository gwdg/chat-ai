import { useSelector, useDispatch } from "react-redux";  
import sendMessage from "../utils/sendMessage";
import { useModal } from "../modals/ModalContext";
import { useToast } from "./useToast";
import { useFiles } from "../db";
import { readFileAsBase64, addAttachments, addTextAttachments, pasteAttachments, addAudioAttachment } from "../utils/attachments";

export function useAttachments() {
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const { saveFile } = useFiles();

  const handleAddAttachments = async ({ localState, setLocalState, selectedFiles }) => {
    await addAttachments({
      localState,
      setLocalState,
      notifyError,
      notifySuccess,
      selectedFiles,
      saveFile,
    });
  };

  const handleAddTextAttachments = async ({ localState, setLocalState, selectedFiles }) => {
    await addTextAttachments({
      localState,
      setLocalState,
      notifyError,
      notifySuccess,
      selectedFiles,
      saveFile,
    });
  };

  const handlePasteAttachments = async ({ localState, setLocalState, clipboardData }) => {
    await pasteAttachments({
      localState,
      setLocalState,
      notifyError,
      notifySuccess,
      clipboardData,
      saveFile,
    });
  };

  const handleRemoveAttachment = ({ localState, setLocalState, index }) => {
    setLocalState((prevState) => {
      const newMessages = [...prevState.messages];
      newMessages[prevState.messages.length - 1].content.splice(index + 1, 1);
      return {
        ...prevState,
        messages: newMessages,
      };
    });
  };

  const handleClearAttachments = ({ localState, setLocalState }) => {
    setLocalState((prevState) => {
      const newMessages = [...prevState.messages];
      newMessages[newMessages.length - 1].content = newMessages[newMessages.length - 1].content.slice(0, 1);
      return {
        ...prevState,
        messages: newMessages,
      };
    });
  };

  const handleAddAudioAttachment = async ({
    localState,
    setLocalState,
    audioBlob,
    type
  }) => {
    await addAudioAttachment({
      localState,
      setLocalState,
      notifyError,
      notifySuccess,
      audioBlob,
      type,
      saveFile
    });
  };

  const handleReadFileAsBase64 = async (file) => {
    console.log("File is ", file)
    return await readFileAsBase64(file);
  }

  // Return all attachment handlers
  return {
    addAttachments: handleAddAttachments,
    removeAttachment: handleRemoveAttachment,
    addAudioAttachment: handleAddAudioAttachment,
    clearAttachments: handleClearAttachments,
    addTextAttachments: handleAddTextAttachments,
    pasteAttachments: handlePasteAttachments,
    readFileAsBase64: handleReadFileAsBase64,
  };
}