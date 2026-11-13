
import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    const { model, contents, temperature, top_p, max_tokens, stream } = body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google API Key not configured on server (please set GEMINI_API_KEY or API_KEY in environment variables)' }), { status: 500 });
    }

    // Normalize legacy or exhausted Gemini model IDs to active models per @google/genai guidelines
    let resolvedModel = "gemini-4-hydrogen";
    if (typeof model === 'string' && model.trim()) {
      const m = model.toLowerCase().trim();
      if (m.includes("lite")) {
        resolvedModel = "gemini-3.1-flash-lite";
      } else if (
        m === "gemini-3.8-flash" ||
        m === "gemini-3.7-flash" ||
        m === "gemini-3.6-flash" ||
        m === "gemini-3.5-flash" ||
        m === "gemini-3-flash-preview" ||
        m === "gemini-1.5-flash" ||
        m === "gemini-2.0-flash" ||
        m === "gemini-2.0-flash-thinking" ||
        m === "gemini-1.5-pro" ||
        m === "gemini-2.0-pro" ||
        m === "gemini-pro" ||
        m === "gemini-3-pro-preview" ||
        m === "gemini-3.5-pro" ||
        m === "gemini-3.1-pro-preview"
      ) {
        resolvedModel = "gemini-4-hydrogen";
      } else {
        resolvedModel = model.trim();
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

    const buildGenerateConfig = (targetModel: string) => {
      const cfg: Record<string, any> = {};
      if (typeof max_tokens === 'number' && max_tokens > 0) {
        cfg.maxOutputTokens = max_tokens;
      }
      if (!targetModel.startsWith('gemini-4-')) {
        if (typeof temperature === 'number') cfg.temperature = temperature;
        if (typeof top_p === 'number') cfg.topP = top_p;
      }
      return cfg;
    };

    const getCandidateModels = (reqModel: string): string[] => {
        const chain = [
            reqModel,
            "gemini-4-hydrogen",
            "gemini-3.1-flash-lite",
        ];
        return Array.from(new Set(chain));
    };

    if (stream) {
        let responseStream: any;
        const modelsToTry = getCandidateModels(resolvedModel);

        for (let idx = 0; idx < modelsToTry.length; idx++) {
            const currentModel = modelsToTry[idx];
            try {
                responseStream = await ai.models.generateContentStream({
                    model: currentModel,
                    contents: contents,
                    config: buildGenerateConfig(currentModel),
                });
                resolvedModel = currentModel;
                break;
            } catch (streamError: any) {
                const errorMsg = String(streamError.message || streamError);
                const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                if (isQuotaOrProError && idx < modelsToTry.length - 1) {
                    console.warn(`Falling back from ${currentModel} to ${modelsToTry[idx + 1]} due to stream initialization error:`, errorMsg);
                    continue;
                } else {
                    throw streamError;
                }
            }
        }

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of responseStream) {
                        let text = '';
                        try {
                            text = chunk.text || '';
                        } catch (e) {
                            // Property access might throw if candidate is blocked
                        }

                        if (!text && chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                            text = chunk.candidates[0].content.parts[0].text;
                        }
                        
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (e: any) {
                    console.error("Gemini Stream Error, checking fallback", e);
                    const errorMsg = String(e.message || e);
                    const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                    if (isQuotaOrProError) {
                        const fallbackModel = resolvedModel === "gemini-3.1-flash-lite" ? "gemini-4-hydrogen" : "gemini-3.1-flash-lite";
                        console.warn(`Falling back from ${resolvedModel} to ${fallbackModel} due to stream iteration error:`, errorMsg);
                        try {
                            const fallbackStream = await ai.models.generateContentStream({
                                model: fallbackModel,
                                contents: contents,
                                config: buildGenerateConfig(fallbackModel),
                            });
                            for await (const chunk of fallbackStream) {
                                let text = '';
                                try {
                                    text = chunk.text || '';
                                } catch (e2) {}
                                if (!text && chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                                    text = chunk.candidates[0].content.parts[0].text;
                                }
                                if (text) {
                                    controller.enqueue(encoder.encode(text));
                                }
                            }
                        } catch (fallbackError: any) {
                            console.error("Fallback stream error:", fallbackError);
                        }
                    }
                    try { controller.close(); } catch {}
                }
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } else {
        let response: any;
        const modelsToTry = getCandidateModels(resolvedModel);

        for (let idx = 0; idx < modelsToTry.length; idx++) {
            const currentModel = modelsToTry[idx];
            try {
                response = await ai.models.generateContent({
                    model: currentModel,
                    contents: contents,
                    config: buildGenerateConfig(currentModel),
                });
                resolvedModel = currentModel;
                break;
            } catch (contentError: any) {
                const errorMsg = String(contentError.message || contentError);
                const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                if (isQuotaOrProError && idx < modelsToTry.length - 1) {
                    console.warn(`Falling back from ${currentModel} to ${modelsToTry[idx + 1]} due to content generation error:`, errorMsg);
                    continue;
                } else {
                    throw contentError;
                }
            }
        }

        return new Response(JSON.stringify({ text: response?.text || '' }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("Gemini API Error:", msg);
    const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), { status });
  }
}
