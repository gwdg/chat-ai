var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var fetch = require("node-fetch");
const app = express();
const fileUpload = require("express-fileupload");
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Path to the external config file
const configPath = path.resolve('/run/secrets/back');

// Default port if config file is missing or invalid
let port = 8081;
let apiEndpoint = "https://chat-ai.academiccloud.de/v1";
let apiKey = "";
let serviceName = "Chat AI"

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // Extract the port from the config (ensure it's a valid number)
  if (typeof config.port === 'number' && config.port > 0) {
    port = config.port;
    console.log('Port:', port);
  } else {
    console.warn('Invalid port in back.json. Falling back to default port 8081.');
  }
  apiEndpoint = config.apiEndpoint;
  apiKey = config.apiKey;
  serviceName = config.serviceName;
} catch (error) {
  console.error('Failed to read back.json. Using default values.', error);
}

// Request size limitations

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

// Handle message request

async function getCompletionLLM(
  model,
  messages,
  temperature = 0.5,
  top_p = 0.5,
  inference_id = "no_id",
  arcana = null
) {
  const url = apiEndpoint + "/chat/completions";
  const headers = {
    Accept: "application/json",
    "inference-service": model,
    "inference-portal": serviceName,
    "Content-Type": "application/json"
  };

  // Only add Authorization header if apiKey is present and non-empty
  if (apiKey) {
    headers.Authorization = "Bearer " + apiKey;
  } else {
    // Only add inference-id header if apiKey is empty or non-existent
    headers["inference-id"] = inference_id;
  }
  const body = JSON.stringify({
    model: model,
    messages: messages,
    //max_tokens: 4096,
    temperature: temperature,
    top_p: top_p,
    stream: true,
    stream_options: {"include_usage": true},
    ...(arcana !== null &&
    arcana !== undefined &&
    arcana.id !== null &&
    arcana.id !== undefined &&
    arcana.id !== ""
      ? { arcana: arcana }
      : {}),
  });

  const response = await fetch(url, { method: "POST", headers, body });
  console.log(response)
  return response;
}


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
    "inference-portal": serviceName
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

app.post("/", async (req, res) => {
  const {
    messages,
    model,
    temperature = 0.5,
    top_p = 0.5,
    arcana = null,
  } = req.body;
  const inference_id = req.headers["inference-id"];

  if (!Array.isArray(messages)) {
    return res.status(422).json({ error: "Invalid messages provided" });
  }

  // const totalTokens = messages.reduce(
  //   (total, message) => total + message.length,
  //   0
  // );

  // if (totalTokens > 10000) {
  //   return res.status(403).json({ error: "Token limit exceeded" });
  // }

  try {
    const es = require("event-stream");
    const JSONStream = require("JSONStream");

    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject("getCompletionLLM timed out");
      }, 30000); // here, 30000ms is the timeout. Adjust it as per your needs
    });

    const streamPromise = getCompletionLLM(
      model,
      messages,
      temperature,
      top_p,
      inference_id,
      arcana
    );
    const response = await Promise.race([streamPromise, timeout]).catch(
      (error) => {
        console.error(error);
        res.status(503).json({ error: "The model failed to respond in time" });
        throw error;
      }
    );

    if (!response.ok) {
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
        res.write(data || "");
      } catch (err) {
        console.error(err);
      }
    });

    jsonParseStream.on("end", () => {
      try {
        res.status(200).end();
      } catch (err) {
        console.error(err);
      }
    });

    jsonParseStream.on("error", (err) => {
      res.status(500).json({ error: "Could not parse JSON" });
      console.error(err);
    });
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

app.listen(port, () => {
  console.log(`Chat AI backend listening on port ${port}`);
});
