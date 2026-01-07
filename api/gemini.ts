
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

    const ai = new GoogleGenAI({ apiKey });

    const generateConfig = {
        temperature: temperature,
        topP: top_p,
        maxOutputTokens: max_tokens,
    };

    if (stream) {
        const responseStream = await ai.models.generateContentStream({
            model: model,
            contents: contents,
            config: generateConfig,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of responseStream) {
                        // Robust text extraction: try getter first, then fallback to candidate parts
                        let text = chunk.text;
                        if (!text && chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                            text = chunk.candidates[0].content.parts[0].text;
                        }
                        
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (e) {
                    console.error("Gemini Stream Error", e);
                    // Don't error the controller if we already sent data, just close
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
        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: generateConfig,
        });

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
