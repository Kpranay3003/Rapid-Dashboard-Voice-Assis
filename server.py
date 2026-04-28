"""
server.py  —  Rapid Dashboard Backend (Python + FastAPI)
Replaces server.cjs entirely.

Install dependencies:
    pip install fastapi uvicorn openpyxl httpx python-dotenv

Run:
    uvicorn server:app --reload --port 5000
"""

import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import openpyxl
from dotenv import load_dotenv

# ── Load .env file (for API key) ────────────────────────────
load_dotenv()
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# ── Load Excel once at startup ───────────────────────────────
EXCEL_PATH = "data.xlsx"
try:
    workbook = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    print(f"✅ Loaded {EXCEL_PATH}")
    print(f"   Sheets found: {workbook.sheetnames}")
except FileNotFoundError:
    print(f"❌ ERROR: {EXCEL_PATH} not found. Place it in the same folder as server.py")
    workbook = None

# ── FastAPI app ──────────────────────────────────────────────
app = FastAPI(title="Rapid Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helper: read a sheet into list of dicts ──────────────────
def get_sheet_data(sheet_name: str) -> list[dict]:
    if workbook is None:
        return []
    if sheet_name not in workbook.sheetnames:
        return []

    sheet = workbook[sheet_name]
    rows  = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []

    headers = [str(h).strip() if h is not None else f"col_{i}"
               for i, h in enumerate(rows[0])]

    result = []
    for row in rows[1:]:
        if all(v is None for v in row):
            continue  # skip empty rows
        result.append({headers[i]: (str(v) if v is not None else "") for i, v in enumerate(row)})

    return result


# ── GET /api/node/:nodeId ────────────────────────────────────
@app.get("/api/node/{node_id}")
def get_node_data(node_id: str):
    data = get_sheet_data(node_id)
    return data


# ── GET /api/summary/:nodeId ─────────────────────────────────
@app.get("/api/summary/{node_id}")
def get_summary(node_id: str):
    data     = get_sheet_data(node_id)
    total    = len(data)
    success  = sum(1 for d in data if d.get("Status", "").upper() == "SUCCESS")
    failed   = sum(1 for d in data if d.get("Status", "").upper() == "FAILED")
    critical = sum(1 for d in data if d.get("CRITICAL", "").upper() == "YES")
    return {"total": total, "success": success, "failed": failed, "critical": critical}


# ── POST /api/chat ───────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    systemPrompt: Optional[str] = "You are a helpful dashboard assistant."

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not set. Add it to your .env file."
        )

    payload = {
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system":     req.systemPrompt,
        "messages":   [{"role": m.role, "content": m.content} for m in req.messages],
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json=payload,
            )
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to reach Anthropic: {str(e)}")


# ── Health check ─────────────────────────────────────────────
@app.get("/api/health")
def health():
    sheets = workbook.sheetnames if workbook else []
    return {
        "status":    "ok",
        "excel":     EXCEL_PATH if workbook else "NOT FOUND",
        "sheets":    sheets,
        "api_key":   "set" if ANTHROPIC_API_KEY else "NOT SET ⚠️",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=True)