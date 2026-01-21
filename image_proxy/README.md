# Image Proxy Service

Simple async image generation proxy with local file storage.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Environment

- `GEMINI_API_KEY` — ключ Gemini (обязателен)
- `GEMINI_MODEL` — модель изображений (default: `gemini-3-pro-image-preview`)
- `PUBLIC_BASE_URL` — base URL для отдачи файлов, например `https://images.example.com`
- `DOWNLOAD_DIR` — папка для изображений (default: `./images`)

## API

- `POST /generate` → `{ "task_id": "..." }`
- `GET /status/{task_id}` → `{ status, image_url, error }`
- `GET /files/{file_name}` → image file
