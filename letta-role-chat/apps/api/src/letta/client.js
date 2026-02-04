"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lettaClient = void 0;
const letta_client_1 = require("@letta-ai/letta-client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const LETTA_BASE_URL = process.env.LETTA_BASE_URL || "https://api.letta.com";
const LETTA_API_KEY = process.env.LETTA_API_KEY;
if (!LETTA_API_KEY) {
    console.warn("WARNING: LETTA_API_KEY is not set. This is required for Letta Cloud.");
}
// 新版 SDK (v1.x) 使用 Letta 类和 apiKey/baseURL 配置
exports.lettaClient = new letta_client_1.Letta({
    apiKey: LETTA_API_KEY,
    baseURL: LETTA_BASE_URL,
});
