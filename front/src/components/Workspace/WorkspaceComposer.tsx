import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import Prompt from "../Prompt/Prompt";
import { loadFile, loadFileMeta } from "../../db";
import { getFileType, readFileAsBase64, readFileAsText } from "../../utils/attachments";
import { useToast } from "../../hooks/useToast";

type PromptPayload = {
  text: string;
  images: { type: "image"; data: string; mimeType: string }[];
  persona?: string;
};

function emptyDraftMessage() {
  return { role: "user", content: [{ type: "text", text: "" }] };
}

async function collectPromptPayload(localState: any): Promise<PromptPayload> {
  const lastMessage = localState?.messages?.[localState.messages.length - 1];
  const content = Array.isArray(lastMessage?.content) ? lastMessage.content : [];
  const text = typeof content[0]?.text === "string" ? content[0].text : "";
  const extraText: string[] = [];
  const images: PromptPayload["images"] = [];

  for (const item of content.slice(1)) {
    if (item?.type !== "file" || !item.fileId) continue;
    const meta = await loadFileMeta(item.fileId);
    const file = await loadFile(item.fileId);
    if (!meta || !file) continue;
    const fileType = getFileType(meta);
    if (fileType === "image") {
      const dataUrl = await readFileAsBase64(file);
      const match = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl);
      if (match) {
        images.push({ type: "image", data: match[2], mimeType: match[1] });
      }
      continue;
    }
    if (fileType === "pdf" || fileType === "docx" || fileType === "audio" || fileType === "video") {
      extraText.push(
        `[Attached ${fileType}: ${meta.name}. Use the file tools to inspect files inside the workspace instead.]`,
      );
      continue;
    }
    try {
      const fileText = await readFileAsText(file);
      extraText.push(`[Attached file: ${meta.name}]\n${fileText}`);
    } catch {
      extraText.push(`[Attached file: ${meta.name}]`);
    }
  }

  return {
    text: [text, ...extraText].filter(Boolean).join("\n\n"),
    images,
    persona:
      localState?.messages?.[0]?.content?.[0]?.text &&
      typeof localState.messages[0].content[0].text === "string"
        ? localState.messages[0].content[0].text
        : undefined,
  };
}

export default function WorkspaceComposer({
  draftState,
  setDraftState,
  userData,
  modelsData,
  loading,
  onAbort,
  onSend,
  workspaceName,
}: {
  draftState: any;
  setDraftState: (state: any) => void;
  userData?: any;
  modelsData?: any;
  loading: boolean;
  onAbort: () => void;
  onSend: (payload: PromptPayload) => void;
  workspaceName: string;
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();

  const sendMessage = useCallback(
    async ({ localState, setLocalState }: any) => {
      try {
        const payload = await collectPromptPayload(localState);
        if (!payload.text.trim() && payload.images.length === 0) return;
        onSend(payload);
        // Reset the composer right away; the transcript renders the user turn
        // from the agent runtime so there is no duplicate optimistic message.
        setLocalState((previous: any) => ({
          ...previous,
          messages: [
            ...previous.messages.slice(0, -1),
            emptyDraftMessage(),
          ],
        }));
      } catch (error) {
        console.error("Could not prepare the workspace prompt", error);
        notifyError(t("workspace.attachment_error"));
      }
    },
    [notifyError, onSend, t],
  );

  return (
    <div className="w-full px-2 pb-2 md:px-4 md:pb-4">
      <Prompt
        localState={draftState}
        setLocalState={setDraftState}
        userData={userData}
        modelsData={modelsData}
        sendMessage={sendMessage}
        loading={loading}
        onAbort={onAbort}
        placeholder={t("workspace.composer_placeholder", { name: workspaceName })}
      />
    </div>
  );
}
