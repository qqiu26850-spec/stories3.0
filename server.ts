import express from "express";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for parsing JSON requests
  app.use(express.json({ limit: "10mb" }));

  // API Route: Gemini (strictly uses user-selected model, never silently switches models)
  app.post("/api/gemini", async (req, res) => {
    try {
      const {
        model,
        contents,
        temperature,
        top_p,
        max_tokens,
        stream,
        responseMimeType,
        thinkingLevel,
      } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Google API Key not configured on server" });
      }

      // Normalize deprecated/sunset model aliases while preserving exact active model choice
      const normalizeGeminiModel = (rawModel?: string): string => {
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
      };

      const resolvedModel = normalizeGeminiModel(model);

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const resolveThinkingLevel = (
        targetModel: string,
        levelRaw?: string,
        isStreamRequest = false
      ): ThinkingLevel | undefined => {
        if (!(targetModel.startsWith("gemini-4-") || targetModel.startsWith("gemini-3"))) {
          return undefined;
        }
        if (!levelRaw || typeof levelRaw !== "string") {
          // Default gemini-4-hydrogen uses HIGH thinking which stalls creative streaming for 50-90s with 0 bytes.
          // Default streaming creative requests to LOW thinking for ~2-4s first-token response while keeping quality.
          if (isStreamRequest && targetModel.startsWith("gemini-4-")) {
            return ThinkingLevel.LOW;
          }
          return undefined;
        }
        const upper = levelRaw.trim().toUpperCase();
        if (upper === "MINIMAL") {
          // gemini-4-* does not support MINIMAL; clamp to LOW
          return targetModel.startsWith("gemini-4-") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;
        }
        if (upper === "LOW") return ThinkingLevel.LOW;
        if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
        if (upper === "HIGH") return ThinkingLevel.HIGH;
        if (upper === "XHIGH" && targetModel === "gemini-4-hydrogen") {
          return ThinkingLevel.XHIGH;
        }
        return undefined;
      };

      const buildGenerateConfig = (
        targetModel: string,
        includeThinking = true,
        includeResponseMime = true,
        isStreamRequest = false
      ) => {
        const cfg: Record<string, any> = {};
        if (typeof max_tokens === "number" && max_tokens > 0) {
          // Note: maxOutputTokens includes both visible tokens and internal thinking tokens.
          // Add headroom on creative text calls so thinking tokens never starve visible output length.
          const isJsonCall = Boolean(responseMimeType && String(responseMimeType).includes("json"));
          cfg.maxOutputTokens = isJsonCall
            ? Math.min(65536, max_tokens)
            : Math.min(65536, Math.max(max_tokens, Math.round(max_tokens * 1.25)));
        }
        // Do not pass deprecated sampling parameters (temperature, topP, topK, candidateCount) to gemini-4-*
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

      const extractGeminiResponseText = (resp: any): { text: string; finishReason?: string } => {
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
            // ignore getter error when response contains only thought/blocked parts
          }
        }
        return { text, finishReason };
      };

      const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
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
      };

      const isDailyQuotaOrFatalError = (errMsg: string): boolean => {
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
      };

      const executeWithRetry = async <T>(
        operation: () => Promise<T>,
        modelName: string,
        maxRetries = 1,
        baseDelay = 800
      ): Promise<T> => {
        let lastError: any = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error: any) {
            lastError = error;
            const errMsg = String(error.message || error);
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
              console.warn(`[Gemini API Retry] Model ${modelName} transient error: ${errMsg.substring(0, 150)}. Retrying in ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              throw error;
            }
          }
        }
        throw lastError || new Error("Failed after retries");
      };

      if (stream) {
        console.log(`[Gemini API] Stream generation with selected model: ${resolvedModel}`);
        const openStream = async (includeThinking: boolean) =>
          withTimeout(
            ai.models.generateContentStream({
              model: resolvedModel,
              contents: contents,
              config: buildGenerateConfig(resolvedModel, includeThinking, true, true),
            }),
            45000,
            `Stream connect ${resolvedModel}`
          );

        const responseStream = await executeWithRetry(
          async () => {
            try {
              return await openStream(true);
            } catch (cfgErr: any) {
              const cfgMsg = String(cfgErr?.message || cfgErr).toLowerCase();
              if (cfgMsg.includes("invalid_argument") || cfgMsg.includes("thinking") || cfgMsg.includes("400")) {
                console.warn(`[Gemini API] Retrying stream ${resolvedModel} without thinkingConfig`);
                return await openStream(false);
              }
              throw cfgErr;
            }
          },
          resolvedModel
        );

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (typeof res.flushHeaders === "function") {
          res.flushHeaders();
        }

        let wroteAnyText = false;
        let lastFinishReason = "";
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
              // ignore blocked content getter error
            }
          }

          if (text) {
            wroteAnyText = true;
            res.write(text);
          }
        }

        // Fallback if stream returned 0 visible characters (e.g. blocked or thought-only response)
        if (!wroteAnyText) {
          const upperReason = lastFinishReason.toUpperCase();
          if (
            upperReason.includes("SAFETY") ||
            upperReason.includes("PROHIBITED") ||
            upperReason.includes("BLOCK") ||
            upperReason.includes("RECITATION")
          ) {
            res.write(`⚠️ 当前生成请求触发了模型内容安全拦截（原因：${lastFinishReason}），未返回正文。请调整敏感冲突词汇或切换至其他模型后重试。`);
          } else {
            try {
              const fallbackResp = await withTimeout(
                ai.models.generateContent({
                  model: resolvedModel,
                  contents: contents,
                  config: buildGenerateConfig(resolvedModel, false, true, false),
                }),
                45000,
                `Fallback non-stream ${resolvedModel}`
              );
              const extracted = extractGeminiResponseText(fallbackResp);
              if (extracted.text) {
                res.write(extracted.text);
              } else {
                res.write(`⚠️ 模型未返回有效文本（状态：${extracted.finishReason || lastFinishReason || "EMPTY"}），请稍后重试或切换其他模型。`);
              }
            } catch (fbErr: any) {
              res.write(`⚠️ 模型响应超时或为空（${fbErr?.message || "EMPTY"}），请重试或切换其他模型。`);
            }
          }
        }
        res.end();
      } else {
        console.log(`[Gemini API] Content generation with selected model: ${resolvedModel}`);
        const response = await executeWithRetry(
          async () => {
            try {
              return await withTimeout(
                ai.models.generateContent({
                  model: resolvedModel,
                  contents: contents,
                  config: buildGenerateConfig(resolvedModel, true, true, false),
                }),
                55000,
                `Model ${resolvedModel}`
              );
            } catch (cfgErr: any) {
              const cfgMsg = String(cfgErr?.message || cfgErr).toLowerCase();
              const isConfigRejection =
                cfgMsg.includes("invalid_argument") ||
                cfgMsg.includes("thinking") ||
                cfgMsg.includes("responsemimetype") ||
                cfgMsg.includes("400");

              if (thinkingLevel !== undefined && isConfigRejection) {
                console.warn(`[Gemini API] Retrying ${resolvedModel} without thinkingConfig (preserving responseMimeType)`);
                try {
                  return await withTimeout(
                    ai.models.generateContent({
                      model: resolvedModel,
                      contents: contents,
                      config: buildGenerateConfig(resolvedModel, false, true, false),
                    }),
                    55000,
                    `Model ${resolvedModel}`
                  );
                } catch (mimeErr: any) {
                  const mimeMsg = String(mimeErr?.message || mimeErr).toLowerCase();
                  if (responseMimeType !== undefined && (mimeMsg.includes("responsemimetype") || mimeMsg.includes("invalid_argument"))) {
                    console.warn(`[Gemini API] Retrying ${resolvedModel} without responseMimeType`);
                    return await withTimeout(
                      ai.models.generateContent({
                        model: resolvedModel,
                        contents: contents,
                        config: buildGenerateConfig(resolvedModel, false, false, false),
                      }),
                      55000,
                      `Model ${resolvedModel}`
                    );
                  }
                  throw mimeErr;
                }
              }
              throw cfgErr;
            }
          },
          resolvedModel
        );

        const extracted = extractGeminiResponseText(response);
        if (!extracted.text) {
          throw new Error(`Model ${resolvedModel} returned empty text (finishReason: ${extracted.finishReason || "EMPTY"})`);
        }

        res.json({
          text: extracted.text,
          modelUsed: resolvedModel,
          finishReason: extracted.finishReason,
        });
      }
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error("[Gemini API Error inside Express]:", msg);
      if (res.headersSent) {
        try {
          res.write(`\n\n⚠️ 生成连接中断：${msg.slice(0, 160)}`);
          res.end();
        } catch {
          // ignore secondary write errors
        }
        return;
      }
      const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
      res.status(status).json({ error: msg });
    }
  });

  // API Route: Gemini Embed
  app.post("/api/gemini/embed", async (req, res) => {
    try {
      const { text } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Google API Key not configured on server" });
      }

      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text string is required for embedding" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
        config: {
          outputDimensionality: 768
        }
      });

      const resData = response as any;
      const embedding = resData.embedding?.values || resData.embeddings?.values;
      if (!embedding) {
        throw new Error("Failed to generate embedding: empty values returned from Gemini");
      }

      res.json({ embedding });
    } catch (error: any) {
      console.error("Gemini Embedding API Error inside Express:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // API Route: DeepSeek
  app.post("/api/deepseek", async (req, res) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "DeepSeek API Key not configured on server" });
      }

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(45000),
      });

      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("DeepSeek API Error inside Express:", error);
      if (res.headersSent) {
        try {
          res.end();
        } catch {}
        return;
      }
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // API Route: Doubao
  app.post("/api/doubao", async (req, res) => {
    try {
      const apiKey = process.env.ARK_API_KEY;
      const { model, messages, temperature, top_p, max_tokens, stream } = req.body;

      if (!apiKey) {
        return res.status(500).json({ error: "ARK_API_KEY not configured on server" });
      }

      let endpointId = "";
      if (model && model.startsWith("doubao")) {
        endpointId = "ep-20251229180745-tbpdh";
      } else {
        endpointId = model;
      }

      const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/json",
        },
        body: JSON.stringify({
          model: endpointId,
          messages,
          temperature,
          top_p,
          max_tokens: typeof max_tokens === "number" ? Math.min(max_tokens, 16384) : max_tokens,
          stream,
        }),
        signal: AbortSignal.timeout(45000),
      });

      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Access-Control-Allow-Origin", "*");

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Doubao API Error inside Express:", error);
      if (res.headersSent) {
        try {
          res.end();
        } catch {}
        return;
      }
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Integrate Vite dev server or serve static build
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
