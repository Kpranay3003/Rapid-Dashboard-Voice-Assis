const express = require("express");
const XLSX = require("xlsx");
const cors = require("cors");

const app = express();
app.use(cors());

// Load Excel
const workbook = XLSX.readFile("data.xlsx");

// Get sheet data
const getSheetData = (sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet);
};

// API: fetch node data
app.get("/api/node/:nodeId", (req, res) => {
  const nodeId = req.params.nodeId;
  const data = getSheetData(nodeId);
  res.json(data);
});

// API: summary
app.get("/api/summary/:nodeId", (req, res) => {
  const data = getSheetData(req.params.nodeId);
  const total    = data.length;
  const success  = data.filter(d => d.Status === "SUCCESS").length;
  const failed   = data.filter(d => d.Status === "FAILED").length;
  const critical = data.filter(d => d.CRITICAL === "YES").length;
  res.json({ total, success, failed, critical });
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
