import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const IMAGE_PROXY_BASE_URL = process.env.IMAGE_PROXY_BASE_URL;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
const IMAGE_UPLOAD_DIR = process.env.IMAGE_UPLOAD_DIR ?? "public/uploads";
const POLL_INTERVAL_MS = Number(process.env.IMAGE_PROXY_POLL_INTERVAL_MS ?? "3000");
const POLL_TIMEOUT_MS = Number(process.env.IMAGE_PROXY_POLL_TIMEOUT_MS ?? "60000");

type ProxyStatus = {
  status: "pending" | "processing" | "done" | "error";
  image_url?: string | null;
  error?: string | null;
};

function resolveUploadDir(): string {
  return path.isAbsolute(IMAGE_UPLOAD_DIR)
    ? IMAGE_UPLOAD_DIR
    : path.join(process.cwd(), IMAGE_UPLOAD_DIR);
}

function buildPublicUrl(fileName: string): string {
  const publicDir = path.join(process.cwd(), "public");
  const uploadDir = resolveUploadDir();
  const filePath = path.join(uploadDir, fileName);
  const relative = path.relative(publicDir, filePath).replace(/\\/g, "/");
  if (relative.startsWith("..")) {
    throw new Error("IMAGE_UPLOAD_DIR must be inside the public folder");
  }
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${relative}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createProxyTask(modelName: string): Promise<string> {
  if (!IMAGE_PROXY_BASE_URL) {
    throw new Error("IMAGE_PROXY_BASE_URL is not set");
  }
  const response = await fetch(`${IMAGE_PROXY_BASE_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelName }),
  });
  if (!response.ok) {
    throw new Error(`Image proxy error ${response.status}`);
  }
  const data = (await response.json()) as { task_id?: string };
  if (!data.task_id) {
    throw new Error("Image proxy task_id is missing");
  }
  return data.task_id;
}

async function pollProxy(taskId: string): Promise<ProxyStatus> {
  if (!IMAGE_PROXY_BASE_URL) {
    throw new Error("IMAGE_PROXY_BASE_URL is not set");
  }
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`${IMAGE_PROXY_BASE_URL}/status/${taskId}`);
    if (!response.ok) {
      throw new Error(`Image proxy error ${response.status}`);
    }
    const data = (await response.json()) as ProxyStatus;
    if (data.status === "done") {
      return data;
    }
    if (data.status === "error") {
      throw new Error(data.error || "Image proxy returned an error");
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("Image proxy timeout");
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function saveImage(bytes: Buffer): Promise<string> {
  const dir = resolveUploadDir();
  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.png`;
  await writeFile(path.join(dir, fileName), bytes);
  return fileName;
}

export async function generateCarImage(modelName: string): Promise<string> {
  const taskId = await createProxyTask(modelName);
  const status = await pollProxy(taskId);
  const imageUrl = status.image_url;
  if (!imageUrl) {
    throw new Error("Image proxy image_url is missing");
  }
  const bytes = await downloadImage(imageUrl);
  const fileName = await saveImage(bytes);
  return buildPublicUrl(fileName);
}
