// Import modules
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";          
import OpenAI from "openai";
import fileUpload from "express-fileupload";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { Readable } from "stream"; // Node's stream module

const app = express();

// Path to the external config file
const configPath = path.resolve("/run/secrets/back");

// Default configuration if config file is missing or invalid
let port = 8081;
let apiEndpoint = "https://chat-ai.academiccloud.de/v1";
let apiKey = "";
let serviceName = "Chat AI Dev";

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
  const url = apiEndpoint + "/documents/convert";
  const formData = new FormData();
  formData.append("document", file.data, {
    filename: file.name,
    contentType: file.mimetype,
  });
  formData.append("extract_tables_as_images", "false");
  formData.append("image_resolution_scale", "4");

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
app.post("/documents", async (req, res) => {
  // Check for the presence of `document` file key
  if (!req.files || !req.files.document) {
    return res.status(422).json({ error: "No file provided" });
  }

  const inference_id = req.headers["inference-id"];
  try {
    // Access the file using the correct key name
    const file = req.files.document;
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
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + apiKey,
      "inference-portal": "Chat AI",
    };
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
    res.status(500).json({ error: "Failed to fetch models." });
  }
});

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
  } = req.body;

  const inference_id = req.headers["inference-id"];
  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);

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

    const params = {
      model: model,
      messages: messages,
      temperature: temperature,
      top_p: top_p,
      stream: stream,
      stream_options: stream ? {include_usage: true } : null,
      timeout: timeout,
    }

    let inference_service = model;

    if (arcana && arcana.id !== "") {
        params.arcana = arcana;
      }

    // Handle tools and arcana
    if (enable_tools) {
      inference_service = "saia-openai-gateway";
      if (tools && tools.length > 0) {
        params.tools = [];
        for (const tool of tools) {
          if (tool.type === "web_search_preview") {
            params.tools.push({type: "web_search_preview"});
          }
          if (tool.type === "image_generation") {
            params.tools.push({type: "image_generation"});
          }
          if (tool.type === "audio_generation") {
            params.tools.push({type: "audio_generation"});
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

    // Get chat completion response
    const response = await openai.chat.completions.create(
      params, {
        headers: {"inference-service": inference_service}
      }
    ).asResponse();
    
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
    console.error(err);
    try {
      return res
        .status(500)
        .json({ error: "An internal server error occurred" });
    } catch (err) {
      return;
    }
  }
});

// Start Chat AI Backend App
app.listen(port, () => {
  console.log(`Chat AI backend listening on port ${port}`);
});
