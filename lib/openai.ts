import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

const client = new OpenAI({ apiKey });

export async function generateCarImage(modelName: string): Promise<string> {
  const prompt = `Studio photo of a ${modelName}, side view, clean background, realistic lighting, premium style`;

  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
  });

  const url = response.data?.[0]?.url;
  if (!url) {
    throw new Error("OpenAI image URL is missing");
  }

  return url;
}
