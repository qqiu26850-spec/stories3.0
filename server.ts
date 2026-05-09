import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model, contents, temperature, top_p, max_tokens, stream } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Google API Key not configured" });
      }

      const ai = new GoogleGenAI({ apiKey });

      const generationConfig = {
        temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
      };

      if (stream) {
        res.setHeader("Content-Type", "text/plain");
        const result = await ai.models.generateContentStream({
          model,
          contents: [{ role: 'user', parts: [{ text: contents }] }],
          config: generationConfig,
        } as any);

        for await (const chunk of result) {
          const text = (chunk as any).text || "";
          if (text) {
            res.write(text);
          }
        }
        res.end();
      } else {
        const result = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: contents }] }],
          config: generationConfig,
        } as any);
        res.json({ text: (result as any).text });
      }
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/deepseek", async (req, res) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "DeepSeek API Key not configured" });
      }

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body),
      });

      if (req.body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/doubao", async (req, res) => {
    try {
      const apiKey = process.env.DOUBAO_API_KEY;
      const endpoint = process.env.DOUBAO_ENDPOINT || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
      
      if (!apiKey) {
        return res.status(500).json({ error: "Doubao API Key not configured" });
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body),
      });

      if (req.body.stream) {
        res.setHeader("Content-Type", "text/event-stream");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        const data = await response.json();
        res.json(data);
      }
    } catch (error: any) {
      console.error("Doubao Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
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
