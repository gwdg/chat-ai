/* eslint-disable no-unused-vars */
//Libraries
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Trans } from "react-i18next";

//Redux
import { setCountGlobal } from "../../Redux/actions/alertAction";
import { useDispatch, useSelector } from "react-redux";

//Assets
import cross from "../../assets/cross.svg";

//Components
import Prompt from "./Prompt";
import Responses from "./Responses";

//Variable
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

const Conversation = ({
  modelList,
  selectedFiles,
  localState,
  isImageSupported,
  setSelectedFiles,
  setLocalState,
  setShowModelSession,
  setShowBadRequest,
  setShowFileModel,
  setShowMicModel,
  setShowHistoryModel,
  toggleAdvOpt,
  updateLocalState,
  updateSettings,
  clearHistory,
  notifySuccess,
  notifyError,
}) => {
  // Hooks
  const dispatch = useDispatch();

  // Redux state
  const countClose = useSelector((state) => state.count);

  // Local useState
  const [showModel, setShowModel] = useState(true);
  const [count, setCount] = useState(countClose);

  const [loading, setLoading] = useState(false);

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

  return (
    <div className="flex flex-col items-center mobile:w-full w-[60%] h-full gap-3 sm:justify-between relative p-2 bg-bg_light dark:bg-bg_dark">
      <div className="desktop:max-h-full flex-1 min-h-0 overflow-y-auto flex flex-col relative w-[calc(100%-12px)] mobile:w-full border dark:border-border_dark rounded-2xl shadow-lg dark:shadow-dark bg-white dark:bg-bg_secondary_dark">
        {showModel && count < 3 && (
          <div className="w-[calc(100%-16px)] sticky select-none m-2 h-fit bg-white dark:bg-black p-2 rounded-2xl flex justify-between items-center border dark:border-border_dark shadow-lg dark:shadow-dark">
            <p className="dark:text-white text-black">
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
              src={cross}
              alt="cross"
              className="h-[30px] w-[30px] cursor-pointer"
              onClick={() => {
                setShowModel(false);
                dispatch(setCountGlobal(count + 1));
                setCount((prevCount) => prevCount + 1);
              }}
            />
          </div>
        )}

        <Responses
          modelList={modelList}
          localState={localState}
          adjustHeight={adjustHeight}
          loading={loading}
          notifySuccess={notifySuccess}
          notifyError={notifyError}
          updateLocalState={updateLocalState}
          setLocalState={setLocalState}
          setShowModelSession={setShowModelSession}
          setShowBadRequest={setShowBadRequest}
          setSelectedFiles={setSelectedFiles}
          setShowHistoryModel={setShowHistoryModel}
          clearHistory={clearHistory}
          updateSettings={updateSettings}
          setShowFileModel={setShowFileModel}
        />
      </div>

      <Prompt
        modelList={modelList}
        isImageSupported={isImageSupported}
        localState={localState}
        toggleAdvOpt={toggleAdvOpt}
        loading={loading}
        setLoading={setLoading}
        updateLocalState={updateLocalState}
        setShowMicModel={setShowMicModel}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setLocalState={setLocalState}
        setShowModelSession={setShowModelSession}
        setShowBadRequest={setShowBadRequest}
        notifySuccess={notifySuccess}
        notifyError={notifyError}
        adjustHeight={adjustHeight}
      />
    </div>
  );
};

Conversation.defaultProps = {};

export default Conversation;
