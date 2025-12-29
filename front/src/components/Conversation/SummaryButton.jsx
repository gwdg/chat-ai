import { Edit } from "lucide-react";
import { useSendMessage } from "../../hooks/useSendMessage";
import i18n from "i18next";

export default function SummaryButton({
  localState,
  setLocalState
}) {
  const sendMessage = useSendMessage();

  const handleSummary = async () => {
    // Summarize messages before index
    let newState;
    let oldPrompt;
    setLocalState((prev) => {
      const newMessages = [...prev.messages];
      oldPrompt = newMessages[0].content[0].text;
      // FIXME not properly working
      newMessages[0].content[0].text = "You are a helpful assistant that tries to summarize our conversation into a crisp summary. Include all details needed to summarize the conversation accurately. You will not do ANYTHING else except summarizing our conversation, do not include boilerplate."      
      // newMessages.forEach((element) => {
      //   console.log(element.content[0].text);
      // });
      newMessages[newMessages.length-1].content[0].text = "Summarize our conversation now.";      
      newState = { ...prev, messages: newMessages }
      sendMessage({localState: newState, setLocalState});
      newMessages[0].content[0].text = oldPrompt;
      newMessages.splice(2);
      newMessages[1].content[0].text = "Please summarize our conversation so far";
      return { ...prev, messages: newMessages };
    });
  };

  return (
      <button onClick={handleSummary} title={i18n.t("common.summarize")}>
          <Edit
              className="h-[22px] w-[22px] cursor-pointer text-[#009EE0]"
              alt="edit_icon"
          />
      </button>
  );
}
