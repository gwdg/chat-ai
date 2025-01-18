var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var fetch = require("node-fetch");
const app = express();
const fileUpload = require("express-fileupload");
const FormData = require('form-data');

require("dotenv").config();

const port = process.env.PORT || 7230;
const api_key = process.env.API_KEY;

app.use(bodyParser.json({ limit: "10mb" }));
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

async function getCompletionLLM(
  model,
  messages,
  temperature = 0.5,
  top_p = 0.5,
  inference_id = "no_id",
  arcana = null
) {
  const url = "http://172.17.0.1:8000/inference/v1/chat/completions";
  const headers = {
    Accept: "application/json",
    "inference-id": inference_id,
    "inference-service": model,
    Authorization: "Bearer " + api_key,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    model: model,
    messages: messages,
    //max_tokens: 4096,
    temperature: temperature,
    top_p: top_p,
    stream: true,
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


async function processPdfFile(file, inference_id) {
  const url = "http://172.17.0.1:8000/inference/v1/documents/convert";
  const formData = new FormData();
  formData.append("document", file.data, {
    filename: file.name,
    contentType: file.mimetype,
  });
  formData.append("extract_tables_as_images", "false");
  formData.append("image_resolution_scale", "4");


  const headers = {
    "inference-id": inference_id
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  console.log(response)
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


app.get("/", async (req, res) => {
  const inference_id = req.headers["inference-id"];
  try {
    const models = await getModels(inference_id);
    res.status(200).json({ data: models });
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
  console.log(`LLM service app listening on port ${port}`);
});
