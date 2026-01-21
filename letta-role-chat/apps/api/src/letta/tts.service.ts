import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
export type TTSFormat = "wav" | "mp3" | "opus" | "aac" | "flac";
import {agentService} from "./agent.service";
// ======= 1) 默认值集中管理（硬编码兜底） =======
const DEFAULT_TTS = {
  voice: "ja-JP-MayuNeural",
  speed: 1.0,
  pitch: "10",
  style: "chat",
} as const;

/**
 * ✅ 建议：允许用环境变量固定目录，避免 cwd 漂移
 */
const TEMP_AUDIO_DIR =
  process.env.TEMP_AUDIO_DIR || path.resolve(process.cwd(), "temp_audio");

async function ensureTempDir() {
  await fs.promises.mkdir(TEMP_AUDIO_DIR, { recursive: true });
}

const WORKER_TTS_URL =
  process.env.WORKER_TTS_URL ||
  "https://tts-voice-magic.yixiongfei1785.workers.dev/v1/audio/speech";

const WORKER_TTS_API_KEY = process.env.WORKER_TTS_API_KEY;

// ======= 2) 从 DB 读取 agent 配置，并与默认值合并 =======
async function resolveAgentTTSConfig(params: {
  agentId?: string;
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
}) {
  const { agentId } = params;

  let agentCfg: Partial<typeof DEFAULT_TTS> = {};

  // ✅ 只有传了 agentId 才查 DB
  if (agentId) {
    try {
      const agent = await agentService.getRole(agentId);
      if (agent) {
        agentCfg = {
          voice: agent.voice ?? undefined,
          speed: agent.speed ?? undefined,
          pitch: agent.pitch ?? undefined,
          style: agent.style ?? undefined,
        };
      }
      // agent 为 null：自动回退到 env/默认值
    } catch (e) {
      // DB 出错不阻断 TTS：降级
      console.warn("[TTS] load agent config failed, fallback:", e);
    }
  }

  // ✅ 合并优先级：调用参数 > DB > ENV > DEFAULT
  const merged = {
    voice: params.voice ?? agentCfg.voice ?? DEFAULT_TTS.voice,
    speed: params.speed ?? agentCfg.speed ?? DEFAULT_TTS.speed,
    pitch: params.pitch ?? agentCfg.pitch ?? DEFAULT_TTS.pitch,
    style: params.style ?? agentCfg.style ?? DEFAULT_TTS.style,
  };

  // ✅ speed 防御：无效则回退
  if (!Number.isFinite(merged.speed) || merged.speed <= 0) {
    merged.speed = DEFAULT_TTS.speed;
  }

  return merged;
}

export async function textToSpeechFile(params: {
  text: string;

  // ✅ 新增：用于从 agents 表加载默认 voice/speed/pitch/style
  agentId?: string;

  // 仍然允许显式覆盖
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;

  format?: TTSFormat;
  timeoutMs?: number;
}): Promise<{ fileName: string; filePath: string; contentType: string }> {
  const {
    text,
    agentId,
    format = (process.env.TTS_FORMAT as TTSFormat) || "mp3",
    timeoutMs = 60_000,
  } = params;

  if (!text?.trim()) throw new Error("text is empty");

  await ensureTempDir();

  // ✅ 统一解析最终使用的 voice/speed/pitch/style
  const { voice, speed, pitch, style } = await resolveAgentTTSConfig({
    agentId,
    voice: params.voice,
    speed: params.speed,
    pitch: params.pitch,
    style: params.style,
  });

  let fileName = `${uuidv4()}.${format}`;
  let filePath = path.join(TEMP_AUDIO_DIR, fileName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (WORKER_TTS_API_KEY) headers["Authorization"] = `Bearer ${WORKER_TTS_API_KEY}`;

    const payload = { input: text, voice, speed, pitch, style, format };
    console.log("[TTS] Sending payload to worker:", payload);

    const resp = await fetch(WORKER_TTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const ct = resp.headers.get("content-type") || "";
      const detail = ct.includes("application/json")
        ? JSON.stringify(await resp.json())
        : await resp.text();
      throw new Error(`Worker TTS Error: ${resp.status} ${resp.statusText} ${detail}`);
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || formatToContentType(format);

    // 根据 content-type 自动修正后缀（可选）
    const extByCT = contentTypeToExt(contentType);
    if (extByCT && !fileName.endsWith(`.${extByCT}`)) {
      fileName = `${uuidv4()}.${extByCT}`;
      filePath = path.join(TEMP_AUDIO_DIR, fileName);
    }

    await ensureTempDir();

    try {
      await fs.promises.writeFile(filePath, buffer);
    } catch (err: any) {
      if (err?.code === "ENOENT") {
        await ensureTempDir();
        await fs.promises.writeFile(filePath, buffer);
      } else {
        throw err;
      }
    }

    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Auto-cleaned expired audio file: ${fileName}`);
        }
      } catch (e) {
        console.warn("Auto-clean failed:", e);
      }
    }, 30 * 60 * 1000);

    return { fileName, filePath, contentType };
  } catch (error: any) {
    console.error("Worker TTS Error:", error);

    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

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
