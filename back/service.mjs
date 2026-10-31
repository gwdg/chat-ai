// Import modules
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";          
import fileUpload from "express-fileupload";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { Readable } from "stream"; // Node's stream module
import OpenAI from "openai";

const app = express();

// Path to the external config file
const CONFIG_LOCATION = process.env.CONFIG_LOCATION || "../secrets/back.json";
const configPath = path.resolve(CONFIG_LOCATION);

// Default configuration if config file is missing or invalid
let port = 8081;
let apiEndpoint = "https://chat-ai.academiccloud.de/v1";
let apiKey = "";
let serviceName = "Chat AI Dev";
let testMode = false;

// Load configuration
try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (typeof config.port === "number" && config.port > 0) {
    port = config.port;
    console.log("Port:", port);
  } else {
    console.warn(
      "Invalid port in back.json. Falling back to default port 8081."
    );
  }
  apiEndpoint = config.apiEndpoint;
  apiKey = config.apiKey;
  serviceName = config.serviceName;
  testMode = config.testMode === true;
  if (testMode) {
    console.log("TEST MODE ENABLED: no upstream calls will be made.");
  }
} catch (error) {
  console.error("Failed to read back.json. Using default values.", error);
}

// Global request limitations
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    debug: false,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err.name === "FileUploadError") {
    console.error("File Send Error:", err);
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// Function to process file with docling
async function processFile(file, inference_id) {
  const url = apiEndpoint + "/documents/convert/file";
  const formData = new FormData();
  formData.append("files", file.data, {
    filename: file.name,
    contentType: file.mimetype,
  });
  formData.append("extract_tables_as_images", "false");
  formData.append("image_resolution_scale", "4");
  formData.append("image_export_mode", "placeholder");
  formData.append("to_formats", "md");
  formData.append("pdf_backend", "dlparse_v4");
  formData.append("include_images", "false");
  
  const headers = {
    "inference-portal": serviceName,
  };

  // Only add Authorization header if apiKey is present and non-empty
  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  } else {
    // Only add inference-id header if apiKey is empty or non-existent
    headers["inference-id"] = inference_id;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  if (response.status !== 200) console.log(response.text);
  console.log(response.status)
  return response;
}

// Process PDF file
app.post("/documents/convert/file", async (req, res) => {
  // Check for the presence of `document` file key
  if (!req.files || !req.files.document) {
    return res.status(422).json({ error: "No file provided" });
  }

  const inference_id = req.headers["inference-id"];
  try {
    // Access the file using the correct key name
    const file = req.files;
    const response = await processFile(file, inference_id);
    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }
    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    console.error("Processing error:", err);
    return res.status(500).json({
      error: "An internal server error occurred while processing file",
    });
  }
});

