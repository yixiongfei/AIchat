"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.textToSpeechFile = textToSpeechFile;
exports.deleteAudioFile = deleteAudioFile;
exports.getAudioFilePath = getAudioFilePath;
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
// 强制使用标准 OpenAI 基础 URL 以避免代理不支持 TTS 的问题
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
});
// 语音文件暂存目录
const TEMP_AUDIO_DIR = path_1.default.join(process.cwd(), "temp_audio");
// 确保目录存在
if (!fs_1.default.existsSync(TEMP_AUDIO_DIR)) {
    fs_1.default.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
}
/**
 * 把文本转换为音频并保存到本地文件
 */
async function textToSpeechFile(params) {
    const { text, voice = "shimmer", speed = 1.10, model = process.env.TTS_MODEL || "gpt-4o-mini-tts", format = process.env.TTS_FORMAT || "mp3", instructions = "请用健康、阳光、活泼的少女风格朗读。", } = params;
    if (!text?.trim()) {
        throw new Error("text is empty");
    }
    const fileName = `${(0, uuid_1.v4)()}.${format}`;
    const filePath = path_1.default.join(TEMP_AUDIO_DIR, fileName);
    try {
        // 使用官方推荐的流式响应方式
        const response = await openai.audio.speech.create({
            model,
            voice: voice,
            input: text,
            response_format: format,
            speed: speed,
            instructions: instructions,
        });
        // 将响应流写入文件
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs_1.default.promises.writeFile(filePath, buffer);
        // 设置自动回收机制：30分钟后删除文件
        setTimeout(() => {
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
                console.log(`Auto-cleaned expired audio file: ${fileName}`);
            }
        }, 30 * 60 * 1000);
        return {
            fileName,
            filePath,
            contentType: formatToContentType(format)
        };
    }
    catch (error) {
        console.error("OpenAI TTS Error:", error);
        // 如果文件已创建但出错，尝试清理
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        throw error;
    }
}
/**
 * 删除指定的音频文件
 */
function deleteAudioFile(fileName) {
    const filePath = path_1.default.join(TEMP_AUDIO_DIR, fileName);
    if (fs_1.default.existsSync(filePath)) {
        try {
            fs_1.default.unlinkSync(filePath);
            return true;
        }
        catch (e) {
            console.error(`Failed to delete file ${fileName}:`, e);
            return false;
        }
    }
    return false;
}
/**
 * 获取音频文件路径
 */
function getAudioFilePath(fileName) {
    return path_1.default.join(TEMP_AUDIO_DIR, fileName);
}
function formatToContentType(format) {
    switch (format) {
        case "wav": return "audio/wav";
        case "mp3": return "audio/mpeg";
        case "opus": return "audio/opus";
        case "aac": return "audio/aac";
        case "flac": return "audio/flac";
        default: return "application/octet-stream";
    }
}
