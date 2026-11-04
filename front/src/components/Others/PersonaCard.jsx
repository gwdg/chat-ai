import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "@carbon/icons-react";

import { useImportConversation } from "../../hooks/useImportConversation";
import { useToast } from "../../hooks/useToast";
import {
  fetchPersona,
  getCachedPersona,
  loadPersona,
} from "../../utils/personaCatalog";

function fallbackTitle(path) {
  const filename = String(path || "").split("/").pop() || "";
  return filename.replace(/\.json$/i, "").replace(/[-_]+/g, " ");
}

export default function PersonaCard({ path }) {
  const { t } = useTranslation();
  const importConversation = useImportConversation();
  const { notifyError } = useToast();
  const [persona, setPersona] = useState(() => getCachedPersona(path));
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (persona) return undefined;
    let cancelled = false;
    loadPersona(path)
      .then((loaded) => {
        if (!cancelled) setPersona(loaded);
      })
      .catch(() => {
        // The start button still tries to load the persona on click.
      });
    return () => {
      cancelled = true;
    };
  }, [path, persona]);

  const handleStart = async () => {
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

  const title = persona?.title || fallbackTitle(path);
  const description = persona?.description || "";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-200/60 p-3">
      <div className="flex items-start gap-2">
        <Bot size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-base-content">{title}</p>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-base-content/70">
              {description}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-accent btn-sm w-fit gap-2"
        onClick={handleStart}
        disabled={starting}
        aria-label={t("persona.startChatWith", { title })}
      >
        <Bot size={16} />
        {starting ? t("persona.startingChat") : t("persona.startChat")}
      </button>
    </div>
  );
}
