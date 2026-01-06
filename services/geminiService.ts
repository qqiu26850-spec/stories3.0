
import { GoogleGenAI } from "@google/genai";

interface GenerationOptions {
    model: string;
    temperature: number;
    topP: number;
    maxOutputTokens?: number; // Added parameter
    signal?: AbortSignal;
}

export const generateText = async (prompt: string, options: GenerationOptions): Promise<string> => {
  // Default to a higher token limit if not specified to prevent short responses
  const maxOutputTokens = options.maxOutputTokens || 4096;

  if (options.model.startsWith('gemini')) {
    try {
        const response = await fetch("/api/gemini", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: options.model,
                contents: prompt,
                temperature: options.temperature,
                top_p: options.topP,
                max_tokens: maxOutputTokens,
                stream: false
            }),
            signal: options.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server Error: ${response.status}`);
        }

        const data = await response.json();
        return data.text || "";
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error("Aborted");
        }
        console.error("Error generating text with Gemini:", error);
        return `Gemini 生成内容时出错：${error.message}`;
    }
  } else if (options.model.startsWith('deepseek') || options.model.startsWith('doubao')) {
    const endpoint = options.model.startsWith('doubao') ? "/api/doubao" : "/api/deepseek";
    
    // DeepSeek API limit: max_tokens must be <= 8192
    const effectiveMaxTokens = options.model.startsWith('deepseek') 
        ? Math.min(maxOutputTokens, 8192) 
        : maxOutputTokens;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: options.model,
                messages: [
                    { role: "system", content: "You are a helpful creative writing assistant. Use Markdown headers (# ## ###) for structure when appropriate." },
                    { role: "user", content: prompt }
                ],
                temperature: options.temperature,
                top_p: options.topP,
                max_tokens: effectiveMaxTokens, 
                stream: false
            }),
            signal: options.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server Error: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";
        // Clean deepseek-reasoner thinking tags if any
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        return content;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('已停止生成');
        }
        console.error(`Error generating text with ${options.model}:`, error);
        return `${options.model} 生成出错: ${error.message}`;
    }
  } else {
    // Simulation fallback
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
    const maxOutputTokens = options.maxOutputTokens || 4096;

    if (options.model.startsWith('gemini')) {
        try {
            const response = await fetch("/api/gemini", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: options.model,
                    contents: prompt,
                    temperature: options.temperature,
                    top_p: options.topP,
                    max_tokens: maxOutputTokens,
                    stream: true
                }),
                signal: options.signal
            });

            if (!response.ok) {
                 const errorText = await response.text().catch(() => '');
                 throw new Error(`Server Error: ${response.status} ${errorText}`);
            }
            
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                if (options.signal?.aborted) {
                    reader.cancel();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;
                
                // The API sends raw text chunks in the stream
                const textChunk = decoder.decode(value, { stream: true });
                yield textChunk;
            }

        } catch (error: any) {
            if (error.name === 'AbortError' || options.signal?.aborted) {
                return; 
            }
            console.error("Error generating text stream with Gemini:", error);
            yield `Gemini 生成内容时出错：${error.message}`;
        }
    } else if (options.model.startsWith('deepseek') || options.model.startsWith('doubao')) {
        const endpoint = options.model.startsWith('doubao') ? "/api/doubao" : "/api/deepseek";
        
        // DeepSeek API limit: max_tokens must be <= 8192
        const effectiveMaxTokens = options.model.startsWith('deepseek') 
            ? Math.min(maxOutputTokens, 8192) 
            : maxOutputTokens;

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: options.model,
                    messages: [
                        { role: "system", content: "You are a helpful creative writing assistant. Use Markdown headers (# ## ###) for structure." },
                        { role: "user", content: prompt }
                    ],
                    temperature: options.temperature,
                    top_p: options.topP,
                    max_tokens: effectiveMaxTokens,
                    stream: true
                }),
                signal: options.signal
            });

            if (!response.ok) {
                 const errorText = await response.text().catch(() => '');
                 throw new Error(`Server Error: ${response.status} ${errorText}`);
            }
            
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let inThinkingBlock = false;

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
                        const delta = json.choices?.[0]?.delta;
                        if (!delta) continue;

                        const content = delta.content;
                        if (content) {
                            if (content.includes('<think>')) {
                                inThinkingBlock = true;
                                const afterThink = content.split('<think>')[1];
                                if (afterThink && afterThink.includes('</think>')) {
                                    inThinkingBlock = false;
                                    yield afterThink.split('</think>')[1];
                                }
                                continue;
                            }
                            if (content.includes('</think>')) {
                                inThinkingBlock = false;
                                yield content.split('</think>')[1];
                                continue;
                            }
                            
                            if (!inThinkingBlock) {
                                yield content;
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing stream chunk", e);
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || options.signal?.aborted) return;
            console.error(`Error generating text stream with ${options.model}:`, error);
            yield `${options.model} 连接出错：${error.message}`;
        }
    } else {
        const simulatedResponse = `[来自 ${options.model.toUpperCase()} 的模拟流式响应]\n\n${prompt.substring(0, 50)}...`;
        const chunks = simulatedResponse.split('');
        for (const char of chunks) {
            if (options.signal?.aborted) break;
            await new Promise(resolve => setTimeout(resolve, 30));
            yield char;
        }
    }
};
