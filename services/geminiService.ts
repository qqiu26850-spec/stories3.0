
import { GoogleGenAI } from "@google/genai";

// Google Gemini API Key
const GOOGLE_API_KEY = "AIzaSyB5gQjtLL4iIspEMzXwaYXNN3BMEZ4Zd1M";
// DeepSeek API Key
const DEEPSEEK_API_KEY = "sk-948c512b86c94ce8924462265c229017";

const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

interface GenerationOptions {
    model: string;
    temperature: number;
    topP: number;
    signal?: AbortSignal;
}

const PLAIN_TEXT_INSTRUCTION = "\n\n(IMPORTANT: Please output the result in strictly plain text format. Do NOT use Markdown syntax such as **bold**, *italics*, # headers, or bullet points. Use standard spacing for paragraphs.)";

export const generateText = async (prompt: string, options: GenerationOptions): Promise<string> => {
  const finalPrompt = prompt + PLAIN_TEXT_INSTRUCTION;

  if (options.model.startsWith('gemini')) {
    try {
        if (options.signal?.aborted) throw new Error("Aborted");
        
        const response = await ai.models.generateContent({
            model: options.model,
            contents: finalPrompt,
            config: {
                temperature: options.temperature,
                topP: options.topP,
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Error generating text with Gemini:", error);
        if (error instanceof Error) {
            return `Gemini 生成内容时出错：${error.message}`;
        }
        return "Gemini 生成内容时发生未知错误。";
    }
  } else if (options.model.startsWith('deepseek')) {
    try {
        // DeepSeek API Endpoint
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
                "Accept": "application/json"
            },
            mode: 'cors', // Ensure CORS is handled if supported by server
            body: JSON.stringify({
                model: options.model, // e.g., 'deepseek-chat' or 'deepseek-reasoner'
                messages: [
                    { role: "user", content: finalPrompt }
                ],
                temperature: options.temperature,
                top_p: options.topP,
                stream: false
            }),
            signal: options.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `DeepSeek API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('已停止生成');
        }
        console.error("Error generating text with DeepSeek:", error);
        if (error instanceof Error) {
            // Check for common fetch errors related to network or CORS
            if (error.message === 'Failed to fetch') {
                return "DeepSeek 连接失败。这通常是因为浏览器跨域限制(CORS)或网络问题。建议切换至 Gemini 模型使用，或检查网络连接。";
            }
            return `DeepSeek 生成内容时出错：${error.message}`;
        }
        return "DeepSeek 生成内容时发生未知错误。";
    }
  } else {
    // Simulate
    if (options.signal?.aborted) throw new Error("Aborted");
    await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 1500);
        options.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error("Aborted"));
        });
    });
    return `[来自 ${options.model.toUpperCase()} 的模拟响应]\n\n${prompt.substring(0, 150)}...`;
  }
};

export const generateTextStream = async function* (prompt: string, options: GenerationOptions): AsyncGenerator<string, void, unknown> {
    const finalPrompt = prompt + PLAIN_TEXT_INSTRUCTION;

    if (options.model.startsWith('gemini')) {
        try {
            const responseStream = await ai.models.generateContentStream({
                model: options.model,
                contents: finalPrompt,
                config: {
                    temperature: options.temperature,
                    topP: options.topP,
                }
            });

            for await (const chunk of responseStream) {
                if (options.signal?.aborted) throw new Error("Aborted");
                const text = chunk.text;
                if (text) {
                    yield text;
                }
            }
        } catch (error: any) {
            if (error.message === 'Aborted' || options.signal?.aborted) {
                return; 
            }
            console.error("Error generating text stream with Gemini:", error);
            yield `Gemini 生成内容时出错：${error.message}`;
        }
    } else if (options.model.startsWith('deepseek')) {
        try {
            const response = await fetch("https://api.deepseek.com/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
                    "Accept": "application/json"
                },
                mode: 'cors',
                body: JSON.stringify({
                    model: options.model,
                    messages: [
                        { role: "user", content: finalPrompt }
                    ],
                    temperature: options.temperature,
                    top_p: options.topP,
                    stream: true
                }),
                signal: options.signal
            });

            if (!response.ok) {
                 const errorText = await response.text().catch(() => '');
                 throw new Error(`DeepSeek API Error: ${response.status} ${errorText}`);
            }
            
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                if (options.signal?.aborted) {
                    reader.cancel();
                    break;
                }
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
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) yield content;
                    } catch (e) {
                        console.error("Error parsing DeepSeek stream chunk", e);
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || options.signal?.aborted) return;
            console.error("Error generating text stream with DeepSeek:", error);
            if (error.message === 'Failed to fetch') {
                yield "DeepSeek 连接失败 (CORS/Network)。请尝试切换模型。";
            } else {
                yield `DeepSeek 生成内容时出错：${error.message}`;
            }
        }
    } else {
        // Simulate
        const simulatedResponse = `[来自 ${options.model.toUpperCase()} 的模拟流式响应]\n\n${prompt.substring(0, 50)}...`;
        const chunks = simulatedResponse.split('');
        for (const char of chunks) {
            if (options.signal?.aborted) break;
            await new Promise(resolve => setTimeout(resolve, 30));
            yield char;
        }
    }
};
