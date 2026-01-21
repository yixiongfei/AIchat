"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const tts_service_1 = require("../letta/tts.service");
const tts = express_1.default.Router();
/**
 * 请求 TTS 转换，返回音频文件名
 */
tts.post("/tts", async (req, res) => {
    try {
        const message = req.body?.message ?? "";
        const { voice, speed, pitch, style } = req.body;
        const { fileName } = await (0, tts_service_1.textToSpeechFile)({
            text: message,
            voice,
            speed: speed ? parseFloat(speed) : undefined,
            // 注意：OpenAI TTS SDK 可能不支持 pitch 和 style，
            // 但我们可以将其作为 instructions 的一部分或保留以备后用
            instructions: style ? `Style: ${style}. Pitch: ${pitch}.` : undefined,
        });
        res.status(200).json({ fileName });
    }
    catch (err) {
        console.error("TTS Error:", err);
        const msg = err?.name === "AbortError" ? "TTS timeout" : (err?.message || "TTS error");
        res.status(500).json({ error: msg });
    }
});
/**
 * 获取音频文件流
 */
tts.get("/tts/audio/:fileName", (req, res) => {
    const fileName = req.params.fileName;
    const filePath = (0, tts_service_1.getAudioFilePath)(fileName);
    if (fs_1.default.existsSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).json({ error: "Audio file not found" });
    }
});
/**
 * 播放完毕后删除音频文件
 */
tts.delete("/tts/audio/:fileName", (req, res) => {
    const fileName = req.params.fileName;
    const success = (0, tts_service_1.deleteAudioFile)(fileName);
    if (success) {
        res.status(200).json({ message: "Deleted" });
    }
    else {
        res.status(404).json({ error: "File not found" });
    }
});
exports.default = tts;
