var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
var fetch = require("node-fetch");
const app = express();

require("dotenv").config();

const port = process.env.PORT || 7230;
const api_key = process.env.API_KEY;

app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 10000,
  })
);

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
  formData.append("file", file);

  const headers = {
    "inference-id": inference_id,
    Authorization: "Bearer " + api_key,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  return response;
}

app.post("/process-pdf", async (req, res) => {
  const inference_id = req.headers["inference-id"];

  if (!req.files || !req.files.pdf) {
    return res.status(422).json({ error: "No PDF file provided" });
  }

  try {
    const pdfFile = req.files.pdf;

    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        reject("processPdfFile timed out");
      }, 30000);
    });

    const processPromise = processPdfFile(pdfFile, inference_id);
    const response = await Promise.race([processPromise, timeout]).catch(
      (error) => {
        console.error(error);
        res
          .status(503)
          .json({ error: "The PDF processing failed to respond in time" });
        throw error;
      }
    );

    if (!response.ok) {
      res.status(response.status).send(response.statusText);
      return;
    }

    // Assuming API returns JSON response
    const result = await response.json();
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    try {
      return res.status(500).json({
        error: "An internal server error occurred while processing PDF",
      });
    } catch (err) {
      return;
    }
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
