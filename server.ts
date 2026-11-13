import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// Helper functions for fallback providers when Gemini is exhausted/429
async function handleFallbackStream(provider: "deepseek" | "doubao", apiKey: string, prompt: string, res: any) {
  const url = provider === "deepseek" 
    ? "https://api.deepseek.com/chat/completions" 
    : "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  
  const modelId = provider === "deepseek" ? "deepseek-chat" : "ep-20251229180745-tbpdh";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: "You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. Use Markdown headers (# ## ###) for structure." },
        { role: "user", content: prompt }
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Fallback ${provider} API error: ${response.status}`);
  }

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === "[DONE]") continue;

        try {
          const json = JSON.parse(jsonStr);
          const content = json.choices?.[0]?.delta?.content || "";
          if (content) {
            res.write(content);
          }
        } catch (e) {
          // ignore parsing error for chunk
        }
      }
    }
  }
}

async function handleFallbackContent(provider: "deepseek" | "doubao", apiKey: string, prompt: string): Promise<string> {
  const url = provider === "deepseek" 
    ? "https://api.deepseek.com/chat/completions" 
    : "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
  
  const modelId = provider === "deepseek" ? "deepseek-chat" : "ep-20251229180745-tbpdh";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: "You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. Use Markdown headers (# ## ###) for structure." },
        { role: "user", content: prompt }
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Fallback ${provider} API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // API Route: Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model, contents, temperature, top_p, max_tokens, stream } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Google API Key not configured on server" });
      }

      // Support user-selected models directly with fallback
      let resolvedModel = model || "gemini-3.8-flash";
      if (typeof model === 'string') {
        const m = model.toLowerCase().trim();
        if (m === "gemini-3-flash-preview" || m === "gemini-1.5-flash") {
          resolvedModel = "gemini-3.5-flash";
        } else if (m === "gemini-3-pro-preview" || m === "gemini-1.5-pro" || m === "gemini-3.5-pro") {
          resolvedModel = "gemini-3.1-pro-preview";
        } else {
          resolvedModel = model;
        }
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const generateConfig = {
        temperature: temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
      };

      // Helper for fallback chains on free tier quota exhaustion (429)
      const getFallbackModels = (requestedModel: string): string[] => {
        const candidateChain = [
          requestedModel,
          "gemini-3.8-flash",
          "gemini-3.7-flash",
          "gemini-3.5-flash",
          "gemini-3.6-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.1-pro-preview"
        ];
        return Array.from(new Set(candidateChain));
      };

      const executeWithRetry = async <T>(
        operation: () => Promise<T>,
        modelName: string,
        maxRetries = 2,
        baseDelay = 1000
      ): Promise<T> => {
        let lastError: any = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await operation();
          } catch (error: any) {
            lastError = error;
            const errMsg = String(error.message || error);
            const isRetryable = 
              errMsg.toLowerCase().includes("503") || 
              errMsg.toLowerCase().includes("429") || 
              errMsg.toLowerCase().includes("500") || 
              errMsg.toLowerCase().includes("overloaded") || 
              errMsg.toLowerCase().includes("quota") || 
              errMsg.toLowerCase().includes("rate limit") || 
              errMsg.toLowerCase().includes("unavailable") || 
              errMsg.toLowerCase().includes("busy") ||
              errMsg.toLowerCase().includes("temporary");

            if (isRetryable && attempt < maxRetries) {
              const delay = baseDelay * Math.pow(2, attempt);
              console.warn(`[Gemini API Retry] Model ${modelName} encountered retryable error: ${errMsg.substring(0, 150)}. Retrying in ${delay}ms (Attempt ${attempt + 1}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw error;
            }
          }
        }
        throw lastError || new Error("Failed after retries");
      };

      if (stream) {
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Access-Control-Allow-Origin", "*");
        
        const modelsToTry = getFallbackModels(resolvedModel);
        let success = false;
        let lastError: any = null;

        for (const currentModel of modelsToTry) {
          try {
            console.log(`[Gemini API] Attempting stream generation with model: ${currentModel}`);
            const responseStream = await executeWithRetry(
              () => ai.models.generateContentStream({
                model: currentModel,
                contents: contents,
                config: generateConfig,
              }),
              currentModel
            );
            
            for await (const chunk of responseStream) {
              let text = "";
              try {
                text = chunk.text || "";
              } catch (e) {
                // ignore blocked content errors
              }

              if (!text && chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                text = chunk.candidates[0].content.parts[0].text;
              }

              if (text) {
                res.write(text);
              }
            }
            success = true;
            break; // Break out on success
          } catch (streamError: any) {
            lastError = streamError;
            const errorMsg = String(streamError.message || streamError);
            console.warn(`[Gemini API] Model ${currentModel} failed in stream:`, errorMsg);
            
            // Continue to the next fallback model for any network, 429, or quota error
            continue;
          }
        }

        if (!success) {
          if (process.env.DEEPSEEK_API_KEY) {
            console.log("[Gemini API] Falling back to DeepSeek Chat due to Gemini exhaustion in stream");
            try {
              await handleFallbackStream("deepseek", process.env.DEEPSEEK_API_KEY, contents, res);
              success = true;
            } catch (err: any) {
              console.error("[Gemini API] Fallback to DeepSeek failed:", err);
              throw err;
            }
          } else if (process.env.ARK_API_KEY) {
            console.log("[Gemini API] Falling back to Doubao Chat due to Gemini exhaustion in stream");
            try {
              await handleFallbackStream("doubao", process.env.ARK_API_KEY, contents, res);
              success = true;
            } catch (err: any) {
              console.error("[Gemini API] Fallback to Doubao failed:", err);
              throw err;
            }
          } else {
            throw lastError || new Error("All fallback Gemini models exhausted in stream");
          }
        }
        res.end();
      } else {
        const modelsToTry = getFallbackModels(resolvedModel);
        let response = null;
        let success = false;
        let lastError: any = null;

        for (const currentModel of modelsToTry) {
          try {
            console.log(`[Gemini API] Attempting content generation with model: ${currentModel}`);
            response = await executeWithRetry(
              () => ai.models.generateContent({
                model: currentModel,
                contents: contents,
                config: generateConfig,
              }),
              currentModel
            );
            success = true;
            break;
          } catch (contentError: any) {
            lastError = contentError;
            const errorMsg = String(contentError.message || contentError);
            console.warn(`[Gemini API] Model ${currentModel} failed in generation:`, errorMsg);
            
            // Continue to the next fallback model for any network, 429, or quota error
            continue;
          }
        }

        if (!success || !response) {
          if (process.env.DEEPSEEK_API_KEY) {
            console.log("[Gemini API] Falling back to DeepSeek Chat due to Gemini exhaustion in generation");
            try {
              const text = await handleFallbackContent("deepseek", process.env.DEEPSEEK_API_KEY, contents);
              res.json({ text });
              return;
            } catch (err: any) {
              console.error("[Gemini API] Fallback to DeepSeek failed:", err);
              throw err;
            }
          } else if (process.env.ARK_API_KEY) {
            console.log("[Gemini API] Falling back to Doubao Chat due to Gemini exhaustion in generation");
            try {
              const text = await handleFallbackContent("doubao", process.env.ARK_API_KEY, contents);
              res.json({ text });
              return;
            } catch (err: any) {
              console.error("[Gemini API] Fallback to Doubao failed:", err);
              throw err;
            }
          } else {
            throw lastError || new Error("All fallback Gemini models exhausted in generation");
          }
        }

        res.json({ text: response.text });
      }
    } catch (error: any) {
      console.error("Gemini API Error inside Express:", error);
      res.status(500).json({ error: error.message || String(error) });
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
        model: 'gemini-embedding-001',
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
      });

      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json");
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
          max_tokens,
          stream,
        }),
      });

      res.status(response.status);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "application/json");
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
