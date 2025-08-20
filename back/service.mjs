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

import localModelData from "./models.json" with { type: "json" };

const app = express();

// Path to the external config file
const configPath = path.resolve("/run/secrets/back");

// Default configuration if config file is missing or invalid
let port = 8081;
let apiEndpoint = "https://chat-ai.academiccloud.de/v1";
let apiKey = "";
let serviceName = "Custom Chat AI";

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
    debug: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err.name === "FileUploadError") {
    console.error("File Upload Error:", err);
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// Function to process PDF file
async function processPdfFile(file, inference_id) {
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
  return response;
}

// Process PDF file
app.post("/process-pdf", async (req, res) => {
  // Check for the presence of `document` file key
  if (!req.files || !req.files.document) {
    return res.status(422).json({ error: "No PDF file provided" });
  }

  const inference_id = req.headers["inference-id"];
  try {
    // Access the file using the correct key name
    const pdfFile = req.files.document;
    const response = await processPdfFile(pdfFile, inference_id);
    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }
    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    console.error("Processing error:", err);
    return res.status(500).json({
      error: "An internal server error occurred while processing PDF",
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

    // combine response with models.json by joining on their id
    const jsonData = await response.json();
    const localMap = Object.fromEntries(localModelData.map(m => [m.id, m]));
    jsonData.data = jsonData.data.map(
      (model) => {
        const localModel = localMap[model.id];
        return {
          ...model,
          ...localModel,
        };
      }
    );

    //console.log(await response.json())
    res.status(200).json(jsonData);
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
  } = req.body;
  const inference_id = req.headers["inference-id"];
  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);

  try {
    // Create a single timeout that applies to the entire request
    let timeoutId;
    let isTimedOut = false;

    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        reject(
          new Error(
            `Request timed out after ${validatedTimeout / 1000} seconds`
          )
        );
      }, validatedTimeout);
    });

    // Define openai object
    console.log({baseURL : apiEndpoint, apiKey: apiKey ? apiKey : inference_id})

    const params = {
      model: model,
      messages: messages,
      temperature: temperature,
      top_p: top_p,
      stream: true,
      stream_options: {include_usage: true },
      timeout: timeout,
    }


    let inference_service = model;

    // Handle tools and arcana
    if (enable_tools) {
      inference_service = "saia-openai-gateway";
      if (arcana && arcana.id !== "") {
        params.arcana = arcana;
      }
      if (tools && tools.length > 0) {
        params.tools = [];
        for (const tool of tools) {
          if (tool.type === "web_search_preview") {
            params.tools.push({type: "web_search_preview"});
          }
        }
      }
    }
    
    console.log(params);
    console.log({"inference-service": inference_service});
    // Temporary for testing gwdg tools
    const openai = new OpenAI({baseURL : "https://chat-ai.academiccloud.de/v1", apiKey: apiKey ? apiKey : inference_id});
    const stream = await openai.chat.completions.create(
      params, {
      headers: {"inference-service": inference_service}
    });
    
    let answer = ""
    for await (const chunk of stream) {
      try {
        answer += chunk.choices[0].delta.content
        res.write(chunk.choices[0].delta.content)
        if (chunk?.choices?.[0]?.finish_reason === 'stop') {
          res.status(200).end();
          return
        }
      }
      catch (err) {
        console.error(err);
        // TODO forward exact error
        //res.status(response.status).send(response.statusText);
        res.status(500).end();
      }
      //console.log(answer);
    }
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
