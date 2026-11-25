import { ThumbsUp, ThumbsDown, MessageCircleReply } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Rating controls under an assistant message.
 *
 * A click posts the rating through `sendFeedbackFunc`, which stores it on the
 * message and sends it to the deployment's feedback receiver; it never starts a
 * model turn. Clicking the same thumb again clears the rating.
 */
export default function FeedbackButtons({
  localState,
  message_index,
  setFeedbackMode,
  sendFeedbackFunc,
}) {
  const { t } = useTranslation();
  const msg = localState.messages[message_index];

  const sendFeedbackThumbsUp = () => {
    sendFeedbackFunc(
      msg?.feedback?.rating == 1 ? undefined : 1,
      msg?.feedback?.comment,
      msg?.feedback?.result,
    );
  };

  const sendFeedbackThumbsDown = () => {
    sendFeedbackFunc(
      msg?.feedback?.rating == -1 ? undefined : -1,
      msg?.feedback?.comment,
      msg?.feedback?.result,
    );
  };

  const editFeedback = () => {
    setFeedbackMode(true);
  };

  return (
    <div className="group flex justify-between mt-1 gap-2" data-guide="feedback">
      <button type="button" onClick={sendFeedbackThumbsUp} title={t("feedback.thumbsup")}>
        <ThumbsUp
          className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.rating == 1 ? "text-error" : "text-accent"}`}
          alt={t("feedback.thumbsup")}
        />
      </button>
      <button type="button" onClick={sendFeedbackThumbsDown} title={t("feedback.thumbsdown")}>
        <ThumbsDown
          className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.rating == -1 ? "text-error" : "text-accent"}`}
          alt={t("feedback.thumbsdown")}
        />
      </button>
      <button type="button" onClick={editFeedback} title={t("feedback.send")}>
        <MessageCircleReply
          className={`h-[22px] w-[22px] cursor-pointer ${msg?.feedback?.comment ? "text-error" : "text-accent"}`}
          alt={t("feedback.send")}
        />
      </button>
    </div>
  );
}
