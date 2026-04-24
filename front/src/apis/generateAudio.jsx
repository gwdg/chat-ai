function createAudioFile(base64Data, format = "wav", filename = null) {
  const cleanedBase64 = base64Data.includes(",")
    ? base64Data.split(",").pop()
    : base64Data;
  const byteCharacters = atob(cleanedBase64 || "");
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const normalizedFormat = (format || "wav").toLowerCase();
  const mimeType =
    normalizedFormat === "mp3" ? "audio/mpeg" : `audio/${normalizedFormat}`;
  const safeFilename = filename || `speech.${normalizedFormat}`;

  return new File([byteArray], safeFilename, { type: mimeType });
}

export default async function generateAudio(
  input,
  model,
  voice,
  timeout = 90000,
  language = "en",
 ) {
  if (typeof input !== "string" || input.trim() === "") {
    return null;
  }

  const timeoutAPI =
    timeout >= 5000 && timeout <= 900000 ? Math.min(timeout, 120000) : 90000;

  let audioPayload;

  let baseURL = import.meta.env.VITE_BACKEND_ENDPOINT;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutAPI);

    const response = await fetch(`${baseURL}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: input.trim(),
        voice,
        response_format: "mp3",
        language,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    audioPayload = {
      data: base64,
      format: "mp3",
      filename: `speech.mp3`,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return null;
    }
    console.error("Audio generation failed:", error);
    return null;
  }

  if (!audioPayload?.data) {
    return null;
  }
  
  const file = createAudioFile(
    audioPayload.data,
    audioPayload.format,
    audioPayload.filename,
  );
  
  return file;
}