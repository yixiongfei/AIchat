import { Router } from "express";
import OpenAI from "openai";
import "dotenv/config";

const router = Router();

// 翻译接口使用 OpenAI 直接调用，不走 Letta agent 记忆系统，响应更快
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.LETTA_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const LANG_MAP: Record<string, string> = {
  ja: "日文",
  en: "英文",
  zh: "中文",
  ko: "韩文",
  fr: "法文",
  de: "德文",
};

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string }
 * Response: { result: string }
 *
 * 轻量翻译接口，直接调用 OpenAI API
 */
router.post("/translate", async (req, res) => {
  const { text, targetLang = "ja" } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  const langName = LANG_MAP[targetLang] || targetLang;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.TRANSLATE_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `你是一个专业翻译。将用户输入的文本翻译为${langName}。只返回翻译结果，不要添加任何解释、注释或额外内容。`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const result = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!result) {
      return res.status(500).json({ error: "Translation returned empty result" });
    }

    console.log(`[Translate] ${text.slice(0, 30)}... → ${result.slice(0, 30)}...`);
    res.json({ result });
  } catch (error: any) {
    console.error("Translation error:", error);
    res.status(500).json({
      error: "Translation failed",
      detail: error.message,
    });
  }
});

export default router;
