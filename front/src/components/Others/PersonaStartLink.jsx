import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "@carbon/icons-react";

import { useImportConversation } from "../../hooks/useImportConversation";
import { useToast } from "../../hooks/useToast";
import { fetchPersona } from "../../utils/personaCatalog";

export default function PersonaStartLink({ path, children }) {
  const { t } = useTranslation();
  const importConversation = useImportConversation();
  const { notifyError } = useToast();
  const [starting, setStarting] = useState(false);

  const handleClick = async (event) => {
    event.preventDefault();
    if (starting) return;
    setStarting(true);
    try {
      const { data } = await fetchPersona(path);
      await importConversation(data, false, null);
    } catch (error) {
      console.error("Failed to start persona chat", error);
      notifyError(t("persona.startError"));
      setStarting(false);
    }
  };

  return (
    <a
      href={`/persona/${path}`}
      onClick={handleClick}
      className="btn btn-accent btn-xs ml-1 inline-flex w-fit gap-1 align-middle"
      aria-busy={starting}
    >
      <Bot size={12} aria-hidden="true" />
      {starting ? t("persona.startingChat") : children || t("persona.startChat")}
    </a>
  );
}
