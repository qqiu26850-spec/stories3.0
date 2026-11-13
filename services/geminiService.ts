interface GenerationOptions {
    model: string;
    temperature: number;
    topP: number;
    maxOutputTokens?: number;
    signal?: AbortSignal;
}

/**
 * Normalize legacy or deprecated model IDs (e.g., saved 3.5 / 2.5 / 3.8 configs)
 * to currently active backend models so requests never stall or hit simulation fallback.
 */
export function normalizeClientModel(rawModel?: string): string {
    if (!rawModel || typeof rawModel !== 'string') {
        return 'gemini-4-hydrogen';
    }
    const trimmed = rawModel.trim();
    const lower = trimmed.toLowerCase();

    if (
        trimmed === 'gemini-4-hydrogen' ||
        trimmed === 'gemini-4-argon' ||
        trimmed === 'gemini-4-carbon' ||
        trimmed === 'gemini-3.1-flash-lite' ||
        trimmed === 'deepseek-chat' ||
        trimmed === 'deepseek-reasoner' ||
        trimmed === 'doubao-flash'
    ) {
        return trimmed;
    }

    if (
        lower.includes('3.1-flash') ||
        lower.includes('flash') ||
        lower.includes('3.5') ||
        lower.includes('3-5')
    ) {
        return 'gemini-3.1-flash-lite';
    }

    if (lower.startsWith('deepseek')) {
        return lower.includes('reasoner') ? 'deepseek-reasoner' : 'deepseek-chat';
    }

    if (lower.startsWith('doubao')) {
        return 'doubao-flash';
    }

    if (
        lower.startsWith('gemini') ||
        lower.startsWith('claude') ||
        lower.includes('2.5') ||
        lower.includes('3.8') ||
        lower.includes('3.7') ||
        lower.includes('3.6') ||
        lower.includes('2.0') ||
        lower.includes('1.5')
    ) {
        return 'gemini-4-hydrogen';
    }

    return 'gemini-3.1-flash-lite';
}

function createAttemptSignal(userSignal?: AbortSignal, timeoutMs = 75000): {
    signal: AbortSignal;
    cleanup: () => void;
    didTimeout: () => boolean;
} {
    const controller = new AbortController();
    let timedOut = false;

    const onUserAbort = () => {
        controller.abort();
    };

    if (userSignal) {
        if (userSignal.aborted) {
            controller.abort();
        } else {
            userSignal.addEventListener('abort', onUserAbort, { once: true });
        }
    }

    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    const cleanup = () => {
        clearTimeout(timer);
        if (userSignal) {
            userSignal.removeEventListener('abort', onUserAbort);
        }
    };

    return {
        signal: controller.signal,
        cleanup,
        didTimeout: () => timedOut
    };
}

