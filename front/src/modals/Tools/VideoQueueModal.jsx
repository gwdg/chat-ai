import { useTranslation } from "react-i18next";
import BaseModal from "../BaseModal";
import VideoQueuePreview from "../../components/SettingsPanel/VideoQueuePreview";

export default function VideoQueueModal({ isOpen, onClose, videoQueue }) {
  const { t } = useTranslation();
  const jobs = videoQueue?.jobs || [];
  const processing = videoQueue?.processingCount || 0;
  const ready = videoQueue?.readyCount || 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      titleKey="settings.video_queue_modal_title"
      maxWidth="max-w-3xl"
    >
      <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
        {t("settings.video_queue_modal_subtitle", {
          processing,
          ready,
        })}
      </p>

      <VideoQueuePreview jobs={jobs} onDownload={() => {}} />
    </BaseModal>
  );
}
