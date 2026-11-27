import { useContext } from "react";
import { useSelector, useDispatch } from "react-redux";  
import sendMessage from "../utils/sendMessage";
import { useModal } from "../modals/ModalContext";
import { useToast } from "./useToast";
import { MetaChatSendContext } from "../context/MetaChatContext";
import { ArcanaChatSendContext } from "../context/ArcanaChatContext";
import {
  selectAllMemories,
  selectDefaultMemoryGroup,
  selectGlobalMcpServers,
  selectMemoryGroups,
  selectMemoryMode,
  selectSetTitleOnce,
  selectSuggestUserPrompts,
  selectTimeout,
  selectMcpToolPolicy,
} from "../Redux/reducers/userSettingsReducer";
import { isFeatureEnabled } from "../config/deployment";

export function useSendMessage() {
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const timeout = useSelector(selectTimeout);
  const memories = useSelector(selectAllMemories);
  const globalMcpServers = useSelector(selectGlobalMcpServers);
  const memoryGroups = useSelector(selectMemoryGroups);
  const defaultMemoryGroup = useSelector(selectDefaultMemoryGroup);
  const memoryMode = useSelector(selectMemoryMode);
  const suggestUserPrompts = useSelector(selectSuggestUserPrompts);
  const setTitleOnce = useSelector(selectSetTitleOnce);
  const mcpToolPolicy = useSelector(selectMcpToolPolicy);
  const metaSendMessage = useContext(MetaChatSendContext);
  const arcanaSendMessage = useContext(ArcanaChatSendContext);

  if (metaSendMessage) return metaSendMessage;
  if (arcanaSendMessage) return arcanaSendMessage;

  // Make this async
  return async ({localState, setLocalState, formSubmission, speechMode = false}) => {
    const override = localState?.settings?.memory_mode_override;
    const effectiveMemoryMode =
      override === undefined || override === null || override === "default"
        ? memoryMode
        : [0, 1, 2].includes(Number(override))
          ? Number(override)
          : memoryMode;

    // A deployment or brand without the memories feature gets neither recall nor
    // learning, even if a stored profile still carries a memory mode.
    const memoriesEnabled = isFeatureEnabled("memories");
    const groupOverride = localState?.settings?.memory_group_override;
    const requestedGroup =
      groupOverride && groupOverride !== "default"
        ? groupOverride
        : defaultMemoryGroup;
    const effectiveMemoryGroup =
      requestedGroup === "default" ||
      memoryGroups.some((group) => group.id === requestedGroup)
        ? requestedGroup
        : "default";
    const groupMemories = memories.filter(
      (memory) => (memory.groupId ?? "default") === effectiveMemoryGroup,
    );

    try {
      await sendMessage({
        localState,
        setLocalState,
        memories: memoriesEnabled ? groupMemories : [],
        globalMcpServers,
        mcpToolPolicy,
        dispatch,
        openModal,
        notifyError,
        notifySuccess,
        timeout,
        memoryMode: memoriesEnabled ? effectiveMemoryMode : 0,
        memoryGroupId: memoriesEnabled ? effectiveMemoryGroup : "default",
        suggestUserPrompts,
        formSubmission,
        setTitleOnce,
        speechMode,
      });
    } finally {
      window.dispatchEvent(new Event("chatai:message-complete"));
    }
  };
}
