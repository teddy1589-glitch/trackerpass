import asyncio
import base64
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import FileResponse
from google import genai
from pydantic import BaseModel


class TaskState(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    error = "error"


@dataclass
class Task:
    id: str
    model: str
    state: TaskState
    created_at: str
    image_url: Optional[str] = None
    error: Optional[str] = None
    file_name: Optional[str] = None


class GenerateRequest(BaseModel):
    model: str


class GenerateResponse(BaseModel):
    task_id: str


class StatusResponse(BaseModel):
    task_id: str
    status: TaskState
    image_url: Optional[str] = None
    error: Optional[str] = None


load_dotenv()

TASKS: dict[str, Task] = {}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-pro-image-preview")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "3"))
POLL_TIMEOUT = float(os.getenv("POLL_TIMEOUT", "60"))

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "./images")).resolve()
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Image Proxy Service")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_image_bytes_sync(model_name: str) -> bytes:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    client = genai.Client(api_key=GEMINI_API_KEY)
    prompt = (
        f"Studio photo of a {model_name}, side view, clean background, "
        "realistic lighting, premium style"
    )
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[prompt],
    )
    parts = []
    if getattr(response, "parts", None):
        parts = response.parts
    elif getattr(response, "candidates", None):
        candidate = response.candidates[0]
        content = getattr(candidate, "content", None)
        if content and getattr(content, "parts", None):
            parts = content.parts
    for part in parts:
        inline_data = getattr(part, "inline_data", None)
        if inline_data and getattr(inline_data, "data", None):
            return base64.b64decode(inline_data.data)
    raise RuntimeError("Image data missing in Gemini response")


async def request_image_bytes(model_name: str) -> bytes:
    return await asyncio.to_thread(generate_image_bytes_sync, model_name)


async def save_image(image_bytes: bytes) -> str:
    file_name = f"{uuid.uuid4().hex}.png"
    file_path = DOWNLOAD_DIR / file_name
    file_path.write_bytes(image_bytes)
    return file_name


async def process_task(task_id: str) -> None:
    task = TASKS[task_id]
    task.state = TaskState.processing
    try:
        image_bytes = await request_image_bytes(task.model)
        file_name = await save_image(image_bytes)
        task.file_name = file_name
        task.image_url = f"{PUBLIC_BASE_URL}/files/{file_name}"
        task.state = TaskState.done
    except Exception as exc:  # noqa: BLE001
        task.state = TaskState.error
        task.error = str(exc)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest, background_tasks: BackgroundTasks):
    task_id = uuid.uuid4().hex
    task = Task(
        id=task_id,
        model=request.model,
        state=TaskState.pending,
        created_at=now_iso(),
    )
    TASKS[task_id] = task
    background_tasks.add_task(process_task, task_id)
    return GenerateResponse(task_id=task_id)


@app.get("/status/{task_id}", response_model=StatusResponse)
async def status(task_id: str):
    task = TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return StatusResponse(
        task_id=task.id,
        status=task.state,
        image_url=task.image_url,
        error=task.error,
    )


@app.get("/files/{file_name}")
async def files(file_name: str):
    file_path = DOWNLOAD_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