// Get list of models
app.get("/models", async (req, res) => {
  try {
    const url = apiEndpoint + "/models";
    const inference_id = req.headers["inference-id"];
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + apiKey,
      "inference-portal": serviceName,
    };
    if (apiKey) {
      headers.Authorization = "Bearer " + apiKey;
    } else {
      // Only add inference-id header if apiKey is empty or non-existent
      headers.Authorization = "Bearer " + inference_id;
    }
    const response = await fetch(url, { method: "GET", headers });
    res.status(200).json(await response.json());
  } catch (error) {
    console.error(`Error: ${error}`);
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

// Get placeholder user data
app.get("/user", async (req, res) => {
  try {
    res.status(200).json({
      email: "user@example.com",
      firstname: "Sample",
      lastname: "User",
      org: "GWD",
      organization: "GWDG",
      username: "sample-user",
    });
  } catch (error) {
    console.error(`Error: ${error}`);
    res.status(500).json({ error: "Failed to fetch user info." });
  }
});

// Speech generation endpoint
app.post("/audio/speech", async (req, res) => {
  // Simply forward the request and return response
  try {
    const url = apiEndpoint + "/audio/speech";
    const inference_id = req.headers["inference-id"];
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
      "inference-portal": serviceName,
    };
    if (apiKey) {
      headers.Authorization = "Bearer " + apiKey;
    } else {
      // Only add inference-id header if apiKey is empty or non-existent
      headers.Authorization = "Bearer " + inference_id;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Speech generation failed:", response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }
    const arrayBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Error in speech generation endpoint:", error);
    res.status(500).json({ error: "Failed to generate speech." });
  }
});

// Build a sophisticated JSON form for a requested tool in test mode. The shape
// matches what the frontend's ToolForm component renders: { tool_id, title,
// description, fields[] } with declarative HTML input types.
function buildTestForm(toolType) {
  const forms = {
    image_generation: {
      tool_id: "image_generation",
      title: "Image generation settings",
      description: "You can change the image size and style before the tool runs.",
      fields: [
        { name: "prompt", label: "Prompt", type: "textarea", rows: 4, value: "A serene mountain landscape at sunset" },
        { name: "width", label: "Width (px)", type: "number", value: 1024, min: 256, max: 2048, step: 64 },
        { name: "height", label: "Height (px)", type: "number", value: 1024, min: 256, max: 2048, step: 64 },
        { name: "quality", label: "Quality", type: "select", value: "high", options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]},
        { name: "style", label: "Style", type: "radio", value: "photorealistic", options: [
          { value: "photorealistic", label: "Photorealistic" },
          { value: "anime", label: "Anime" },
          { value: "painting", label: "Painting" },
        ]},
        { name: "seed", label: "Seed", type: "number", value: 42, min: 0, max: 100000 },
        { name: "enhance", label: "Enhance prompt", type: "checkbox", value: true },
      ],
    },
    image_modification: {
      tool_id: "image_modification",
      title: "Image modification settings",
      description: "Adjust how the uploaded image is modified.",
      fields: [
        { name: "instruction", label: "What to change", type: "textarea", rows: 3, value: "Make it brighter and more colourful" },
        { name: "strength", label: "Strength", type: "range", value: 0.75, min: 0, max: 1, step: 0.05 },
        { name: "denoise", label: "Denoise", type: "number", value: 0.5, min: 0, max: 1, step: 0.05 },
        { name: "preserve_face", label: "Preserve faces", type: "checkbox", value: true },
        { name: "output_format", label: "Output format", type: "select", value: "png", options: [
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" },
        ]},
      ],
    },
    video_generation: {
      tool_id: "video_generation",
      title: "Video generation settings",
      description: "Configure the video the tool will generate.",
      fields: [
        { name: "prompt", label: "Prompt", type: "textarea", rows: 3, value: "A city timelapse from day to night" },
        { name: "duration", label: "Duration (s)", type: "number", value: 5, min: 1, max: 30, step: 1 },
        { name: "resolution", label: "Resolution", type: "select", value: "1080p", options: [
          { value: "720p", label: "720p" },
          { value: "1080p", label: "1080p" },
          { value: "4k", label: "4K" },
        ]},
        { name: "fps", label: "Frames per second", type: "number", value: 30, min: 12, max: 60, step: 6 },
        { name: "motion", label: "Motion strength", type: "range", value: 0.5, min: 0, max: 1, step: 0.1 },
        { name: "loop", label: "Loop video", type: "checkbox", value: false },
      ],
    },
    audio_generation: {
      tool_id: "audio_generation",
      title: "Audio generation settings",
      description: "Configure the audio the tool will generate.",
      fields: [
        { name: "prompt", label: "Prompt", type: "textarea", rows: 3, value: "A calm ambient pad with gentle piano" },
        { name: "duration", label: "Duration (s)", type: "number", value: 10, min: 1, max: 120, step: 1 },
        { name: "format", label: "Format", type: "select", value: "mp3", options: [
          { value: "mp3", label: "MP3" },
          { value: "wav", label: "WAV" },
          { value: "flac", label: "FLAC" },
        ]},
        { name: "volume", label: "Volume", type: "range", value: 0.8, min: 0, max: 1, step: 0.05 },
        { name: "loop", label: "Loop", type: "checkbox", value: false },
      ],
    },
    web_search: {
      tool_id: "web_search",
      title: "Web search settings",
      description: "Tune how the search is performed.",
      fields: [
        { name: "query", label: "Search query", type: "text", value: "" },
        { name: "max_results", label: "Max results", type: "number", value: 5, min: 1, max: 20, step: 1 },
        { name: "region", label: "Region", type: "select", value: "en", options: [
          { value: "en", label: "English" },
          { value: "de", label: "German" },
          { value: "fr", label: "French" },
        ]},
        { name: "safe_search", label: "Safe search", type: "checkbox", value: true },
      ],
    },
  };

  if (forms[toolType]) return forms[toolType];

  // Generic but sophisticated fallback covering the common HTML input types.
  return {
    tool_id: toolType,
    title: "Settings for " + toolType,
    description:
      "The tool requested user input. Edit the options below and submit to run the tool with these settings.",
    fields: [
      { name: "title", label: "Title", type: "text", value: "Example" },
      { name: "description", label: "Description", type: "textarea", rows: 3, value: "Describe what you want." },
      { name: "count", label: "Count", type: "number", value: 3, min: 1, max: 10, step: 1 },
      { name: "scale", label: "Scale", type: "range", value: 0.5, min: 0, max: 1, step: 0.05 },
      { name: "mode", label: "Mode", type: "select", value: "auto", options: [
        { value: "auto", label: "Automatic" },
        { value: "manual", label: "Manual" },
        { value: "expert", label: "Expert" },
      ]},
      { name: "priority", label: "Priority", type: "radio", value: "medium", options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
      ]},
      { name: "enabled", label: "Enabled", type: "checkbox", value: true },
      { name: "target_date", label: "Target date", type: "date", value: "2026-12-31" },
      { name: "accent_color", label: "Accent colour", type: "color", value: "#3b82f6" },
    ],
  };
}

