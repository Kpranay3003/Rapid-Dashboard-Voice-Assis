"""
server.py  —  Rapid Dashboard Backend (Python + FastAPI)

Install:
    pip install fastapi uvicorn[standard] openpyxl httpx python-dotenv

Run:
    python server.py
"""

import os
import openpyxl
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

# ── Load .env file ───────────────────────────────────────────
# This reads your .env file and loads ANTHROPIC_API_KEY into
# the environment so os.getenv() can access it below.
load_dotenv()

# ── API Key ──────────────────────────────────────────────────
# This reads from your .env file — never hardcode the key here
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

if not ANTHROPIC_API_KEY:
    print("⚠️  WARNING: ANTHROPIC_API_KEY not set in .env file!")
    print("   AI chat will not work until you add it.")
else:
    print("✅ Anthropic API key loaded successfully.")

# ════════════════════════════════════════════════════════════
#  STARTUP — load entire Excel into memory once
# ════════════════════════════════════════════════════════════
EXCEL_PATH = "data.xlsx"
SHEET_CACHE: dict[str, list[dict]] = {}

def load_excel_to_cache():
    print(f"\n Loading {EXCEL_PATH} into memory...")
    try:
        wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    except FileNotFoundError:
        print(f" ERROR: {EXCEL_PATH} not found. Place it next to server.py")
        return

    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        rows  = list(sheet.iter_rows(values_only=True))
        if not rows:
            SHEET_CACHE[sheet_name] = []
            continue
        headers = [
            str(h).strip() if h is not None else f"col_{i}"
            for i, h in enumerate(rows[0])
        ]
        records = []
        for row in rows[1:]:
            if all(v is None for v in row):
                continue
            records.append({
                headers[i]: (str(v) if v is not None else "")
                for i, v in enumerate(row)
            })
        SHEET_CACHE[sheet_name] = records
        print(f"   ✅ '{sheet_name}' — {len(records):,} rows cached")

    wb.close()
    print(f"\n All sheets loaded. Serving from memory.\n")

load_excel_to_cache()

# ════════════════════════════════════════════════════════════
#  FASTAPI APP
# ════════════════════════════════════════════════════════════
app = FastAPI(title="Rapid Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── GET /api/node/{node_id} ──────────────────────────────────
@app.get("/api/node/{node_id}")
def get_node_data(node_id: str):
    return SHEET_CACHE.get(node_id, [])

# ── GET /api/summary/{node_id} ───────────────────────────────
@app.get("/api/summary/{node_id}")
def get_summary(node_id: str):
    data     = SHEET_CACHE.get(node_id, [])
    total    = len(data)
    success  = sum(1 for d in data if d.get("Status", "").upper() == "SUCCESS")
    failed   = sum(1 for d in data if d.get("Status", "").upper() == "FAILED")
    critical = sum(1 for d in data if d.get("CRITICAL", "").upper() == "YES")
    return {"total": total, "success": success, "failed": failed, "critical": critical}

# ── GET /api/health ──────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status":  "ok",
        "excel":   EXCEL_PATH if SHEET_CACHE else "NOT FOUND",
        "sheets":  [{"name": k, "rows": len(v)} for k, v in SHEET_CACHE.items()],
        "api_key": "set ✅" if ANTHROPIC_API_KEY else "NOT SET ⚠️",
    }

# ── POST /api/chat ───────────────────────────────────────────
# Pydantic models for request validation
class ChatMessage(BaseModel):
    role: str        # must be "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages:     List[ChatMessage]
    systemPrompt: Optional[str] = "You are a helpful dashboard assistant."

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Check key is set before even trying
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not set in .env file. Add it and restart server."
        )

    # Build the payload for Anthropic
    payload = {
        "model":      "claude-sonnet-4-20250514",
        "max_tokens": 1024,
        "system":     req.systemPrompt,
        "messages": [
            {"role": m.role, "content": m.content}
            for m in req.messages
        ],


        
    }

    # Call Anthropic API securely from backend
    # Key is NEVER sent to the browser — stays on server only
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         ANTHROPIC_API_KEY,  # ← key used here
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json=payload,
            )
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach Anthropic: {str(e)}"
            )

# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=5000, reload=False)
