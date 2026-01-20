
import { LettaClient } from "@letta-ai/letta-client";
import dotenv from "dotenv";

dotenv.config();

const LETTA_BASE_URL = process.env.LETTA_BASE_URL || "https://api.letta.com";
const LETTA_API_KEY = process.env.LETTA_API_KEY;

if (!LETTA_API_KEY) {
  console.warn("WARNING: LETTA_API_KEY is not set. This is required for Letta Cloud.");
}

export const lettaClient = new LettaClient({
  baseUrl: LETTA_BASE_URL,  // v0.x 常用 baseUrl
  token: LETTA_API_KEY,     // v0.x 常用 token
});
