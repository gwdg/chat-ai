import { useState, useEffect} from "react";
import { ThumbsUp, ThumbsDown, MessageCircleReply, MessageCircleWarning } from "lucide-react";
import { useSendMessage } from "../../../hooks/useSendMessage";
import i18n from "i18next";
import { memo } from 'react';

export default function FeedbackButtons({
  localState,
  setLocalState,
  message_index,
  setFeedbackMode,
  sendFeedbackFunc
}) {
  const sendMessage = useSendMessage();
  const msg = localState.messages[message_index];

  const sendFeedbackThumbsUp = async () => {
    sendFeedbackFunc(msg?.feedback?.rating == 1 ? undefined : 1, msg?.feedback?.comment, msg?.feedback?.result);
  };

  const sendFeedbackThumbsDown = async () => {
    sendFeedbackFunc(msg?.feedback?.rating == -1 ? undefined : -1, msg?.feedback?.comment, msg?.feedback?.result);
  };

  const sendFeedback = async () => {
    //console.log(msg.feedback);
    sendFeedbackFunc(msg?.feedback?.rating, msg?.feedback?.comment, msg?.feedback?.result);
  };

  const editFeedback = () => {
    setFeedbackMode(true);
  };

  return (
    <div  className="group flex justify-between mt-1 gap-2">
    <button onClick={sendFeedbackThumbsUp} title={i18n.t("feedback.thumbsup")}>
      <ThumbsUp
        className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.rating == 1 ? "text-[#FF0000]" : "text-[#009EE0]"}`}
        alt="feedback.thumbsup"
      />
    </button>
    <button onClick={sendFeedbackThumbsDown} title={i18n.t("feedback.thumbsdown")}>
      <ThumbsDown
        className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.rating == -1 ? "text-[#FF0000]" : "text-[#009EE0]"}`}
        alt="feedback.thumbsdown"
      />
    </button>
    <button onClick={editFeedback} title={i18n.t("feedback.send")}>      
      <MessageCircleReply
        className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.comment ? "text-[#FF0000]" : "text-[#009EE0]"}`}
        alt="feedback.send"
      />
    </button>
    </div>
  );
}
