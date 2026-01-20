
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// 强制使用标准 OpenAI 基础 URL 以避免代理不支持 TTS 的问题
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
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
  speed?: number;
  format?: TTSFormat;
  timeoutMs?: number;
  instructions?: string;
}): Promise<{ fileName: string; filePath: string; contentType: string }> {
  const {
    text,
    voice = "shimmer",
    speed = 1.25,
    model = process.env.TTS_MODEL || "gpt-4o-mini-tts",
    format = (process.env.TTS_FORMAT as TTSFormat) || "mp3",
    timeoutMs = 60_000,
    instructions = "请用健康、阳光、活泼的少女风格朗读。",
  } = params;

  if (!text?.trim()) {
    throw new Error("text is empty");
  }

  const fileName = `${uuidv4()}.${format}`;
  const filePath = path.join(TEMP_AUDIO_DIR, fileName);

  try {
    // 使用官方推荐的流式响应方式
    const response = await openai.audio.speech.create({
      model,
      voice: voice as any,
      input: text,
      response_format: format,
    });

    // 将响应流写入文件
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    // 设置自动回收机制：30分钟后删除文件
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
  } catch (error: any) {
    console.error("OpenAI TTS Error:", error);
    // 如果文件已创建但出错，尝试清理
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
}

/**
 * 删除指定的音频文件
 */
export function deleteAudioFile(fileName: string) {
  const filePath = path.join(TEMP_AUDIO_DIR, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      console.error(`Failed to delete file ${fileName}:`, e);
      return false;
    }
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
