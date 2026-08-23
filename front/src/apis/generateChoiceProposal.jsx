import { getDefaultSettings } from "../utils/conversationUtils";
import { createBackendClient } from "./openaiClient";

export default async function generateChoiceProposal(history) {
  const defaultSettings = getDefaultSettings();
  const system = `
    Propose a set of sensible follow up prompts the user may submit based on the conversation history.

    Respond in the following JSON formats with **no extra text**:
    {
      "proposals": ["prompt 1", "prompt 2", ...]
    }

    I will input the conversation history including original system prompt, and input from user and assistant roles.
    If the last message asks to provide a choice, include these options as favorite answer choices.
    `;

  const schema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
      proposals: {
        type: "array",
        "items": {
          "type" : "string"
        },
        minItems: 1,
        maxItems: 3
      }
    },
    required: ["proposals"],
  };

  try {
    // Define openai object to call backend
    const openai = createBackendClient(20000);
  

    const params = {
      model: import.meta.env.VITE_PROPOSAL_GENERATION_MODEL || defaultSettings.model.id,
      messages: [
        {
          role: "system",
          content: system
        },
        { role: "user", content: history },
      ],
      temperature: 0,
      top_p: 1,
      extra_body: {guided_json: schema},
      stream: false,
    }

    const response = await openai.chat.completions.create(params);
    if (!response) throw new Error(response.statusText);
    const proposals = JSON.parse(response?.choices[0]?.message?.content)["proposals"] || []
    return proposals.sort().slice(0, 3);
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "";
    }
    console.error("Generate Choice Proposal Failed:", error);
    return "";
  }
}