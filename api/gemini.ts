import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const config = {
  runtime: "edge",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function normalizeGeminiModel(rawModel?: string): string {
  const m = typeof rawModel === "string" ? rawModel.toLowerCase().trim() : "";
  if (!m) return "gemini-4-hydrogen";
  if (
    m === "gemini-3.1-flash-lite" ||
    m === "gemini-3.1-flash-lite-preview" ||
    m === "flash lite" ||
    m === "gemini lite"
  ) {
    return "gemini-3.1-flash-lite";
  }
  if (
    m === "gemini-4-hydrogen" ||
    m === "gemini-4-argon" ||
    m === "gemini-4-carbon"
  ) {
    return m;
  }
  if (
    m.startsWith("gemini-3.5") ||
    m.includes("3-5") ||
    m.includes("3.5") ||
    m.includes("flash") ||
    m === "gemini-2.0" ||
    m === "gemini-1.5"
  ) {
    return "gemini-3.1-flash-lite";
  }
  if (
    m.startsWith("gemini-3.8") ||
    m.startsWith("gemini-3.7") ||
    m.startsWith("gemini-3.6") ||
    m.startsWith("gemini-2.5") ||
    m.startsWith("gemini-2.0") ||
    m.startsWith("gemini-1.5") ||
    m === "gemini-pro" ||
    m === "gemini-3-pro-preview" ||
    m === "gemini-3.1-pro-preview" ||
    m.startsWith("claude-3")
  ) {
    return "gemini-4-hydrogen";
  }
  return rawModel!.trim();
}

function resolveThinkingLevel(
  targetModel: string,
  levelRaw?: string,
  isStreamRequest = false
): ThinkingLevel | undefined {
  if (!(targetModel.startsWith("gemini-4-") || targetModel.startsWith("gemini-3"))) {
    return undefined;
  }
  if (!levelRaw || typeof levelRaw !== "string") {
    // Prevent 50-90s first-byte thinking stall on Vercel Edge & browser streams
    if (isStreamRequest && targetModel.startsWith("gemini-4-")) {
      return ThinkingLevel.LOW;
    }
    return undefined;
  }
  const upper = levelRaw.trim().toUpperCase();
  if (upper === "MINIMAL") {
    return targetModel.startsWith("gemini-4-") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;
  }
  if (upper === "LOW") return ThinkingLevel.LOW;
  if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
  if (upper === "HIGH") return ThinkingLevel.HIGH;
  if (upper === "XHIGH" && targetModel === "gemini-4-hydrogen") {
    return ThinkingLevel.XHIGH;
  }
  return undefined;
}

function extractGeminiResponseText(resp: any): { text: string; finishReason?: string } {
  const finishReason = resp?.candidates?.[0]?.finishReason;
  let text = "";
  const parts = resp?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    text = parts
      .filter((p: any) => typeof p?.text === "string" && !p?.thought)
      .map((p: any) => p.text)
      .join("")
      .trim();
  }
  if (!text) {
    try {
      if (typeof resp?.text === "string") {
        text = resp.text.trim();
      }
    } catch {
      // Ignore getter error when candidate only contains thought or blocked parts
    }
  }
  return { text, finishReason };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isDailyQuotaOrFatalError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("perday") ||
    lower.includes("requestsperday") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("limit: 0") ||
    lower.includes("not_found") ||
    lower.includes("404") ||
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("403")
  );
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 1,
  baseDelay = 800
): Promise<T> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errMsg = String(error?.message || error);
      if (isDailyQuotaOrFatalError(errMsg)) {
        throw error;
      }
      const lower = errMsg.toLowerCase();
      const isRetryable =
        lower.includes("503") ||
        lower.includes("500") ||
        lower.includes("overloaded") ||
        lower.includes("unavailable") ||
        lower.includes("busy") ||
        lower.includes("temporary") ||
        (lower.includes("429") && !lower.includes("quota"));

      if (isRetryable && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError || new Error("Failed after retries");
}

