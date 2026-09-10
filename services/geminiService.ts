
import { GoogleGenAI } from "@google/genai";

interface GenerationOptions {
    model: string;
    temperature: number;
    topP: number;
    maxOutputTokens?: number; // Added parameter
    signal?: AbortSignal;
}

// Helper: Enhanced fetch with retry logic
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelay = 2000): Promise<Response> {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
        try {
            if (options.signal?.aborted) {
                throw new Error("Aborted");
            }

            const response = await fetch(url, options);

            // If successful, return immediately
            if (response.ok) {
                return response;
            }

            // Clone response to read text for error analysis
            const errorText = await response.clone().text();
            
            // Check for retryable conditions:
            // 503: Service Unavailable (Overloaded)
            // 429: Too Many Requests (Rate Limit)
            // 500: Internal Server Error (Often wraps upstream 503s)
            const isRetryableStatus = [500, 503, 429].includes(response.status);
            const isOverloaded = errorText.includes('overloaded') || errorText.includes('503') || errorText.includes('quota') || errorText.includes('rate limit');

            if (isRetryableStatus && isOverloaded && i < maxRetries) {
                const delay = baseDelay * Math.pow(2, i); // Exponential backoff: 2s, 4s, 8s
                console.warn(`Gemini API overloaded/busy (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // If not retryable or retries exhausted, return the error response to be handled by caller
            return response;

        } catch (err: any) {
            if (err.message === "Aborted") throw err;
            
            lastError = err;
            // Retry on network errors (fetch throws on network failure)
            if (i < maxRetries) {
                const delay = baseDelay * Math.pow(2, i);
                console.warn(`Network error (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, err);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }
    
    throw lastError || new Error("Failed to fetch after retries");
}

// Helper: Format error messages for users
function formatGeminiError(errorMsg: string): string {
    if (errorMsg.includes('overloaded') || errorMsg.includes('503')) {
        return "⚠️ 模型当前负载过高 (Google Server Overloaded)，请稍后再试或尝试切换至【奇思版 (DeepSeek)】。";
    }
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return "⚠️ 谷歌接口调用额度已超限 (Gemini Quota Exceeded)。建议您在左侧/上方模型下拉菜单中切换为【奇思版 (DeepSeek V3)】或【速写版 (豆包)】继续流畅创作！";
    }
    // Attempt to clean up nested JSON error messages
    try {
        // Matches typical nested structure: {"error": "..."}
        if (errorMsg.trim().startsWith('{')) {
            const parsed = JSON.parse(errorMsg);
            if (parsed.error && typeof parsed.error === 'string') {
                return formatGeminiError(parsed.error); // Recursive check
            }
            if (parsed.error?.message) {
                return formatGeminiError(parsed.error.message);
            }
        }
    } catch (e) {
        // Ignore parse errors
    }
    
    // Fallback: Truncate very long error messages
    return `服务请求失败: ${errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg}`;
}

export const generateText = async (prompt: string, options: GenerationOptions): Promise<string> => {
  // Default to a higher token limit if not specified to prevent short responses
  // Increased default to 8192 for Gemini/DeepSeek V3 support
  const maxOutputTokens = options.maxOutputTokens || 8192;

  if (options.model.startsWith('gemini')) {
    try {
        const response = await fetchWithRetry("/api/gemini", {
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
            const errorData = await response.text();
            throw new Error(errorData);
        }

        const data = await response.json();
        return data.text || "";
    } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'Aborted') {
            throw new Error("Aborted");
        }
        console.error("Error generating text with Gemini:", error);
        return formatGeminiError(error.message || String(error));
    }
  } else if (options.model.startsWith('deepseek') || options.model.startsWith('doubao')) {
    const endpoint = options.model.startsWith('doubao') ? "/api/doubao" : "/api/deepseek";
    
    // DeepSeek API limit: max_tokens must be <= 8192. 
    // Ensure we don't send more than 8192 even if requested (e.g. if user forces via slider in future updates)
    const effectiveMaxTokens = Math.min(maxOutputTokens, 8192);

    try {
        const response = await fetchWithRetry(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: options.model,
                messages: [
                    { role: "system", content: "You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. If the user asks for a long text, generate as much as possible within the token limit. Use Markdown headers (# ## ###) for structure." },
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
        if (error.name === 'AbortError' || error.message === 'Aborted') {
            throw new Error('已停止生成');
        }
        console.warn(`Error generating text with ${options.model}, falling back to Gemini:`, error);
        return generateText(prompt, {
            ...options,
            model: 'gemini-3.8-flash'
        });
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
    // Increased default to 8192
    const maxOutputTokens = options.maxOutputTokens || 8192;

    if (options.model.startsWith('gemini')) {
        try {
            const response = await fetchWithRetry("/api/gemini", {
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
                 throw new Error(errorText || `Server Error: ${response.status}`);
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
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) {
                return; 
            }
            console.error("Error generating text stream with Gemini:", error);
            // Use the formatter to yield a user-friendly error message directly to the stream UI
            yield formatGeminiError(error.message || String(error));
        }
    } else if (options.model.startsWith('deepseek') || options.model.startsWith('doubao')) {
        const endpoint = options.model.startsWith('doubao') ? "/api/doubao" : "/api/deepseek";
        
        // DeepSeek API limit: max_tokens must be <= 8192
        const effectiveMaxTokens = Math.min(maxOutputTokens, 8192);

        try {
            const response = await fetchWithRetry(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: options.model,
                    messages: [
                        { role: "system", content: "You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. If the user asks for a long text, generate as much as possible within the token limit. Use Markdown headers (# ## ###) for structure." },
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
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) return;
            console.warn(`Error generating text stream with ${options.model}, falling back to Gemini:`, error);
            yield* generateTextStream(prompt, {
                ...options,
                model: 'gemini-3.8-flash'
            });
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
