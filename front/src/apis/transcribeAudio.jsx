// Speech-to-text through the back end (Whisper at GWDG). The service picks
// the model by URL, but the documented name is sent anyway.
const TRANSCRIPTION_MODEL = "whisper-large-v2";

export default async function transcribeAudio(
  wavBlob,
  { language = "de", signal } = {}
) {
  const formData = new FormData();
  formData.append("file", wavBlob, "dictation.wav");
  formData.append("model", TRANSCRIPTION_MODEL);
  formData.append("language", language);

  const response = await fetch(
    `${import.meta.env.VITE_BACKEND_ENDPOINT}/audio/transcriptions`,
    { method: "POST", body: formData, signal }
  );
  if (!response.ok) {
    throw new Error(`Transcription failed with status ${response.status}`);
  }
  const { text } = await response.json();
  return text;
}