export default async function handler(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const {
      model,
      contents,
      temperature,
      top_p,
      max_tokens,
      stream,
      responseMimeType,
      thinkingLevel,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Google API Key not configured on server (please set GEMINI_API_KEY or API_KEY in environment variables)",
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const resolvedModel = normalizeGeminiModel(model);
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const buildGenerateConfig = (
      targetModel: string,
      includeThinking = true,
      includeResponseMime = true,
      isStreamRequest = false
    ) => {
      const cfg: Record<string, any> = {};
      if (typeof max_tokens === "number" && max_tokens > 0) {
        const isJsonCall = Boolean(responseMimeType && String(responseMimeType).includes("json"));
        cfg.maxOutputTokens = isJsonCall
          ? Math.min(65536, max_tokens)
          : Math.min(65536, Math.max(max_tokens, Math.round(max_tokens * 1.25)));
      }
      if (!targetModel.startsWith("gemini-4-")) {
        if (typeof temperature === "number") cfg.temperature = temperature;
        if (typeof top_p === "number") cfg.topP = top_p;
      }
      if (includeResponseMime && typeof responseMimeType === "string" && responseMimeType.trim()) {
        cfg.responseMimeType = responseMimeType.trim();
      }
      if (includeThinking) {
        const resolvedLevel = resolveThinkingLevel(targetModel, thinkingLevel, isStreamRequest);
        if (resolvedLevel) {
          cfg.thinkingConfig = { thinkingLevel: resolvedLevel };
        }
      }
      return cfg;
    };

    if (stream) {
      const openStream = async (includeThinking: boolean) =>
        withTimeout(
          ai.models.generateContentStream({
            model: resolvedModel,
            contents,
            config: buildGenerateConfig(resolvedModel, includeThinking, true, true),
          }),
          45000,
          `Stream connect ${resolvedModel}`
        );

      const responseStream = await executeWithRetry(async () => {
        try {
          return await openStream(true);
        } catch (cfgErr: any) {
          const cfgMsg = String(cfgErr?.message || cfgErr).toLowerCase();
          if (cfgMsg.includes("invalid_argument") || cfgMsg.includes("thinking") || cfgMsg.includes("400")) {
            return await openStream(false);
          }
          throw cfgErr;
        }
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let wroteAnyText = false;
          let lastFinishReason = "";
          try {
            const iterator = responseStream[Symbol.asyncIterator]();
            while (true) {
              const iterResult = await withTimeout(
                iterator.next(),
                45000,
                `Stream chunk ${resolvedModel}`
              );
              if (iterResult.done) break;
              const chunk = iterResult.value;
              if (chunk?.candidates?.[0]?.finishReason) {
                lastFinishReason = String(chunk.candidates[0].finishReason);
              }

              let text = "";
              if (Array.isArray(chunk?.candidates?.[0]?.content?.parts)) {
                text = chunk.candidates[0].content.parts
                  .filter((p: any) => typeof p?.text === "string" && !p?.thought)
                  .map((p: any) => p.text)
                  .join("");
              }
              if (!text) {
                try {
                  text = chunk?.text || "";
                } catch {
                  // Ignore getter error on blocked candidate
                }
              }

              if (text) {
                wroteAnyText = true;
                controller.enqueue(encoder.encode(text));
              }
            }

            if (!wroteAnyText) {
              const upperReason = lastFinishReason.toUpperCase();
              if (
                upperReason.includes("SAFETY") ||
                upperReason.includes("PROHIBITED") ||
                upperReason.includes("BLOCK") ||
                upperReason.includes("RECITATION")
              ) {
                controller.enqueue(
                  encoder.encode(
                    `⚠️ 当前生成请求触发了模型内容安全拦截（原因：${lastFinishReason}），未返回正文。请调整敏感冲突词汇或切换至其他模型后重试。`
                  )
                );
              } else {
                try {
                  const fallbackResp = await withTimeout(
                    ai.models.generateContent({
                      model: resolvedModel,
                      contents,
                      config: buildGenerateConfig(resolvedModel, false, true, false),
                    }),
                    45000,
                    `Non-stream fallback ${resolvedModel}`
                  );
                  const extracted = extractGeminiResponseText(fallbackResp);
                  if (extracted.text) {
                    controller.enqueue(encoder.encode(extracted.text));
                  } else {
                    controller.enqueue(
                      encoder.encode(
                        `⚠️ 模型未返回可见正文内容${extracted.finishReason ? `（结束状态：${extracted.finishReason}）` : ""}，请重试或切换其他模型。`
                      )
                    );
                  }
                } catch (fbErr: any) {
                  controller.enqueue(
                    encoder.encode(`⚠️ 模型响应中断：${String(fbErr?.message || fbErr).slice(0, 120)}`)
                  );
                }
              }
            }
          } catch (streamErr: any) {
            const msg = String(streamErr?.message || streamErr);
            if (!wroteAnyText) {
              controller.enqueue(encoder.encode(`⚠️ 流式响应异常：${msg.slice(0, 160)}`));
            }
          } finally {
            try {
              controller.close();
            } catch {
              // Ignore already closed controller
            }
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    } else {
      const timeoutMs = responseMimeType === "application/json" ? 55000 : 85000;
      const runGenerate = async (includeThinking: boolean, includeMime: boolean) => {
        const rawResp = await withTimeout(
          ai.models.generateContent({
            model: resolvedModel,
            contents,
            config: buildGenerateConfig(resolvedModel, includeThinking, includeMime, false),
          }),
          timeoutMs,
          `Model ${resolvedModel}`
        );
        return extractGeminiResponseText(rawResp);
      };

      const result = await executeWithRetry(async () => {
        let extracted: { text: string; finishReason?: string };
        try {
          extracted = await runGenerate(true, true);
        } catch (cfgErr: any) {
          const cfgMsg = String(cfgErr?.message || cfgErr).toLowerCase();
          if (
            cfgMsg.includes("invalid_argument") ||
            cfgMsg.includes("thinking") ||
            cfgMsg.includes("mime") ||
            cfgMsg.includes("400")
          ) {
            extracted = await runGenerate(false, false);
          } else {
            throw cfgErr;
          }
        }

        if (!extracted.text) {
          const fallbackExtracted = await runGenerate(false, false);
          if (fallbackExtracted.text) {
            return fallbackExtracted;
          }
          throw new Error(
            `Empty text response from ${resolvedModel} (finishReason: ${
              fallbackExtracted.finishReason || extracted.finishReason || "UNKNOWN"
            })`
          );
        }
        return extracted;
      });

      return new Response(
        JSON.stringify({
          text: result.text,
          modelUsed: resolvedModel,
          finishReason: result.finishReason || "STOP",
        }),
        {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("Gemini Edge API Error:", msg);
    const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
