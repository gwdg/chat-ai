import { getDefaultSettings } from "../utils/conversationUtils";
import OpenAI from "openai";

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
        }
      }
    },
    required: ["proposals"],
  };

  try {
    // Define base URL from config
    let baseURL = import.meta.env.VITE_BACKEND_ENDPOINT;
    try {
      // If absolute, parse directly
      baseURL = new URL(baseURL).toString();
    } catch {
      // If relative, resolve against current origin
      baseURL = new URL(baseURL, window.location.origin).toString();
    }

    // Define openai object to call backend
    const openai = new OpenAI({
      baseURL : baseURL,
      apiKey: null,
      dangerouslyAllowBrowser: true,
      timeout: 20000
    });
  

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
    return proposals.sort();
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "";
    }
    console.error("Generate Choice Proposal Failed:", error);
    return "";
  }
}