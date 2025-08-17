import { useSelector, useDispatch } from "react-redux";  
import sendMessage from "../utils/sendMessage";
import { useModal } from "../modals/ModalContext";
import { useToast } from "./useToast";
import { selectTimeout } from "../Redux/reducers/userSettingsReducer";

export function useSendMessage() {
  const dispatch = useDispatch();
  const { openModal } = useModal();
  const { notifyError, notifySuccess } = useToast();
  const timeout = useSelector(selectTimeout);

  return ({localState, setLocalState}) => {
    sendMessage({
      localState,
      setLocalState,
      dispatch,
      openModal,
      notifyError,
      notifySuccess,
      timeout,
    });
  };
}