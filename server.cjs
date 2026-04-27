const express = require("express");
const XLSX    = require("xlsx");
const cors    = require("cors");
const https   = require("https");

const app = express();
app.use(cors());
app.use(express.json());

// ── Your Anthropic API key ──────────────────────────────────
// Replace the value below with your actual key from:
// https://console.anthropic.com/settings/keys
const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY";
// ────────────────────────────────────────────────────────────

// Load Excel once at startup
const workbook = XLSX.readFile("data.xlsx");

const getSheetData = (sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet);
};

// ── API: node data ──────────────────────────────────────────
app.get("/api/node/:nodeId", (req, res) => {
  const data = getSheetData(req.params.nodeId);
  res.json(data);
});

// ── API: summary ────────────────────────────────────────────
app.get("/api/summary/:nodeId", (req, res) => {
  const data     = getSheetData(req.params.nodeId);
  const total    = data.length;
  const success  = data.filter(d => d.Status === "SUCCESS").length;
  const failed   = data.filter(d => d.Status === "FAILED").length;
  const critical = data.filter(d => d.CRITICAL === "YES").length;
  res.json({ total, success, failed, critical });
});

// ── API: AI chat (proxies to Anthropic securely) ─────────────
app.post("/api/chat", (req, res) => {
  const { messages, systemPrompt } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  const body = JSON.stringify({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system:     systemPrompt || "You are a helpful dashboard assistant.",
    messages:   messages,
  });

  const options = {
    hostname: "api.anthropic.com",
    path:     "/v1/messages",
    method:   "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Length":    Buffer.byteLength(body),
    },
  };

  const apiReq = https.request(options, (apiRes) => {
    let data = "";
    apiRes.on("data", chunk => { data += chunk; });
    apiRes.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        // Forward whatever Anthropic returned (success or error)
        res.status(apiRes.statusCode).json(parsed);
      } catch {
        res.status(500).json({ error: "Failed to parse Anthropic response", raw: data });
      }
    });
  });

  apiReq.on("error", (e) => {
    res.status(500).json({ error: "Request to Anthropic failed: " + e.message });
  });

  apiReq.write(body);
  apiReq.end();
});

app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
  if (ANTHROPIC_API_KEY === "YOUR_ANTHROPIC_API_KEY_HERE") {
    console.warn("⚠️  WARNING: Set your Anthropic API key in server.cjs before using AI chat!");
  }
});