// Helper: Enhanced fetch with bounded timeout & fast retry logic
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries = 1,
    baseDelay = 1200,
    timeoutMs = 75000
): Promise<Response> {
    let lastError: any;
    const userSignal = options.signal ?? undefined;

    for (let i = 0; i <= maxRetries; i++) {
        if (userSignal?.aborted) {
            throw new Error('Aborted');
        }

        const attempt = createAttemptSignal(userSignal, timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: attempt.signal
            });
            attempt.cleanup();

            if (response.ok) {
                return response;
            }

            const errorText = await response.clone().text();
            const lowerErr = errorText.toLowerCase();
            const isDailyQuota =
                lowerErr.includes('perday') ||
                lowerErr.includes('requestsperday') ||
                lowerErr.includes('exceeded your current quota') ||
                lowerErr.includes('resource_exhausted');
            const isRetryableStatus = [500, 502, 503, 504, 429].includes(response.status);
            const isOverloaded =
                !isDailyQuota &&
                (lowerErr.includes('overloaded') ||
                    lowerErr.includes('503') ||
                    lowerErr.includes('504') ||
                    lowerErr.includes('timeout') ||
                    lowerErr.includes('rate limit'));

            if (isRetryableStatus && isOverloaded && i < maxRetries) {
                const delay = baseDelay * Math.pow(2, i);
                console.warn(`API busy (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (err: any) {
            const timedOut = attempt.didTimeout();
            attempt.cleanup();

            if (userSignal?.aborted) {
                throw new Error('Aborted');
            }

            lastError = timedOut
                ? new Error('请求响应超时，请重试或切换其他模型')
                : err;

            if (i < maxRetries) {
                const delay = baseDelay * Math.pow(2, i);
                console.warn(`Network/timeout error (Attempt ${i + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`, lastError);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
        }
    }

    throw lastError || new Error('Failed to fetch after retries');
}

// Helper: Format error messages for users
function formatGeminiError(errorMsg: string): string {
    if (!errorMsg) {
        return '⚠️ 模型未返回有效内容，请重试或切换其他模型。';
    }
    if (errorMsg.includes('超时') || errorMsg.toLowerCase().includes('timeout')) {
        return '⚠️ 模型响应超时，请稍后重试，或在模型菜单中切换其他模型继续创作。';
    }
    if (errorMsg.includes('overloaded') || errorMsg.includes('503')) {
        return '⚠️ 模型当前负载过高 (Server Overloaded)，请稍后再试或切换其他可用模型。';
    }
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return '⚠️ 当前模型接口调用频率或免费额度已达上限 (429 Quota Exceeded)。建议在模型下拉菜单中切换为【Gemini 3.1 Flash Lite】、【奇思版 (DeepSeek)】或【速写版 (豆包)】继续流畅创作！';
    }
    try {
        if (errorMsg.trim().startsWith('{')) {
            const parsed = JSON.parse(errorMsg);
            if (parsed.error && typeof parsed.error === 'string') {
                return formatGeminiError(parsed.error);
            }
            if (parsed.error?.message) {
                return formatGeminiError(parsed.error.message);
            }
        }
    } catch {
        // Ignore JSON parse errors
    }

    return `⚠️ 服务请求失败: ${errorMsg.length > 120 ? errorMsg.substring(0, 120) + '...' : errorMsg}`;
}

function countContentChars(text: string): number {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\s+/g, '').length;
}

/**
 * Detect whether the user is requesting long-form story / imitation generation
 * that exceeds single-pass RLHF output length (~3,000-4,000 Chinese chars on Flash Lite),
 * while strictly excluding short/structured tasks (synopsis, outline, review, polish, JSON, manual continue).
 */
function resolveLongFormTargetChars(prompt: string, maxOutputTokens: number): number | null {
    if (!prompt || maxOutputTokens < 4096) return null;

    // Never recursively wrap manual continuations, internal multi-act prompts, or structured JSON tasks
    if (
        prompt.includes('【任务类型】：内容续写') ||
        prompt.includes('上文输出因长度限制被中断') ||
        prompt.includes('【长篇幅分段直出控制') ||
        prompt.includes('严格返回 JSON') ||
        prompt.includes('JSON格式输出')
    ) {
        return null;
    }

    // Strip standard system footer when inspecting task intent
    const corePrompt = prompt.split('【专业创作指令】')[0] || prompt;

    // 1. Check explicit Chinese character / 万字 target in prompt
    let explicitTarget = 0;

    const wanRangeMatch = corePrompt.match(/([1-3])\s*[-~～至到]\s*([1-5])\s*万字/);
    if (wanRangeMatch) {
        const lowWan = parseFloat(wanRangeMatch[1]);
        explicitTarget = Math.max(explicitTarget, Math.round(lowWan * 10000));
    }

    const wanSingleMatches = corePrompt.matchAll(/(?:不少于|至少|约|目标|字数[：:\s]*|篇幅[：:\s]*|写足|撰写|全文)\s*(\d+(?:\.\d+)?)\s*万字|(\d+(?:\.\d+)?)\s*万字(?:以上|左右|长篇|短篇|小说|仿写|故事|正文)/g);
    for (const match of wanSingleMatches) {
        const num = parseFloat(match[1] || match[2]);
        if (!Number.isNaN(num) && num >= 0.5 && num <= 5) {
            explicitTarget = Math.max(explicitTarget, Math.round(num * 10000));
        }
    }

    const charMatches = corePrompt.matchAll(/(?:不少于|至少|字数要求[：:\s]*|要求字数[：:\s]*|目标字数[：:\s]*|总字数[：:\s]*|字数[：:\s]*|篇幅[：:\s]*)\s*(\d{4,5})\s*字|(\d{4,5})\s*字(?:以上|左右|长篇|短篇小说|仿写|大长篇)/g);
    for (const match of charMatches) {
        const num = parseInt(match[1] || match[2], 10);
        if (!Number.isNaN(num) && num >= 5000 && num <= 40000) {
            explicitTarget = Math.max(explicitTarget, num);
        }
    }

    // Exclude short/analytical tasks unless user explicitly requested >= 5000 chars
    const isShortOrAnalyticalTask =
        /小说简介|短篇导语|核心梗概|分集剧情大纲|人物基础设定|特定词条|文学点评|情节审查|资深编辑对以下文本进行评审|资深编剧评审|对以下文本进行润色|润色以下剧本片段|Prompt Engineer|三幕式结构/.test(corePrompt);

    if (isShortOrAnalyticalTask && explicitTarget < 5000) {
        return null;
    }

    // Scale cap by slider setting so user's Max Tokens slider directly governs target length
    const sliderCap =
        maxOutputTokens >= 28672 ? 15000 :
        maxOutputTokens >= 20480 ? 12000 :
        maxOutputTokens >= 16384 ? 10000 :
        maxOutputTokens >= 12288 ? 7500 :
        maxOutputTokens >= 8192 ? 10000 : 5000;

    if (explicitTarget >= 5000) {
        return Math.min(16000, Math.max(5500, Math.min(explicitTarget, Math.max(sliderCap, explicitTarget <= 12000 ? explicitTarget : sliderCap))));
    }

    // 2. When user pulls Max Tokens slider high (>= 12288) for narrative / imitation / creative story writing
    const isNarrativeOrImitation =
        /仿写|短篇小说|小说正文|故事正文|长篇|扩写|续写|【专业创作指令】/.test(prompt);

    if (maxOutputTokens >= 12288 && isNarrativeOrImitation) {
        if (maxOutputTokens >= 28672) return 12000;
        if (maxOutputTokens >= 20480) return 10000;
        if (maxOutputTokens >= 16384) return 8500;
        return 6500;
    }

    return null;
}

/**
 * Remove accidental boundary duplication if a continuation act repeats the tail of the previous act.
 */
function trimLeadingOverlap(existingText: string, newText: string): string {
    let cleaned = newText.replace(/^\s+/, '');
    if (!existingText || !cleaned) return cleaned;

    const tail = existingText.slice(-120).trim();
    if (!tail) return cleaned;

    const maxCheck = Math.min(tail.length, cleaned.length, 80);
    for (let len = maxCheck; len >= 10; len--) {
        const suffix = tail.slice(-len);
        if (cleaned.startsWith(suffix)) {
            cleaned = cleaned.slice(len).replace(/^\s+/, '');
            break;
        }
    }

    return cleaned;
}

function buildMultiActInitialPrompt(basePrompt: string, targetChars: number, totalActs: number): string {
    return `${basePrompt}

【长篇幅分段直出控制（当前：第 1/${totalActs} 幕）】：
本次完整作品的目标总字数不少于 ${targetChars} 字。为保证细节密度与篇幅充实，当前只需撰写【第 1 幕：开篇立意、核心人物登场与前中期冲突展开】（约 3200-4200 字）。
1. 请通过细腻的场景铺陈、人物动作、对话交锋与心理层次把开篇和中前段剧情写透。
2. **严禁在第 1 幕快进到大结局，严禁提前收尾或概括后续剧情**。
3. 请在剧情推进至中段关键悬念或冲突升级处自然停笔，不要输出“未完待续”“第一幕完”或任何幕后解释语。`;
}

function buildMultiActContinuationPrompt(
    basePrompt: string,
    accumulatedText: string,
    actIndex: number,
    totalActs: number,
    targetChars: number,
    isFinalAct: boolean
): string {
    const currentChars = countContentChars(accumulatedText);
    const remainingChars = Math.max(2200, targetChars - currentChars);
    const tailContext = accumulatedText.slice(-3600);

    const pacingDirective = isFinalAct
        ? `当前正文已写约 ${currentChars} 字，距离目标总篇幅（${targetChars} 字）还需补充约 ${remainingChars} 字。本幕为【最终收官幕（第 ${actIndex}/${totalActs} 幕）】：请紧接上文最后一句话，细腻展开核心高潮爆发、真相揭晓或情感决断，并给出完整、有力、余韵悠长的结局，写足约 ${Math.min(4500, remainingChars + 400)} 字后自然完结全文。`
        : `当前正文已写约 ${currentChars} 字，距离目标总篇幅（${targetChars} 字）还差约 ${remainingChars} 字。本幕为【中段推进幕（第 ${actIndex}/${totalActs} 幕）】：请紧接上文最后一句话，继续深入展开矛盾升级、人物博弈与关键转折，写足 3200-4200 字左右。**严禁在本幕提前写出大结局或草率收尾**，请在推向最终高潮前的转折处自然停笔。`;

    return `${basePrompt}

---
【长篇幅分段直出控制（当前：第 ${actIndex}/${totalActs} 幕）】
${pacingDirective}

【硬性衔接规范】：
1. 直接紧接下方【已生成正文末尾】的最后一个字符无缝往下写，保持人物姓名、人称视角、时代背景、文风节奏 100% 一致。
2. **绝对禁止重复**【已生成正文末尾】最后一句或最后一段的内容。
3. **绝对禁止输出**“好的”“接上文”“继续为您创作”“第二幕”等任何非正文提示语（除非上文原本就有统一的章节序号体系）。

【已生成正文末尾】：
${tailContext}`;
}

async function generateSingleText(prompt: string, options: GenerationOptions): Promise<string> {
    const maxOutputTokens = options.maxOutputTokens || 8192;
    const normalizedModel = normalizeClientModel(options.model);

    if (normalizedModel.startsWith('gemini')) {
        try {
            const response = await fetchWithRetry('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: normalizedModel,
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
            return data.text || '⚠️ 模型未返回有效内容，请重试或切换其他模型。';
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) {
                throw new Error('Aborted');
            }
            console.error('Error generating text with Gemini:', error);
            return formatGeminiError(error.message || String(error));
        }
    } else if (normalizedModel.startsWith('deepseek') || normalizedModel.startsWith('doubao')) {
        const endpoint = normalizedModel.startsWith('doubao') ? '/api/doubao' : '/api/deepseek';
        const effectiveMaxTokens = Math.min(maxOutputTokens, 8192);

        try {
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: normalizedModel,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. If the user asks for a long text, generate as much as possible within the token limit. Use Markdown headers (# ## ###) for structure.'
                        },
                        { role: 'user', content: prompt }
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
            let content = data.choices?.[0]?.message?.content || '';
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            if (!content) {
                throw new Error('Empty response from provider');
            }
            return content;
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) {
                throw new Error('Aborted');
            }
            console.warn(`Error generating text with ${normalizedModel}, falling back to Gemini 3.1 Flash Lite:`, error);
            return generateSingleText(prompt, {
                ...options,
                model: 'gemini-3.1-flash-lite'
            });
        }
    }

    return generateSingleText(prompt, {
        ...options,
        model: 'gemini-3.1-flash-lite'
    });
}

async function* generateSingleTextStream(prompt: string, options: GenerationOptions): AsyncGenerator<string, void, unknown> {
    const maxOutputTokens = options.maxOutputTokens || 8192;
    const normalizedModel = normalizeClientModel(options.model);

    if (normalizedModel.startsWith('gemini')) {
        try {
            const response = await fetchWithRetry('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: normalizedModel,
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

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let yieldedAny = false;

            while (true) {
                if (options.signal?.aborted) {
                    reader.cancel();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;

                const textChunk = decoder.decode(value, { stream: true });
                if (textChunk) {
                    yieldedAny = true;
                    yield textChunk;
                }
            }

            const tail = decoder.decode();
            if (tail) {
                yieldedAny = true;
                yield tail;
            }

            if (!yieldedAny && !options.signal?.aborted) {
                yield '⚠️ 模型未返回有效内容，请重试或切换其他模型。';
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) {
                return;
            }
            console.error('Error generating text stream with Gemini:', error);
            yield formatGeminiError(error.message || String(error));
        }
    } else if (normalizedModel.startsWith('deepseek') || normalizedModel.startsWith('doubao')) {
        const endpoint = normalizedModel.startsWith('doubao') ? '/api/doubao' : '/api/deepseek';
        const effectiveMaxTokens = Math.min(maxOutputTokens, 8192);

        try {
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: normalizedModel,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful creative writing assistant. Write detailed, expansive, and high-quality content. Do not summarize unless asked. If the user asks for a long text, generate as much as possible within the token limit. Use Markdown headers (# ## ###) for structure.'
                        },
                        { role: 'user', content: prompt }
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

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let inThinkingBlock = false;
            let yieldedAny = false;

            while (true) {
                if (options.signal?.aborted) {
                    reader.cancel();
                    break;
                }
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    const jsonStr = trimmed.slice(6);
                    if (jsonStr === '[DONE]') continue;

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
                                    const out = afterThink.split('</think>')[1];
                                    if (out) {
                                        yieldedAny = true;
                                        yield out;
                                    }
                                }
                                continue;
                            }
                            if (content.includes('</think>')) {
                                inThinkingBlock = false;
                                const out = content.split('</think>')[1];
                                if (out) {
                                    yieldedAny = true;
                                    yield out;
                                }
                                continue;
                            }

                            if (!inThinkingBlock) {
                                yieldedAny = true;
                                yield content;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing stream chunk', e);
                    }
                }
            }

            if (!yieldedAny && !options.signal?.aborted) {
                throw new Error('Empty stream from provider');
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Aborted' || options.signal?.aborted) return;
            console.warn(`Error generating text stream with ${normalizedModel}, falling back to Gemini 3.1 Flash Lite:`, error);
            yield* generateSingleTextStream(prompt, {
                ...options,
                model: 'gemini-3.1-flash-lite'
            });
        }
    } else {
        yield* generateSingleTextStream(prompt, {
            ...options,
            model: 'gemini-3.1-flash-lite'
        });
    }
}

export const generateText = async (prompt: string, options: GenerationOptions): Promise<string> => {
    const maxOutputTokens = options.maxOutputTokens || 8192;
    const targetChars = resolveLongFormTargetChars(prompt, maxOutputTokens);

    if (!targetChars) {
        return generateSingleText(prompt, options);
    }

    const totalActs = Math.min(5, Math.max(2, Math.ceil(targetChars / 2600)));
    const actTokens = Math.max(12288, maxOutputTokens);

    let accumulated = await generateSingleText(
        buildMultiActInitialPrompt(prompt, targetChars, totalActs),
        { ...options, maxOutputTokens: actTokens }
    );

    if (
        !accumulated ||
        accumulated.startsWith('⚠️') ||
        accumulated.startsWith('服务请求失败') ||
        countContentChars(accumulated) < 500
    ) {
        return accumulated;
    }

    let act = 2;
    while (
        countContentChars(accumulated) < targetChars * 0.88 &&
        act <= totalActs &&
        !options.signal?.aborted
    ) {
        const remaining = targetChars - countContentChars(accumulated);
        const isFinalAct = act === totalActs || remaining <= 3600;
        const contPrompt = buildMultiActContinuationPrompt(
            prompt,
            accumulated,
            act,
            totalActs,
            targetChars,
            isFinalAct
        );

        const nextPartRaw = await generateSingleText(contPrompt, {
            ...options,
            maxOutputTokens: actTokens
        });

        if (
            !nextPartRaw ||
            nextPartRaw.startsWith('⚠️') ||
            nextPartRaw.startsWith('服务请求失败') ||
            countContentChars(nextPartRaw) < 200
        ) {
            break;
        }

        const deduped = trimLeadingOverlap(accumulated, nextPartRaw);
        if (!deduped) break;

        const separator = accumulated.endsWith('\n') ? '\n' : '\n\n';
        accumulated += separator + deduped;

        if (isFinalAct) break;
        act++;
    }

    return accumulated;
};

export const generateTextStream = async function* (
    prompt: string,
    options: GenerationOptions
): AsyncGenerator<string, void, unknown> {
    const maxOutputTokens = options.maxOutputTokens || 8192;
    const targetChars = resolveLongFormTargetChars(prompt, maxOutputTokens);

    if (!targetChars) {
        yield* generateSingleTextStream(prompt, options);
        return;
    }

    const totalActs = Math.min(5, Math.max(2, Math.ceil(targetChars / 2600)));
    const actTokens = Math.max(12288, maxOutputTokens);
    let accumulated = '';

    // Act 1: Stream immediately for fast TTFB while preventing premature ending
    const firstActPrompt = buildMultiActInitialPrompt(prompt, targetChars, totalActs);
    for await (const chunk of generateSingleTextStream(firstActPrompt, {
        ...options,
        maxOutputTokens: actTokens
    })) {
        accumulated += chunk;
        yield chunk;
    }

    if (
        options.signal?.aborted ||
        !accumulated ||
        accumulated.trimStart().startsWith('⚠️') ||
        accumulated.trimStart().startsWith('服务请求失败') ||
        countContentChars(accumulated) < 500
    ) {
        return;
    }

    // Subsequent acts: seamlessly relay until reaching targetChars
    let act = 2;
    while (
        countContentChars(accumulated) < targetChars * 0.88 &&
        act <= totalActs &&
        !options.signal?.aborted
    ) {
        const remaining = targetChars - countContentChars(accumulated);
        const isFinalAct = act === totalActs || remaining <= 3600;
        const contPrompt = buildMultiActContinuationPrompt(
            prompt,
            accumulated,
            act,
            totalActs,
            targetChars,
            isFinalAct
        );

        let actBuffer = '';
        let headerResolved = false;
        let actYieldedChars = 0;
        let actAbortedWithError = false;

        for await (const chunk of generateSingleTextStream(contPrompt, {
            ...options,
            maxOutputTokens: actTokens
        })) {
            if (options.signal?.aborted) return;

            if (!headerResolved) {
                actBuffer += chunk;
                const trimmedCheck = actBuffer.trimStart();
                if (trimmedCheck.startsWith('⚠️') || trimmedCheck.startsWith('服务请求失败')) {
                    actAbortedWithError = true;
                    break;
                }
                if (actBuffer.length < 90) {
                    continue;
                }
                headerResolved = true;
                const deduped = trimLeadingOverlap(accumulated, actBuffer);
                if (deduped) {
                    const separator = accumulated.endsWith('\n') ? '\n' : '\n\n';
                    const out = separator + deduped;
                    accumulated += out;
                    actYieldedChars += countContentChars(deduped);
                    yield out;
                }
            } else {
                accumulated += chunk;
                actYieldedChars += countContentChars(chunk);
                yield chunk;
            }
        }

        if (actAbortedWithError) {
            break;
        }

        if (!headerResolved && actBuffer) {
            const trimmedCheck = actBuffer.trimStart();
            if (!trimmedCheck.startsWith('⚠️') && !trimmedCheck.startsWith('服务请求失败')) {
                const deduped = trimLeadingOverlap(accumulated, actBuffer);
                if (deduped) {
                    const separator = accumulated.endsWith('\n') ? '\n' : '\n\n';
                    const out = separator + deduped;
                    accumulated += out;
                    actYieldedChars += countContentChars(deduped);
                    yield out;
                }
            }
        }

        if (actYieldedChars < 200 || isFinalAct) {
            break;
        }

        act++;
    }
};
