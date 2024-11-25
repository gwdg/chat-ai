import Prompt from "../Prompt";

function ChatWindow({ modelSettings, modelList, onModelChange }) {
  return (
    <Prompt
      modelSettings={modelSettings}
      modelList={modelList}
      onModelChange={onModelChange}
    />
  );
}

export default ChatWindow;
