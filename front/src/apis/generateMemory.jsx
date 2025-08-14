import { getDefaultSettings } from "../utils/conversationUtils";

export default async function generateMemory(conversation, memories) {
  const defaultSettings = getDefaultSettings();
  const memoryPrompt = `
    Determine whether the *new user message* below contains any **new personal information**
    worth storing for future conversations—that is, information **not already stored** or that **contradicts or updates** existing memory.

    You must:
    - Identify any **new** personal detail not already captured in the memory list.
    - Detect if the **new message contradicts or updates** something already stored (e.g., changed preferences, updated projects).
    - Do **not** store paraphrased duplicates of existing memory.

    Look for personal details such as: name, nickname, pronouns, projects, preferences,
    interests, dietary habits, location, goals, or any other meaningful context.
    Express findings in third person, referring to "the user".

    Compare the **meaning**, not just the wording.

    Existing memory list:
    ${memories.map(({ id, text }, i) => `${i + 1}. ${text}`).join('\n')}

    Here is the new user message:  
    "${conversation.at(-1).content}"

    Respond in one of the following JSON formats with **no extra text**:

    If no new or updated info is found:
    {
      "store": false,
      "memory_sentence": "",
      "replace": false,
      "line_number": 0
    }

    If new personal information is found:
    {
      "store": true,
      "memory_sentence": "<the new personal information>",
      "replace": false,
      "line_number": 0
    }

    If an existing memory is **contradicted** or **needs updating**, provide the updated info and the line number:
    {
      "store": true,
      "memory_sentence": "<the updated information>",
      "replace": true,
      "line_number": <line number to replace, starting from 1>
    }
    `;


  const memoryUpdateSchema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
      store: {
        type: "boolean",
      },
      memory_sentence: {
        type: "string",
      },
      replace: {
        type: "boolean",
      },
      line_number: {
        type: "integer",
        minimum: 0,
      },
    },
    required: ["store", "memory_sentence", "replace", "line_number"],
  };

  try {
    // TODO Replace with openai or chatCompletions
    const baseURL = import.meta.env.VITE_BACKEND_ENDPOINT + "/chat/completions"
    const response = await fetch(baseURL, {
      method: "post",
      headers: { "Content-type": "application/json" },
      body: JSON.stringify({
        model: defaultSettings.model,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Here is the current memory list:\n" +
              memories.map((memory) => memory.text).join("\n"),
          },
          { role: "user", content: memoryPrompt },
        ],
        temperature: 0,
        top_p: 1,
        extra_body: { guided_json: memoryUpdateSchema },
      }),
    });

    if (!response.ok) throw new Error(response.statusText);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let memory = "";
    let streamComplete = false;

    // Stream response until complete
    while (!streamComplete) {
      const { value, done } = await reader.read();
      if (done) {
        streamComplete = true;
        break;
      }
      memory += decoder.decode(value, { stream: true });
    }
    return memory?.trim();
  } catch (error) {
    // Handle AbortError specifically
    if (error.name === "AbortError") {
      return "";
    }
    console.error("Memory update failed:", error);
    return "";
  }
}