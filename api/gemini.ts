
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

    // Support all Gemini models directly
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

    const ai = new GoogleGenAI({ apiKey });

    const generateConfig = {
        temperature: temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
    };

    const getCandidateModels = (reqModel: string): string[] => {
        const chain = [
            reqModel,
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-pro-preview",
        ];
        return Array.from(new Set(chain));
    };

    if (stream) {
        let responseStream;
        const modelsToTry = getCandidateModels(resolvedModel);

        let success = false;
        for (let idx = 0; idx < modelsToTry.length; idx++) {
            const currentModel = modelsToTry[idx];
            try {
                responseStream = await ai.models.generateContentStream({
                    model: currentModel,
                    contents: contents,
                    config: generateConfig,
                });
                resolvedModel = currentModel;
                success = true;
                break;
            } catch (streamError: any) {
                const errorMsg = String(streamError.message || streamError);
                const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                if (isQuotaOrProError && idx < modelsToTry.length - 1) {
                    console.warn(`Falling back from ${currentModel} to ${modelsToTry[idx + 1]} due to stream initialization error:`, streamError);
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
                            // Try standard property access
                            text = chunk.text || '';
                        } catch (e) {
                            // Property access might throw if candidate is blocked
                        }

                        // Fallback: manually inspect candidates if property access failed or returned empty
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
                    const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                    if (isQuotaOrProError) {
                        let fallbackModel = "gemini-3.1-flash-lite";
                        if (resolvedModel === "gemini-3.1-pro-preview") {
                            fallbackModel = "gemini-3.5-flash";
                        }
                        console.warn(`Falling back from ${resolvedModel} to ${fallbackModel} due to stream iteration error:`, e);
                        try {
                            const fallbackStream = await ai.models.generateContentStream({
                                model: fallbackModel,
                                contents: contents,
                                config: generateConfig,
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
                            if (fallbackModel === "gemini-3.5-flash") {
                                try {
                                    console.warn(`Second fallback to gemini-3.1-flash-lite...`);
                                    const secondFallbackStream = await ai.models.generateContentStream({
                                        model: "gemini-3.1-flash-lite",
                                        contents: contents,
                                        config: generateConfig,
                                    });
                                    for await (const chunk of secondFallbackStream) {
                                        let text = '';
                                        try {
                                            text = chunk.text || '';
                                        } catch (e3) {}
                                        if (!text && chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                                            text = chunk.candidates[0].content.parts[0].text;
                                        }
                                        if (text) {
                                            controller.enqueue(encoder.encode(text));
                                        }
                                    }
                                } catch (e4) {
                                    console.error("Second fallback stream error:", e4);
                                }
                            }
                        }
                    }
                    // Attempt to close gracefully even on error to prevent hanging
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
        let response;
        const modelsToTry = getCandidateModels(resolvedModel);

        let success = false;
        for (let idx = 0; idx < modelsToTry.length; idx++) {
            const currentModel = modelsToTry[idx];
            try {
                response = await ai.models.generateContent({
                    model: currentModel,
                    contents: contents,
                    config: generateConfig,
                });
                resolvedModel = currentModel;
                success = true;
                break;
            } catch (contentError: any) {
                const errorMsg = String(contentError.message || contentError);
                const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("exhausted");
                if (isQuotaOrProError && idx < modelsToTry.length - 1) {
                    console.warn(`Falling back from ${currentModel} to ${modelsToTry[idx + 1]} due to content generation error:`, contentError);
                    continue;
                } else {
                    throw contentError;
                }
            }
        }

        return new Response(JSON.stringify({ text: response.text }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
