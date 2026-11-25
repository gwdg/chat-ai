import { getExportData } from "./conversationUtils";

/**
 * The plain JSON export: every conversation with its messages and attachments,
 * the meta chat and the saved settings. It is the one export that needs no
 * passphrase, so the error screens can offer it without asking the reader
 * anything — the point there is to get a copy out before anyone clears storage.
 */

const pad = (value) => String(value).padStart(2, "0");

export const exportFileName = (extension, username = "user", now = new Date()) =>
  `${username}-chat-ai-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${extension}`;

/**
 * Writes the export straight to the download folder and returns its file name.
 * Throws when the local database cannot be read — a blocked or failed database
 * is exactly when this is offered, so callers must say why it did not work.
 */
export async function downloadLocalData({ username, userSettings } = {}) {
  const exportData = await getExportData();
  if (userSettings) exportData.user_settings = userSettings;
  const file = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.download = exportFileName("json", username);
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  return link.download;
}
