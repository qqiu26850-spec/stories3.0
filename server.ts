import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      // Map models gracefully to prevent 404/Quota issues
      let resolvedModel = model;
      if (typeof model === 'string') {
        const m = model.toLowerCase();
        if (m === "gemini-3-flash-preview" || m === "gemini-3.5-flash-preview" || m === "gemini-3.5-flash") {
          resolvedModel = "gemini-3.5-flash";
        } else if (m === "gemini-3-pro-preview" || m === "gemini-3.5-pro") {
          resolvedModel = "gemini-3.1-pro-preview";
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      const generateConfig = {
        temperature: temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
      };

      // Helper for fallback chains on free tier quota exhaustion (429)
      const getFallbackModels = (requestedModel: string): string[] => {
        const m = requestedModel.toLowerCase();
        const proChain = [
          "gemini-3.1-pro-preview",
          "gemini-2.5-pro",
          "gemini-1.5-pro",
          "gemini-3.5-flash",
          "gemini-2.5-flash",
          "gemini-1.5-flash"
        ];
        const flashChain = [
          "gemini-3.5-flash",
          "gemini-2.5-flash",
          "gemini-1.5-flash"
        ];

        if (m.includes("pro")) {
          const filtered = proChain.filter(x => x !== requestedModel);
          return [requestedModel, ...filtered];
        } else {
          const filtered = flashChain.filter(x => x !== requestedModel);
          return [requestedModel, ...filtered];
        }
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
            const responseStream = await ai.models.generateContentStream({
              model: currentModel,
              contents: contents,
              config: generateConfig,
            });
            
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
          throw lastError || new Error("All fallback Gemini models exhausted in stream");
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
            response = await ai.models.generateContent({
              model: currentModel,
              contents: contents,
              config: generateConfig,
            });
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
          throw lastError || new Error("All fallback Gemini models exhausted in generation");
        }

        res.json({ text: response.text });
      }
    } catch (error: any) {
      console.error("Gemini API Error inside Express:", error);
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
