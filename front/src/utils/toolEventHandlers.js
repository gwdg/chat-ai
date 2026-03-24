import { receiveFile } from "./attachments";

export function handleToolEvent(delta, process_block) {
  try {
    const toolCall = delta.tool_calls[0];
    if (!toolCall?.function?.name) return process_block;

    let arg = toolCall.function.arguments;
    if (typeof arg === "string") arg = JSON.parse(arg);

    const eventHandlers = {
      "tools.event": handleToolsEvent,
      "mcp.event": handleMCPEvent,
      "rscript.event": handleRScriptEvent,
      "websearch.event": handleWebSearchEvent,
      "arcana.event": handleArcanaEvent,
      "image.event": handleImageEvent,
      "video.event": handleVideoEvent,
      "audio.event": handleAudioEvent,
      "audio_transcription.event": handleAudioTranscriptionEvent,
    };

    const handler = eventHandlers[toolCall.function.name];
    if (handler) {
      return process_block + handler(arg);
    }
  } catch (err) {
    console.warn("Didn't understand: ", delta);
  }
  return process_block;
}

function handleToolsEvent(arg) {
  if (arg.event === "error") {
    return "Could not use tools: " + String(arg?.msg) + "\n\n";
  }
  return "";
}

function handleMCPEvent(arg) {
  if (arg.event === "call") {
    return `Calling MCP server: ${arg?.server}\n\nfunction: \`${arg?.function}\` with args: \`${arg?.arguments}\`\n\n`;
  } else if (arg.event === "result") {
    return `MCP response received of type \`${arg?.type}\`\n\n`;
  }
  return "";
}

function handleRScriptEvent(arg) {
  if (arg.event === "preparing_script") {
    return `Running R Script:\n\`\`\`r\n${arg?.script}\n\`\`\`\n\n`;
  }
  if (arg.event === "error") {
    return "Cannot use Rscript: " + String(arg?.msg) + "\n\n";
  }
  return "";
}

function handleWebSearchEvent(arg) {
  if (arg.event === "begin") {
    return `Searching for "${arg.query}" on `;
  } else if (arg.event === "config") {
    return arg?.["search-engine"] + "\n\n";
  } else if (arg.event === "websearch_done") {
    return `Web search completed. Used ${arg.selected} relevant sources.\n\n`;
  } else if (arg.event === "websearch_page_cache" || arg.event === "fetch") {
    return `Reading source: ${arg?.url}\n\n`;
  } else if (arg.event === "error") {
    return "Websearch Error: " + String(arg?.msg) + "\n\n";
  }
  return "";
}

function handleArcanaEvent(arg) {
  if (arg.event === "accessing") {
    return `Reading arcana "${arg.arcana}" \n\n`;
  }
  return "";
}

function handleImageEvent(arg) {
  if (arg.event === "image_creation_begin") {
    return `Generating image: "${arg.query}" \n\n`;
  } else if (arg.event === "image_modify_begin") {
    return `Modifying image: ${arg?.query}\n\n`;
  } else if (arg.event === "error") {
    return `Image generation failed: ${arg?.msg}\n\n`;
  }
  return "";
}

function handleVideoEvent(arg) {
  if (arg.event === "begin") {
    return `Generating video: "${arg.query}" \n\n`;
  } else if (arg.event === "error") {
    return `Video generation failed: ${arg?.msg}\n\n`;
  }
  return "";
}

function handleAudioEvent(arg) {
  if (arg.event === "audio_creation_begin") {
    return `Generating audio: "${arg.query}" \n\n`;
  } else if (arg.event === "error") {
    return `Audio generation failed: ${arg?.msg}\n\n`;
  }
  return "";
}

function handleAudioTranscriptionEvent(arg) {
  if (arg.event === "begin") {
    return `Transcribing audio: `;
  } else if (arg.event === "done") {
    return arg.transcription + "\n\n";
  } else if (arg.event === "error") {
    return `Audio transcription failed: ${arg?.msg}\n\n`;
  }
  return "";
}

export async function handleFileContent(delta, conversationId) {
  let fileId = null;

  if (delta?.audio) {
    try {
      console.log("Receiving audio...");
      const base64_data = delta.audio?.data;
      const format = delta.audio?.format || "wav";
      const filename = delta.audio?.filename || `output.${format}`;
      const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
      fileId = await receiveFile(base64_data, mimeType, filename, conversationId, format);
    } catch (err) {
      console.error("Error receiving audio file:", err);
    }
  } else if (delta?.content && typeof delta.content !== "string") {
    try {
      if (delta.content?.type === "image") {
        console.log("Receiving image...");
        const base64_dataURL = delta.content?.image_url;
        const matches = base64_dataURL.match(/^data:(.+);base64,(.*)$/);
        if (!matches) {
          throw new Error("Invalid base64 image data");
        }
        const mimeType = matches[1];
        const base64Data = matches[2];
        fileId = await receiveFile(base64Data, mimeType, "image_output", conversationId);
      }
    } catch (err) {
      console.error("Error processing image chunk:", err);
    }
  }

  return fileId;
}