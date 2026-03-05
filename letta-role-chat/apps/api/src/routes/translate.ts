// translate.ts — 轻量翻译接口，直接调用 OpenAI API
import { Router } from "express";
import OpenAI from "openai";
import "dotenv/config";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.LETTA_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const LANG_MAP: Record<string, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
};

/** 各目标语言的翻译提示词 */
const LANG_PROMPTS: Record<string, string> = {
  ja: [
    "あなたはプロの翻訳者兼リライト担当です。ユーザーの入力を、意図を変えずに「自然で丁寧な口語の日本語」にしてください。",
    "",
    "【目的】",
    "- 直訳ではなく、日本人が実際に職場で使う自然な日本語に仕上げる。",
    "- 硬い書き言葉（〜である、〜とのこと）ではなく、丁寧な話し言葉（です・ます調）を基本とする。",
    "",
    "【ルール】",
    "1. 翻訳結果のみを返す。説明・注釈・メタ情報は不要。",
    "2. 中国語の直訳調を避け、日本語として自然な語順・表現に組み替えてよい。",
    "   - ✗「この問題について、私は確認しました」",
    "   - ✓「この件、確認しました」",
    "3. 主語の省略、「〜ですが」「〜なんですが」等の口語的な接続を積極的に使う。",
    "4. 適度にクッション言葉を補う（お手数ですが／念のため／恐れ入りますが 等）。ただし過剰なへりくだりは避ける。",
    "5. 「事実・条件・数値・期限・責任範囲」は勝手に追加・変更しない。",
    "6. IT・ソフトウェア関連の専門用語は正確に訳す（改修、修正、検証、エビデンス、テストケース等）。",
    "7. 数字・日付・英語の識別子（変数名、ID、URL、ファイル名等）は原文のまま保持。",
    "8. 原文の改行・箇条書き・フォーマットは維持する。",
    "",
    "【文体の例】",
    "- 「我确认了一下，没有问题」→「確認しましたが、問題なさそうです」",
    "- 「这个bug我来修」→「このバグ、こちらで対応しますね」",
    "- 「能帮我看一下吗」→「すみません、ちょっと見ていただけますか」",
    "- 「数据好像不对」→「データがちょっとおかしいかもしれません」",
  ].join("\n"),

  zh: [
    "你是专业的翻译，擅长 IT 和软件测试领域。将用户输入的文本翻译为中文。",
    "规则：",
    "1. 只返回翻译结果，不要添加任何解释、注释或额外内容。",
    "2. IT/软件开发/测试相关的专业术语尽量准确。",
    "3. 纯数字、日期、英文标识符（变量名、ID 等）保持原样不翻译。",
    "4. 保持原文的换行和格式。",
    "5. 翻译风格自然流畅，不要生硬的直译。",
  ].join("\n"),

  en: [
    "You are a professional translator specializing in IT and software development.",
    "Translate the user's input into English.",
    "Rules:",
    "1. Return ONLY the translation. No explanations, notes, or extra content.",
    "2. Use accurate terminology for IT/software testing concepts.",
    "3. Keep numbers, dates, and code identifiers (variable names, IDs) as-is.",
    "4. Maintain the original line breaks and formatting.",
    "5. Use clear, natural English.",
  ].join("\n"),

  ko: [
    "당신은 전문 번역가입니다. 사용자가 입력한 텍스트를 한국어로 번역해 주세요.",
    "규칙:",
    "1. 번역 결과만 반환하세요. 설명이나 주석은 불필요합니다.",
    "2. IT/소프트웨어 관련 전문 용어는 정확하게 번역하세요.",
    "3. 숫자, 날짜, 영문 식별자는 그대로 유지하세요.",
    "4. 원문의 줄바꿈과 서식을 유지하세요.",
  ].join("\n"),
};

/** 获取系统提示词 */
function getSystemPrompt(targetLang: string): string {
  // 优先使用预定义的提示词
  if (LANG_PROMPTS[targetLang]) {
    return LANG_PROMPTS[targetLang];
  }
  // 兜底：通用提示词
  const langName = LANG_MAP[targetLang] || targetLang;
  return [
    `你是专业翻译。将用户输入的文本翻译为${langName}。`,
    "规则：",
    "1. 只返回翻译结果，不要添加任何解释或额外内容。",
    "2. 专业术语（IT/软件相关）尽量准确。",
    "3. 纯数字、日期、英文标识符保持原样。",
    "4. 保持原文的换行和格式。",
  ].join("\n");
}

/**
 * POST /api/translate
 * Body: { text: string, targetLang: string }
 * Response: { result: string }
 */
router.post("/translate", async (req, res) => {
  const { text, targetLang = "ja" } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  if (text.trim().length === 0) {
    return res.json({ result: "" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.TRANSLATE_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: getSystemPrompt(targetLang),
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const result = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!result) {
      return res.status(500).json({ error: "Translation returned empty result" });
    }

    const preview = (s: string) => (s.length > 30 ? s.slice(0, 30) + "..." : s);
    console.log(`[Translate → ${targetLang}] ${preview(text)} → ${preview(result)}`);

    res.json({ result });
  } catch (error: any) {
    console.error("[Translate] Error:", error.message);

    // OpenAI 额度不足时返回明确提示
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("insufficient_quota") || msg.includes("billing")) {
      return res.status(503).json({
        error: "Translation service quota exceeded",
        detail: "OpenAI API 额度不足，请检查账户余额。",
      });
    }

    res.status(500).json({
      error: "Translation failed",
      detail: error.message,
    });
  }
});

export default router;