// Chat Completions API
app.post("/chat/completions", async (req, res) => {
  const {
    messages,
    model,
    temperature = 0.5,
    top_p = 0.5,
    arcana = null,
    timeout = 30000,
    enable_tools = null,
    tools = null,
    stream = true,
    feedback = null,
    chat_template_kwargs = null,
    reasoning_effort = null,
  } = req.body;

  const mcp_servers = req.body["mcp-servers"] || null;
  const inference_id = req.headers["inference-id"];
  const uid = req.headers["oidc_claim_uid"];
  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  // ----- TEST MODE -----
  // With testMode enabled in back.json, no upstream call is made. We print the
  // user input to the console and synthesise a response. When any tool is
  // requested, we return a sophisticated JSON form via a "<tool>.form" event.
  if (testMode) {
    console.log("\n=== TEST MODE: incoming /chat/completions request ===");
    console.log("model:", model);
    console.log("enable_tools:", enable_tools);
    console.log("tools:", JSON.stringify(tools, null, 2));
    console.log("stream:", stream);
    console.log("messages:");
    for (const m of messages || []) {
      console.log(JSON.stringify(m, null, 2));
    }
    console.log("=== END OF REQUEST ===\n");

    const hasTools = !!enable_tools && Array.isArray(tools) && tools.length > 0;

    // Build the SSE response.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const now = Math.floor(Date.now() / 1000);
    const id = "chatcmpl-test-" + now;
    let counter = 0;
    const chunk = (delta, finishReason = null) => {
      const payload = {
        id,
        object: "chat.completion.chunk",
        created: now,
        model,
        choices: [
          {
            index: 0,
            delta,
            finish_reason: finishReason,
          },
        ],
      };
      const line = `data: ${JSON.stringify(payload)}\n\n`;
      console.log("→ sending to frontend:", line.trim());
      res.write(line);
      counter++;
    };

    if (hasTools) {
      // Return a sophisticated JSON form for the first requested tool.
      const toolType = tools[0]?.type || "generic_tool";
      const form = buildTestForm(toolType);
      chunk({
        tool_calls: [
          {
            index: 0,
            id: "call_test_form_" + now,
            type: "function",
            function: {
              name: toolType + ".form",
              arguments: JSON.stringify(form),
            },
          },
        ],
      });
    } else {
      // Plain conversational answer in test mode.
      const answer =
        "TEST MODE: I received your request (printed to the backend console). " +
        "No real model or tool was called. " +
        "To exercise tool forms, enable tools in the conversation.";
      const words = answer.split(" ");
      for (const w of words) {
        chunk({ content: w + " " });
      }
    }

    chunk({}, "stop");
    console.log("→ sending to frontend: data: [DONE]");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
  // ----- END TEST MODE -----

  const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);
  let inference_service;
  let params;

  try {
    // // Create a single timeout that applies to the entire request
    // let timeoutId;
    // let isTimedOut = false;

    // const timeoutPromise = new Promise((resolve, reject) => {
    //   timeoutId = setTimeout(() => {
    //     isTimedOut = true;
    //     reject(
    //       new Error(
    //         `Request timed out after ${validatedTimeout / 1000} seconds`
    //       )
    //     );
    //   }, validatedTimeout);
    // });

    params = {
      model: model,
      messages: messages,
      temperature: temperature,
      top_p: top_p,
      stream: stream,
      stream_options: stream ? {include_usage: true } : null,
      timeout: timeout,
      chat_template_kwargs: chat_template_kwargs,
      reasoning_effort: reasoning_effort,
    }

    const isExternalModel = (model.startsWith("openai-") && !model.startsWith("openai-gpt-oss")) || model.startsWith("claude");
    inference_service = model;

    if (arcana && arcana.id !== "") {
      params.arcana = arcana;
    }

    if (feedback){
      params.feedback = feedback;
    }

    // Handle tools and arcana
    if (enable_tools && !isExternalModel) {
      inference_service = "saia-openai-gateway";
      params["runToolsOnServer"] = true;
      if (mcp_servers && mcp_servers.length > 0) {
        params["mcp-servers"] = mcp_servers;
      }
      if (tools && tools.length > 0) {
        params.tools = [];
        for (const tool of tools) {
          if (tool.type === "web_search_preview" || tool.type === "web_search") {
            params.tools.push({type: "web_search_preview"});
          }
          if (tool.type === "fetch_url") {
            params.tools.push({type: "fetch_url"});
          }
          if (tool.type === "image_generation") {
            params.tools.push({type: "image_generation"});
          }
          if (tool.type === "video_generation") {
            params.tools.push({type: "video_create"});
          }
          if (tool.type === "image_modify" || tool.type === "image_modification") {
            params.tools.push({type: "image_modify"});
          }
          if (tool.type === "audio_generation") {
            params.tools.push({type: "audio_generation"});
          }
          if (tool.type === "arcana" && (!params.arcana || !params.arcana.id)) {
            params.tools.push({type: "arcana_list_files"});
            params.tools.push({type: "arcana_get_file_content"});
            params.tools.push({type: "arcana_retrieve_knowledge"});
          }
          if (tool.type === "audio_transcription") {
            params.tools.push({type: "audio_transcription"});
          }
          if (tool.type === "runRscript") {
            params.tools.push({type: "runRscript"});
          }
        }
      }
    }
    
    const openai = new OpenAI({baseURL : apiEndpoint, apiKey: apiKey ? apiKey : inference_id});

    // Temporary workaround as middleware doesn't support timeout yet
    if (params.arcana || params.model.includes("rag") || params.model.includes("sauerkraut")) delete params.timeout;
    
    // Build headers object
    const headers = {
      "inference-service": inference_service,
      "inference-portal": serviceName,
      "user": uid
    };

    // Add inference-id only if it's not null/undefined
    if (inference_id) {
      headers["inference-id"] = inference_id;
    }

    // Get chat completion response
    const response = await openai.chat.completions.create(params, {
        headers
    }).asResponse();

    // Pass through headers (optional but recommended)
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream with error handling
    const nodeStream = Readable.fromWeb(response.body);

    nodeStream.on('error', (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).end("Upstream error");
      } else {
        res.end(); // gracefully end if already streaming
      }
    });
    nodeStream.on('end', () => {
      // Ensure the connection is closed properly
      if (!res.writableEnded) {
        res.end();
      }
    });

    nodeStream.pipe(res);
  } catch (err) {
    try {
      // Well-formed error, return
      if (err?.status && err?.error) {
        return res
        .status(err?.status || 500)
        .json({
          error: err?.error || "An internal server error occurred",
         });
      }
      // Couldn't extract error message, so try without openai library
      const response = await fetch(apiEndpoint + "/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ apiKey ? apiKey : inference_id }`,
          "Content-Type": "application/json",
          "inference-service": inference_service,
          "inference-portal": serviceName,
          "inference-id": inference_id
        },
        body: JSON.stringify(params)
      });
      // Extract message and status from HTTP response
      let msg, status;
      try {
        status = response.status;
        msg = await response.text();
        msg = JSON.parse(msg);
        msg = msg?.message || msg;
        const match = msg.match(/'msg':\s*'([^']*)'/);
        if (match) {
          msg = match[1];
          console.log("Extracted message:", msg);
        }
      } catch {}
      // Return message as best as possible
      return res
        .status(status || err?.status || 500)
        .json({
          error: msg || "An unknown error occurred",
        });
    } catch (err) {
      console.error(err);
      return;
    }
  }
});

// Start Chat AI Backend App
app.listen(port, () => {
  console.log(`Chat AI backend listening on port ${port}`);
});
