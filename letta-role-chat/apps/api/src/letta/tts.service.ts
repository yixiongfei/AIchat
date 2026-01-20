
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TTSFormat = "wav" | "mp3" | "opus" | "aac" | "flac";

// 语音文件暂存目录
const TEMP_AUDIO_DIR = path.join(process.cwd(), "temp_audio");

// 确保目录存在
if (!fs.existsSync(TEMP_AUDIO_DIR)) {
  fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
}

/**
 * 把文本转换为音频并保存到本地文件
 */
export async function textToSpeechFile(params: {
  text: string;
  voice?: string;
  model?: string;
  format?: TTSFormat;
  timeoutMs?: number;
}): Promise<{ fileName: string; filePath: string; contentType: string }> {
  const {
    text,
    voice = process.env.TTS_VOICE || "alloy",
    model = process.env.TTS_MODEL || "tts-1",
    format = (process.env.TTS_FORMAT as TTSFormat) || "mp3",
    timeoutMs = 60_000,
  } = params;

  if (!text?.trim()) {
    throw new Error("text is empty");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await openai.audio.speech.create(
      {
        model,
        voice: voice as any,
        input: text,
        response_format: format,
      },
      { signal: controller.signal }
    );

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const fileName = `${uuidv4()}.${format}`;
    const filePath = path.join(TEMP_AUDIO_DIR, fileName);
    
    fs.writeFileSync(filePath, buffer);

    // 设置自动回收机制：30分钟后删除文件（防止泄露）
    // 正常情况下前端播放完会调用删除接口，这里是兜底
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Auto-cleaned expired audio file: ${fileName}`);
      }
    }, 30 * 60 * 1000);

    return { 
      fileName, 
      filePath, 
      contentType: formatToContentType(format) 
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 删除指定的音频文件
 */
export function deleteAudioFile(fileName: string) {
  const filePath = path.join(TEMP_AUDIO_DIR, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * 获取音频文件路径
 */
export function getAudioFilePath(fileName: string) {
  return path.join(TEMP_AUDIO_DIR, fileName);
}

function formatToContentType(format: TTSFormat): string {
  switch (format) {
    case "wav": return "audio/wav";
    case "mp3": return "audio/mpeg";
    case "opus": return "audio/opus";
    case "aac": return "audio/aac";
    case "flac": return "audio/flac";
    default: return "application/octet-stream";
  }
}
