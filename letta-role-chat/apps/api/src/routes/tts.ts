
import express from "express";
import fs from "fs";
import { textToSpeechFile, deleteAudioFile, getAudioFilePath } from "../letta/tts.service";

const tts = express.Router();

/**
 * 请求 TTS 转换，返回音频文件名
 */
tts.post("/tts", async (req, res) => {
  try {
    const message: string = req.body?.message ?? "";
    const { voice, speed, pitch, style } = req.body;
    const { fileName } = await textToSpeechFile({
      text: message,
      voice,
      // 支持前端传 string 或 number
      speed: typeof speed === "string" ? parseFloat(speed) : typeof speed === "number" ? speed : undefined,
      // 不再包装为 `Pitch: ...` / `Style: ...`，直接传原始值
      pitch: pitch ?? undefined,
      style: style ?? undefined,
    });

    res.status(200).json({ fileName });
  } catch (err: any) {
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
  const filePath = getAudioFilePath(fileName);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "Audio file not found" });
  }
});

/**
 * 播放完毕后删除音频文件
 */
tts.delete("/tts/audio/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const success = deleteAudioFile(fileName);
  if (success) {
    res.status(200).json({ message: "Deleted" });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

export default tts;
