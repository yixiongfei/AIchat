
// tts.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TTSFormat = "wav" | "mp3" | "opus" | "aac" | "flac";

/**
 * 把文本转换为音频 Buffer（后端用）
 */
export async function textToSpeechBuffer(params: {
  text: string;
  voice?: string;
  model?: string;
  format?: TTSFormat;
  instructions?: string;
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; contentType: string; format: TTSFormat }> {
  const {
    text,
    voice = process.env.TTS_VOICE || "coral",
    model = process.env.TTS_MODEL || "gpt-4o-mini-tts",
    format = (process.env.TTS_FORMAT as TTSFormat) || "mp3",
    instructions = "Speak in a cheerful and positive tone.",
    timeoutMs = 60_000,
  } = params;

  if (!text?.trim()) {
    throw new Error("text is empty");
  }

  // Node18+ 有 AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await openai.audio.speech.create(
      {
        model,
        voice,
        input: text,
        instructions,
        response_format: format,
      },
      { signal: controller.signal }
    );

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contentType = formatToContentType(format);
    return { buffer, contentType, format };
  } finally {
    clearTimeout(timer);
  }
}

function formatToContentType(format: TTSFormat): string {
  switch (format) {
    case "wav":
      return "audio/wav";
    case "mp3":
      return "audio/mpeg";
    case "opus":
      return "audio/opus";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}
