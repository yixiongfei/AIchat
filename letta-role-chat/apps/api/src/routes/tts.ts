
// server.ts (或 routes/tts.ts)
import express from "express";
import { textToSpeechBuffer } from "../letta/tts.service";

const tts = express();
tts.use(express.json({ limit: "1mb" }));

tts.post("/tts", async (req, res) => {
  try {
    const message: string = req.body?.message ?? "";
    const format = (req.body?.format ?? "mp3") as any;

    const { buffer, contentType } = await textToSpeechBuffer({
      text: message,
      format,
      // instructions: "Speak slowly and clearly in a friendly tone.",
    });

    res.setHeader("Content-Type", contentType);
    // 让浏览器可以直接播放或下载（二选一）
    // res.setHeader("Content-Disposition", 'attachment; filename="tts.mp3"');
    res.status(200).send(buffer);
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "TTS timeout" : (err?.message || "TTS error");
    res.status(500).json({ error: msg });
  }
});

export default tts;
