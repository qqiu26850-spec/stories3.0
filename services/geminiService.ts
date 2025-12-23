
import { GoogleGenAI } from "@google/genai";

interface GenerationOptions {
    model: string;
    temperature: number;
    topP: number;
    maxOutputTokens?: number; // Added parameter
    signal?: AbortSignal;
}

// Removed PLAIN_TEXT_INSTRUCTION to allow Markdown headers (#) for hierarchical numbering in UI

export const generateText = async (prompt: string, options: GenerationOptions): Promise<string> => {
  // Default to a higher token limit if not specified to prevent short responses
  const maxOutputTokens = options.maxOutputTokens || 8192;

  if (options.model.startsWith('gemini')) {
    // Fix: Always use named parameter for apiKey and obtain it exclusively from process.env.API_KEY.
    // Create the instance inside the function to ensure it uses the most up-to-date environment variable.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        if (options.signal?.aborted) throw new Error("Aborted");
        
        const response = await ai.models.generateContent({
            model: options.model,
            contents: prompt,
            config: {
                temperature: options.temperature,
                topP: options.topP,
                maxOutputTokens: maxOutputTokens,
            }
        });
        // Fix: Use the .text property directly as per latest SDK guidelines
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
        const response = await fetch("/api/deepseek", {
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
                max_tokens: maxOutputTokens, // Pass max_tokens to DeepSeek
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
        console.error("Error generating text with DeepSeek:", error);
        return `DeepSeek 生成出错: ${error.message}`;
    }
  } else {
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
    // Default to a higher token limit if not specified
    const maxOutputTokens = options.maxOutputTokens || 8192;

    if (options.model.startsWith('gemini')) {
        // Fix: Use process.env.API_KEY and create instance locally to follow GenAI guidelines.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        try {
            const responseStream = await ai.models.generateContentStream({
                model: options.model,
                contents: prompt,
                config: {
                    temperature: options.temperature,
                    topP: options.topP,
                    maxOutputTokens: maxOutputTokens,
                }
            });

            for await (const chunk of responseStream) {
                if (options.signal?.aborted) throw new Error("Aborted");
                // Fix: Access .text property directly instead of calling .text()
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
            const response = await fetch("/api/deepseek", {
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
                    max_tokens: maxOutputTokens, // Pass max_tokens to DeepSeek
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
                            // Filter logic for <think> blocks in R1
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
            console.error("Error generating text stream with DeepSeek:", error);
            yield `DeepSeek 连接出错：${error.message}`;
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
