import fetch from "node-fetch";

/**
 * 调用后端翻译接口，将文本翻译为指定语言
 *
 * @param text - 要翻译的文本
 * @param targetLang - 目标语言代码（如 "ja" 日文, "en" 英文）
 * @param apiBase - 后端 API 基础地址
 * @returns 翻译结果文本
 */
export async function translateText(
  text: string,
  targetLang: string,
  apiBase: string
): Promise<string> {
  const url = `${apiBase}/api/translate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLang }),
    timeout: 30000, // 30 秒超时
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`翻译请求失败 (${response.status}): ${errBody}`);
  }

  const data = (await response.json()) as { result: string };

  if (!data.result) {
    throw new Error("翻译结果为空");
  }

  return data.result;
}
