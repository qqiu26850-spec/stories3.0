
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
    
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google API Key not configured on server' }), { status: 500 });
    }

    // Map models gracefully to prevent 404/Quota issues
    let resolvedModel = model;
    if (typeof model === 'string') {
      const m = model.toLowerCase();
      if (m === "gemini-3-flash-preview" || m === "gemini-3.5-flash-preview") {
        resolvedModel = "gemini-3.5-flash";
      } else if (m === "gemini-3-pro-preview") {
        resolvedModel = "gemini-3.1-pro-preview";
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    const generateConfig = {
        temperature: temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
    };

    if (stream) {
        let responseStream;
        try {
            responseStream = await ai.models.generateContentStream({
                model: resolvedModel,
                contents: contents,
                config: generateConfig,
            });
        } catch (streamError: any) {
            const errorMsg = String(streamError.message || streamError);
            const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404");
            if (resolvedModel !== "gemini-3.5-flash" && isQuotaOrProError) {
                console.warn(`Falling back from ${resolvedModel} to gemini-3.5-flash due to stream initialization error:`, streamError);
                resolvedModel = "gemini-3.5-flash";
                responseStream = await ai.models.generateContentStream({
                    model: resolvedModel,
                    contents: contents,
                    config: generateConfig,
                });
            } else {
                throw streamError;
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
                    const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404");
                    if (resolvedModel !== "gemini-3.5-flash" && isQuotaOrProError) {
                        console.warn(`Falling back from ${resolvedModel} to gemini-3.5-flash due to stream iteration error:`, e);
                        try {
                            const fallbackStream = await ai.models.generateContentStream({
                                model: "gemini-3.5-flash",
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
                        } catch (fallbackError) {
                            console.error("Fallback stream error:", fallbackError);
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
        try {
            response = await ai.models.generateContent({
                model: resolvedModel,
                contents: contents,
                config: generateConfig,
            });
        } catch (contentError: any) {
            const errorMsg = String(contentError.message || contentError);
            const isQuotaOrProError = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit: 0") || errorMsg.includes("pro") || errorMsg.includes("404");
            if (resolvedModel !== "gemini-3.5-flash" && isQuotaOrProError) {
                console.warn(`Falling back from ${resolvedModel} to gemini-3.5-flash due to content generation error:`, contentError);
                resolvedModel = "gemini-3.5-flash";
                response = await ai.models.generateContent({
                    model: resolvedModel,
                    contents: contents,
                    config: generateConfig,
                });
            } else {
                throw contentError;
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
