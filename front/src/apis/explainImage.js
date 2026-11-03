import { createBackendClient } from "./openaiClient";

/**
 * Describe an image with the deployment's vision model. The image is passed as
 * a data URL so nothing leaves the browser except the chat completion request
 * handled by the normal backend proxy.
 */
export default async function explainImage({
  dataUrl,
  question = "Describe this image in detail. Mention any text in it verbatim.",
  timeout = 90000,
}) {
  if (!dataUrl) throw new Error("No image data provided");
  const model = import.meta.env.VITE_EXPLAIN_IMAGE_MODEL || "gemma-4-31b-it";
  const openai = createBackendClient(timeout);
  const response = await openai.chat.completions.create({
    model,
    stream: false,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  const text = response?.choices?.[0]?.message?.content;
  if (!text) throw new Error("The image model returned no description");
  return text.trim();
}
