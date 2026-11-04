import { AudioWaveform } from "lucide-react";
import { useTranslation } from "react-i18next";

import Tooltip from "../Others/Tooltip";

export default function SpeechModeButton({ onClick, disabled = false }) {
  const { t } = useTranslation();
  return (
    <Tooltip text={t("conversation.speech_mode_button")}>
      <button
        type="button"
        data-guide="speech-mode"
        className="btn btn-circle btn-sm h-[30px] w-[30px] min-h-0"
        onClick={onClick}
        disabled={disabled}
        aria-label={t("conversation.speech_mode_button")}
      >
        <AudioWaveform size={18} className="text-accent" />
      </button>
    </Tooltip>
  );
}
