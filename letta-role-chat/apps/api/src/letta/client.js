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
exports.lettaClient = new letta_client_1.LettaClient({
    baseUrl: LETTA_BASE_URL, // v0.x 常用 baseUrl
    token: LETTA_API_KEY, // v0.x 常用 token
});
