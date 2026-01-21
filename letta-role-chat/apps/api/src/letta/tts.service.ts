
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export type TTSFormat = "wav" | "mp3" | "opus" | "aac" | "flac";

// 语音文件暂存目录
const TEMP_AUDIO_DIR = path.join(process.cwd(), "temp_audio");

// 确保目录存在
if (!fs.existsSync(TEMP_AUDIO_DIR)) {
  fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
}

/**
 * Worker TTS API 地址
 * 例如：https://your-worker.workers.dev/v1/audio/speech
 */
const WORKER_TTS_URL =
  process.env.WORKER_TTS_URL || "https://tts-voice-magic.yixiongfei1785.workers.dev/v1/audio/speech";

/**
 * 可选：如果你的 worker 需要鉴权，在环境变量里设置
 * WORKER_TTS_API_KEY=xxx
 */
const WORKER_TTS_API_KEY = process.env.WORKER_TTS_API_KEY;

/**
 * 把文本转换为音频并保存到本地文件（通过 Worker API）
 */
export async function textToSpeechFile(params: {
  text: string;
  voice?: string;     // e.g. zh-CN-XiaoxiaoNeural
  speed?: number;     // e.g. 1.0
  pitch?: string;     // e.g. "0"
  style?: string;     // e.g. "general"
  format?: TTSFormat; // mp3/wav...
  timeoutMs?: number;
}): Promise<{ fileName: string; filePath: string; contentType: string }> {
  const {
    text,
    voice = "ja-JP-MayuNeural",
    speed = 1.0,
    pitch = "15",
    style = "chat",
    format = (process.env.TTS_FORMAT as TTSFormat) || "mp3",
    timeoutMs = 60_000,
  } = params;

  if (!text?.trim()) {
    throw new Error("text is empty");
  }

  // 先生成文件名（后缀先按 format，后面也会根据 content-type 纠正）
  let fileName = `${uuidv4()}.${format}`;
  let filePath = path.join(TEMP_AUDIO_DIR, fileName);

  // 超时控制
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // 如果 worker 需要鉴权（可选）
    if (WORKER_TTS_API_KEY) {
      headers["Authorization"] = `Bearer ${WORKER_TTS_API_KEY}`;
    }

    const resp = await fetch(WORKER_TTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: text,
        voice,
        speed,
        pitch,
        style,
        // 如果你的 worker 支持 format 参数，可以传上（不支持也没关系）
        format,
      }),
      signal: controller.signal,
    });

    // 如果不是 2xx，尽量把错误信息读出来（可能是 JSON 或文本）
    if (!resp.ok) {
      const ct = resp.headers.get("content-type") || "";
      let detail = "";
      try {
        if (ct.includes("application/json")) {
          detail = JSON.stringify(await resp.json());
        } else {
          detail = await resp.text();
        }
      } catch {
        detail = "(failed to read error body)";
      }
      throw new Error(`Worker TTS Error: ${resp.status} ${resp.statusText} ${detail}`);
    }

    // 读取音频二进制
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 从响应头拿 Content-Type（更可靠）
    const contentType = resp.headers.get("content-type") || formatToContentType(format);

    // 根据 content-type 自动修正后缀（可选但推荐）
    const extByCT = contentTypeToExt(contentType);
    if (extByCT && !fileName.endsWith(`.${extByCT}`)) {
      // 换个后缀名保存，避免 mp3 实际返回 wav 导致播放器识别错
      fileName = `${uuidv4()}.${extByCT}`;
      filePath = path.join(TEMP_AUDIO_DIR, fileName);
    }

    await fs.promises.writeFile(filePath, buffer);

    // 设置自动回收机制：30分钟后删除文件
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Auto-cleaned expired audio file: ${fileName}`);
      }
    }, 30 * 60 * 1000);

    return { fileName, filePath, contentType };
  } catch (error: any) {
    console.error("Worker TTS Error:", error);

    // 如果文件已创建但出错，尝试清理
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
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

function contentTypeToExt(contentType: string): TTSFormat | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("audio/wav") || ct.includes("audio/x-wav")) return "wav";
  if (ct.includes("audio/mpeg") || ct.includes("audio/mp3")) return "mp3";
  if (ct.includes("audio/opus")) return "opus";
  if (ct.includes("audio/aac")) return "aac";
  if (ct.includes("audio/flac")) return "flac";
  return null;
}
