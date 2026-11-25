import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { selectShowTimestamps } from "../../Redux/reducers/userSettingsReducer";
import {
  formatFullTimestamp,
  formatMessageTimestamp,
} from "../../utils/conversationDates";

export default function MessageTimestamp({ message, align = "start", className = "" }) {
  const showTimestamps = useSelector(selectShowTimestamps);
  const { i18n } = useTranslation();

  if (!showTimestamps || !message?.createdAt) return null;

  const timestamp = new Date(message.createdAt);

  return (
    <time
      dateTime={timestamp.toISOString()}
      title={formatFullTimestamp(message.createdAt, i18n.language)}
      className={`block text-[11px] leading-none text-base-content/50 ${
        align === "end" ? "self-end pr-1" : ""
      } ${className}`}
    >
      {formatMessageTimestamp(message.createdAt, i18n.language)}
    </time>
  );
}
