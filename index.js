const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const Author = "MinatoCodes";

const app = express();
const PORT = 3000;

async function downloadImageToLocal(url, folder = "downloads") {
  const filename = uuidv4() + path.extname(url.split("?")[0] || ".jpg");
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  const response = await axios.get(url, { responseType: "stream" });
  const writer = fs.createWriteStream(filePath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
}

async function generatePromptFromImage(filePath) {
  const API_URL = "https://www.imageto.pro/api/generate-prompt";

  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found at: ${fullPath}`);
  }

  const form = new FormData();
  form.append("image", fs.createReadStream(fullPath));

  try {
    console.log("📤 Uploading image to:", API_URL);

    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        "Origin": "https://www.imageto.pro",
        "Referer": "https://www.imageto.pro/",
        "User-Agent": "Mozilla/5.0",
      },
    });

    console.log("✅ Prompt received:", response.data);
    return response.data; // should be { prompt: "..." }
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("❌ Upload failed:", errMsg);
    throw error;
  }
}

// 🚀 API route
app.get("/api/prompt", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    console.log("Checking URL content type:", url);

    const headResponse = await axios.head(url);
    const contentType = headResponse.headers["content-type"];
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: "URL does not point to an image" });
    }

    console.log("Confirmed image content-type:", contentType);

    const filePath = await downloadImageToLocal(url);
    console.log("Image downloaded to:", filePath);

    const promptResult = await generatePromptFromImage(filePath);

    res.json({ success: true, creator: Author, prompt: promptResult.prompt });
  } catch (err) {
    console.error("❌ Error in /api/prompt:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ success: true, message: "API is healthy!" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
