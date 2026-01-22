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
// 默认使用相对于此文件的 apps/api/temp_audio，避免 process.cwd() 导致的路径偏移
const TEMP_AUDIO_DIR =
  process.env.TEMP_AUDIO_DIR || path.resolve(__dirname, "..", "..", "temp_audio");

async function ensureTempDir() {
  await fs.promises.mkdir(TEMP_AUDIO_DIR, { recursive: true });
}

// 音频缓存管理（内存索引 + 定期清理）
const audioCache = new Map<string, number>(); // fileName -> createdAt(ms)
// 默认保留 30 分钟，或超过文件数限制时按最旧删除
const TEMP_AUDIO_RETENTION_MS = Number(process.env.TEMP_AUDIO_RETENTION_MS) || 30 * 60 * 1000; // 30 minutes
const TEMP_AUDIO_MAX_FILES = Number(process.env.TEMP_AUDIO_MAX_FILES) || 20; // max files to keep
// 清理间隔默认 5 分钟（至少 60 秒），避免过于频繁的磁盘操作
const TEMP_AUDIO_CLEAN_INTERVAL_MS = Math.max(60_000, Number(process.env.TEMP_AUDIO_CLEAN_INTERVAL_MS) || 5 * 60 * 1000);

async function cleanupTempAudio() {
  try {
    await ensureTempDir();
    const files = await fs.promises.readdir(TEMP_AUDIO_DIR);
    const now = Date.now();

    // 删除超过保留时长的文件（以内存索引时间优先，回退到文件 mtime）
    for (const f of files) {
      try {
        const p = path.join(TEMP_AUDIO_DIR, f);
        const stat = await fs.promises.stat(p).catch(() => null);
        const createdAt = audioCache.get(f) ?? stat?.mtimeMs ?? 0;
        if (now - createdAt > TEMP_AUDIO_RETENTION_MS) {
          await fs.promises.unlink(p).catch(() => null);
          audioCache.delete(f);
          console.log(`[TTS cleanup] removed expired audio: ${f}`);
        }
      } catch (e) {
        // ignore per-file errors
      }
    }

    // 如果数量超过阈值，按 mtime 删除最旧的文件
    const remaining = await fs.promises.readdir(TEMP_AUDIO_DIR);
    if (remaining.length > TEMP_AUDIO_MAX_FILES) {
      const stats = await Promise.all(
        remaining.map(async (f) => {
          const p = path.join(TEMP_AUDIO_DIR, f);
          const st = await fs.promises.stat(p).catch(() => null);
          return { file: f, mtime: st?.mtimeMs || 0 };
        })
      );
      stats.sort((a, b) => a.mtime - b.mtime);
      const toRemove = stats.slice(0, remaining.length - TEMP_AUDIO_MAX_FILES);
      for (const r of toRemove) {
        try {
          await fs.promises.unlink(path.join(TEMP_AUDIO_DIR, r.file)).catch(() => null);
          audioCache.delete(r.file);
          console.log(`[TTS cleanup] removed old audio to respect max files: ${r.file}`);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('[TTS cleanup] failed', e);
  }
}

// 启动定时清理
setInterval(cleanupTempAudio, TEMP_AUDIO_CLEAN_INTERVAL_MS);

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
    timeoutMs = 30_000,
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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (WORKER_TTS_API_KEY) headers["Authorization"] = `Bearer ${WORKER_TTS_API_KEY}`;

    const payload = { input: text, voice, speed, pitch, style, format };
    console.log("[TTS] Sending payload to worker:", payload);

    // Retry logic for transient network errors
    const maxAttempts = 3;
    let attempt = 0;
    let lastError: any = null;
    let resp: Response | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      const attemptController = new AbortController();
      const combinedSignal = controller.signal;
      // If parent aborts, propagate
      const onAbort = () => attemptController.abort();
      combinedSignal.addEventListener('abort', onAbort);

      try {
        resp = await fetch(WORKER_TTS_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: attemptController.signal,
        });

        // If got response, break loop (we'll check status below)
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[TTS] attempt ${attempt} failed:`, err && err.message ? err.message : err);
        // If aborted by controller, don't retry
        if (err?.name === 'AbortError') {
          break;
        }
        // small backoff before retrying
        await new Promise((r) => setTimeout(r, 200 * attempt));
      } finally {
        combinedSignal.removeEventListener('abort', onAbort);
      }
    }

    if (!resp) {
      throw lastError || new Error('No response from worker TTS');
    }

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

    // 记录到内存索引，由定时器负责清理（避免大量 setTimeout）
    audioCache.set(fileName, Date.now());
    console.log(`[TTS] wrote audio file: ${filePath}`);

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
  const keep = process.env.TTS_KEEP_FILES === '1';
  if (keep) {
    console.log(`[TTS] TTS_KEEP_FILES=1, skipping deletion of ${fileName}`);
    // still remove from index to keep bookkeeping consistent
    try { audioCache.delete(fileName); } catch (e) {}
    return true;
  }
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      // 从内存索引移除
      try { audioCache.delete(fileName); } catch(e) {}
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
