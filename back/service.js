var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var fetch = require("node-fetch");
const app = express();
const fileUpload = require("express-fileupload");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

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

// Function to handle message request
async function getCompletionLLM(
  model,
  messages,
  temperature = 0.5,
  top_p = 0.5,
  inference_id = "no_id",
  arcana = null,
  gwdg_tools = null,
) {
  const url = apiEndpoint + "/chat/completions";
  const headers = {
    Accept: "application/json",
    "inference-service": model,
    "inference-portal": serviceName,
    "Content-Type": "application/json",
  };

  // Only add Authorization header if apiKey is present and non-empty
  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  } else {
    // Only add inference-id header if apiKey is empty or non-existent
    headers.Authorization = "Bearer " + inference_id;
    headers["inference-id"] = inference_id;
  }

  if (gwdg_tools) {
    headers["inference-service"] = "saia-openai-gateway"
  }
  const body = JSON.stringify({
    model: model,
    messages: messages,
    //max_tokens: 4096,
    temperature: temperature,
    top_p: top_p,
    stream: true,
    stream_options: { include_usage: true },
    ...(arcana !== null &&
    arcana !== undefined &&
    arcana.id !== null &&
    arcana.id !== undefined &&
    arcana.id !== ""
      ? { arcana: arcana }
      : {}),
  });

  const response = await fetch(url, { method: "POST", headers, body });
  return response;
}

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
    //console.log(await response.json())
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

// Get response from LLM
app.post("/", async (req, res) => {
  const {
    messages,
    model,
    temperature = 0.5,
    top_p = 0.5,
    arcana = null,
    timeout = 30000,
    gwdg_tools = null,
  } = req.body;
  const inference_id = req.headers["inference-id"];

  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  const validatedTimeout = Math.min(Math.max(timeout, 5000), 900000);
  console.log(
    `Request timeout set to: ${validatedTimeout}ms (${
      validatedTimeout / 1000
    }s)`
  );

  try {
    const es = require("event-stream");
    const JSONStream = require("JSONStream");

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

    const streamPromise = getCompletionLLM(
      model,
      messages,
      temperature,
      top_p,
      inference_id,
      arcana,
      gwdg_tools
    );

    try {
      const response = await Promise.race([streamPromise, timeoutPromise]);

      if (!response.ok) {
        clearTimeout(timeoutId);
        res.status(response.status).send(response.statusText);
        return;
      }

      const stream = response.body;

      let jsonParseStream = new JSONStream.parse([
        "choices",
        true,
        "delta",
        "content",
      ]);

      let stripData = es.mapSync((data) => {
        // Check if timed out during streaming
        if (isTimedOut) {
          return undefined;
        }

        if (data.trim() === "data: [DONE]" || data.trim() === "DONE") {
          return undefined;
        } else if (data.startsWith("data: ")) {
          return data.slice("data: ".length);
        } else {
          return data;
        }
      });

      // Pipe the input into the line splitter, then the data stripper, then the JSON parser
      stream.pipe(es.split()).pipe(stripData).pipe(jsonParseStream);

      jsonParseStream.on("data", (data) => {
        try {
          // Check if timed out before writing
          if (isTimedOut) {
            return;
          }
          res.write(data || "");
        } catch (err) {
          console.error(err);
        }
      });

      jsonParseStream.on("end", () => {
        try {
          clearTimeout(timeoutId); // Clear timeout on successful completion
          if (!isTimedOut) {
            res.status(200).end();
          }
        } catch (err) {
          console.error(err);
        }
      });

      jsonParseStream.on("error", (err) => {
        clearTimeout(timeoutId);
        if (!isTimedOut) {
          res.status(500).json({ error: "Could not parse JSON" });
        }
        console.error(err);
      });

      // Handle timeout during streaming
      timeoutPromise.catch((error) => {
        console.error("Stream timeout:", error.message);
        try {
          if (!res.headersSent) {
            res.status(503).json({
              error: error.message,
              timeout: validatedTimeout,
            });
          } else {
            // Response already started, just end it
            res.end();
          }
        } catch (err) {
          console.error("Error handling timeout:", err);
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Initial request timeout:", error);
      res.status(503).json({
        error: error.message || "The model failed to respond in time",
        timeout: validatedTimeout,
      });
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
