//Libraries
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans } from "react-i18next";

//Redux
import { setCountGlobal } from "../../Redux/actions/alertAction";
import { useDispatch, useSelector } from "react-redux";

//Assets
import icon_cross_sm from "../../assets/icons/cross_sm.svg";

//Components
import Prompt from "./Prompt";
import Responses from "./Responses";

//Variable
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

const Conversation = ({
  localState,
  setLocalState,
  modelsData,
  selectedFiles,
  setSelectedFiles,
  toggleAdvOpt,
  showAdvOpt,
  currentModel,
}) => {
  // Hooks
  const dispatch = useDispatch();

  // Redux state
  const countClose = useSelector((state) => state.count);

  // Local useState
  const [showModal, setShowModal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingResend, setLoadingResend] = useState(false);

  //Refs
  const textareaRef = useRef(null);

  //Functions
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;

      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

      textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
    }
  };

  useEffect(() => {
    if (countClose >= 3) {
      setShowModal(false);
    }
  }, [countClose]);

  const handleClose = () => {
    // Immediately hide the modal
    setShowModal(false);

    // Increment the global counter
    dispatch(setCountGlobal(countClose + 1));
  };

  return (
    <div
      className={`flex flex-col items-center w-full ${
        !showAdvOpt ? "desktop:w-[80%] py-1 mx-auto my-0" : "desktop:w-[60%] p-1"
      } h-full gap-2 sm:justify-between relative bg-bg_light dark:bg-bg_dark`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative w-[calc(100%-8px)] desktop:w-full border dark:border-border_dark rounded-xl shadow-md dark:shadow-dark bg-white dark:bg-bg_secondary_dark">
        {showModal && countClose < 3 && (
          // TODO store hallucination box separately
          <div className="w-[calc(100%-8px)] sticky select-none m-1 h-fit bg-white dark:bg-black p-2 rounded-xl flex justify-between items-center border dark:border-border_dark shadow-md dark:shadow-dark">
            <p className="dark:text-white text-black text-xs">
              <Trans i18nKey="description.note1" />
              <Link
                to="https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note6" />
                &nbsp;
              </Link>
              <Trans i18nKey="description.note2" />
              <Link
                to="https://datenschutz.gwdg.de/services/chatai"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note3" />
                &nbsp;
              </Link>
              <Trans i18nKey="description.note4" />
              <Link
                to="https://gwdg.de/imprint/"
                target="_blank"
                className="text-tertiary"
              >
                &nbsp;
                <Trans i18nKey="description.note5" />
              </Link>
              .
            </p>
            <img
              src={icon_cross_sm}
              alt="cross"
              className="h-[20px] w-[20px] cursor-pointer"
              onClick={handleClose}
            />
          </div>
        )}

        <Responses
          modelsData={modelsData}
          localState={localState}
          setLocalState={setLocalState}
          loading={loading}
          setSelectedFiles={setSelectedFiles}
          adjustHeight={adjustHeight}
          loadingResend={loadingResend}
          setLoadingResend={setLoadingResend}
          currentModel={currentModel}
        />
      </div>

      <Prompt
        localState={localState}
        setLocalState={setLocalState}
        modelsData={modelsData}
        loading={loading}
        currentModel={currentModel}
        selectedFiles={selectedFiles}
        setLoading={setLoading}
        setSelectedFiles={setSelectedFiles}
        toggleAdvOpt={toggleAdvOpt}
        adjustHeight={adjustHeight}
        loadingResend={loadingResend}
        showAdvOpt={showAdvOpt}
      />
    </div>
  );
};

export default Conversation;
