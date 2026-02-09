
import { Letta } from "@letta-ai/letta-client";
import dotenv from "dotenv";

dotenv.config();

const LETTA_BASE_URL = process.env.LETTA_BASE_URL || "https://api.letta.com";
const LETTA_API_KEY = process.env.LETTA_API_KEY;

if (!LETTA_API_KEY) {
  console.warn("WARNING: LETTA_API_KEY is not set. This is required for Letta Cloud.");
}

// 新版 SDK (v1.x) 使用 Letta 类和 apiKey/baseURL 配置
export const lettaClient = new Letta({
  apiKey: LETTA_API_KEY,
  baseURL: LETTA_BASE_URL,
  maxRetries: 4,          // 网络抖动时自动重试（默认 2 次太少）
  timeout: 2 * 60 * 1000, // 2 分钟超时（默认 1 分钟，流式场景可能不够）
});
