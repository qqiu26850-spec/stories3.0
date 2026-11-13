import { pinyin } from 'pinyin-pro';

export interface ReviewedCharacterEntity {
    id: string;
    canonical: string;
    mentions: string[];
    role?: string;
    evidence: string[];
    count: number;
    confidence: 'confirmed' | 'uncertain';
    reason?: string;
    firstIndex: number;
}

export interface CharacterConflictItem {
    id: string;
    originalName: string;
    imitationName: string;
    originalEntityDisplay: string;
    imitationEntityDisplay: string;
    originalEvidence?: string;
    imitationEvidence?: string;
    originalIndex: number;
    imitationIndex: number;
    conflictType: 'exact' | 'title' | 'homophone' | 'near_homophone' | 'swapped';
    isExactMatch: boolean;
    originalPinyin: string;
    imitationPinyin: string;
    count: number;
    recommendedNames: string[];
    resolved?: boolean;
}

export interface TypoAuditItem {
    id: string;
    index: number;
    wrongText: string;
    correctText: string;
    sentence: string;
    explanation: string;
    locationLabel: string;
    category:
        | 'typo'
        | 'homophone'
        | 'extra_char'
        | 'missing_char'
        | 'collocation'
        | 'consistency'
        | 'grammar';
}

export interface DialogueSimilarityItem {
    id: string;
    kind: 'dialogue_15' | 'plot_structure' | 'long_sentence';
    severity: 'danger' | 'warning';
    originalSnippet: string;
    imitationSnippet: string;
    originalIndex: number;
    imitationIndex: number;
    length: number;
    reason: string;
    suggestedRewrite?: string;
}

export interface ManualReviewItem {
    id: string;
    issueType: 'character' | 'conflict' | 'consistency' | 'typo' | 'similarity';
    aiJudgment: string;
    originalTextSnippet: string;
    imitationTextSnippet: string;
    originalIndex?: number;
    imitationIndex?: number;
    locationLabel: string;
    reason: string;
    suggestedFix: string;
    wrongText?: string;
    correctText?: string;
    candidateName?: string;
    candidateMentions?: string[];
    candidateRole?: string;
    candidateTarget?: 'original' | 'imitation';
    status: 'pending' | 'confirmed' | 'ignored' | 'modified';
}

export interface SentenceSimilarity {
    imitationIndex: number;
    startIndex: number;
    endIndex: number;
    sentence: string;
    similarity: number;
    matchedOriginalSentence?: string;
    matchedOriginalIndex?: number;
    matchedOriginalSimilarity?: number;
    isLongDialogueOverlap?: boolean;
    colorLevel: 'danger' | 'warning' | 'caution' | 'safe';
}

export interface FailedAuditTask {
    id: string;
    kind: 'original_chunk' | 'imitation_chunk' | 'cross_similarity';
    chunkIndex?: number;
    totalChunks?: number;
    label: string;
    errorMessage: string;
}

export interface CoverageStatus {
    originalTotalChunks: number;
    originalSucceededChunks: number;
    imitationTotalChunks: number;
    imitationSucceededChunks: number;
    characterCheckComplete: boolean;
    typoCheckComplete: boolean;
    similarityChecked: boolean;
    isComplete: boolean;
    failedTasks: string[];
    failedTaskDetails: FailedAuditTask[];
    warningMessage?: string;
}

export interface AuditCacheState {
    originalText: string;
    imitationText: string;
    modelUsed: string;
    originalEntities: ReviewedCharacterEntity[];
    originalChunkCharacters?: Map<number, any[]>;
    imitationChunkResults?: Map<number, { characters: any[]; issues: any[] }>;
    imitationParagraphResults: Map<string, {
        entities: ReviewedCharacterEntity[];
        typos: TypoAuditItem[];
        manualItems: ManualReviewItem[];
    }>;
}

export interface ComprehensiveAuditReport {
    timestamp: number;
    durationMs: number;
    modelRequested: string;
    modelUsed: string;
    isIncremental: boolean;
    recheckedParagraphCount?: number;
    overallSimilarity: number;
    originalWordCount: number;
    imitationWordCount: number;
    originalEntities: ReviewedCharacterEntity[];
    imitationEntities: ReviewedCharacterEntity[];
    characterConflicts: CharacterConflictItem[];
    typoIssues: TypoAuditItem[];
    similarityAlerts: DialogueSimilarityItem[];
    manualReviewItems: ManualReviewItem[];
    sentenceSimilarities: SentenceSimilarity[];
    colorStats: {
        dangerCount: number;
        warningCount: number;
        cautionCount: number;
        safeCount: number;
    };
    coverage: CoverageStatus;
    verdict: 'danger' | 'warning' | 'pass';
    verdictMessage: string;
}

const NAME_RECOMMENDATIONS = [
    '沈砚', '周妄', '陆司沉', '霍廷', '季凛', '江逾白', '谢辞', '裴珩',
    '许星辞', '盛淮', '温以宁', '宋知意', '南乔', '林桑', '姜栀', '虞晚'
];

// 明确无意义的通用身份泛称/代词（仅用于剔除模型万一吐出的纯通用指代词，不做正则人物抽取）
const STRICT_GENERIC_PRONOUNS_AND_TITLES = new Set([
    '我', '你', '他', '她', '它', '我们', '你们', '他们', '她们', '自己', '大家', '众人', '各位', '诸位', '某人', '那人', '此人', '旁人',
    '陛下', '皇上', '圣上', '太后', '皇后', '贵妃', '皇贵妃', '娘娘', '主子', '殿下', '太子', '王爷', '王妃', '公主', '郡主',
    '太医', '御医', '大夫', '公公', '太监', '嬷嬷', '姑姑', '宫女', '丫鬟', '侍女', '婢女', '侍卫', '统领', '将军', '管家', '大人', '老爷', '夫人', '小姐', '姑娘', '公子',
    '父亲', '母亲', '爹爹', '娘亲', '哥哥', '姐姐', '弟弟', '妹妹', '兄长', '夫君', '相公', '娘子', '儿子', '女儿',
    '奴婢', '奴才', '臣妾', '嫔妾', '本宫', '哀家', '寡人', '朕', '微臣', '在下'
]);

const hashString = (str: string): string => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
};

export const countExactOccurrences = (text: string, sub: string): number => {
    if (!text || !sub) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
        const idx = text.indexOf(sub, pos);
        if (idx === -1) break;
        count++;
        pos = idx + sub.length;
    }
    return count;
};

export const getLocationInfo = (text: string, index: number): { paragraphNumber: number; label: string } => {
    if (index < 0 || !text) {
        return { paragraphNumber: 1, label: '全文匹配' };
    }
    const prefix = text.slice(0, index);
    const paraNum = (prefix.match(/\n+/g) || []).length + 1;
    return {
        paragraphNumber: paraNum,
        label: `第 ${paraNum} 段 · 第 ${index + 1} 字`
    };
};

export const extractSnippetNear = (text: string, term: string, indexHint = -1): string => {
    const idx = indexHint >= 0 ? indexHint : text.indexOf(term);
    if (idx === -1) return '';
    let start = idx;
    while (start > 0 && !/[。！？!?；;\n]/.test(text[start - 1]) && idx - start < 24) {
        start--;
    }
    let end = idx + term.length;
    while (end < text.length && !/[。！？!?；;\n]/.test(text[end]) && end - (idx + term.length) < 28) {
        end++;
    }
    const prefix = start > 0 && !/[。！？!?；;\n]/.test(text[start - 1]) ? '…' : '';
    const suffix = end < text.length && !/[。！？!?；;\n]/.test(text[end]) ? '…' : '';
    return `${prefix}${text.slice(start, end).trim()}${suffix}`;
};

export const locateVerbatimSpan = (
    text: string,
    target: string,
    sentenceAnchor?: string,
    searchStart = 0
): number => {
    if (!text || !target) return -1;
    const cleanTarget = target.trim();
    if (!cleanTarget) return -1;

    if (sentenceAnchor && sentenceAnchor.trim()) {
        const anchor = sentenceAnchor.trim().replace(/^…|…$/g, '');
        const anchorIdx = text.indexOf(anchor, Math.max(0, searchStart));
        if (anchorIdx !== -1) {
            const relIdx = anchor.indexOf(cleanTarget);
            if (relIdx !== -1) {
                return anchorIdx + relIdx;
            }
        }
        const globalAnchorIdx = text.indexOf(anchor);
        if (globalAnchorIdx !== -1) {
            const relIdx = anchor.indexOf(cleanTarget);
            if (relIdx !== -1) {
                return globalAnchorIdx + relIdx;
            }
        }
    }

    const fromHint = text.indexOf(cleanTarget, Math.max(0, searchStart));
    if (fromHint !== -1) return fromHint;
    return text.indexOf(cleanTarget);
};

export interface ReviewModelCallOptions {
    jsonMode?: boolean;
    timeoutMs?: number;
    thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
    maxTokens?: number;
}

// --- 真实大模型通道直连（严禁失败时假冒 AI 结果或静默切换模型） ---
export async function callReviewModel(
    prompt: string,
    model: string,
    signal?: AbortSignal,
    options?: ReviewModelCallOptions
): Promise<{ text: string; actualModel: string }> {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 45000;
    const jsonMode = options?.jsonMode ?? true;
    const maxTokens = options?.maxTokens ?? 8192;
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) {
            clearTimeout(timeoutTimer);
            throw new Error('审稿任务已被用户取消');
        }
        signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
        if (model.startsWith('deepseek') || model.startsWith('doubao')) {
            const endpoint = model.startsWith('doubao') ? '/api/doubao' : '/api/deepseek';
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: 'system',
                            content: '你是一名严谨、高精度的小说审稿与文字校对专家。必须严格依据给定原文做语义分析，绝不编造不存在的字句，严格按要求的 JSON 格式输出。'
                        },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    top_p: 0.9,
                    max_tokens: maxTokens,
                    stream: false
                }),
                signal: controller.signal
            });

            if (!resp.ok) {
                const errRaw = await resp.text().catch(() => '');
                let errMsg = `HTTP ${resp.status}`;
                try {
                    const parsed = JSON.parse(errRaw);
                    if (parsed?.error) errMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                } catch {
                    if (errRaw) errMsg = errRaw.slice(0, 220);
                }
                const label = model.startsWith('doubao') ? '豆包 (Doubao)' : 'DeepSeek V3';
                throw new Error(`${label} 接口调用失败：${errMsg}`);
            }

            const data = await resp.json();
            let content = data?.choices?.[0]?.message?.content || '';
            content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            if (!content) {
                throw new Error(`${model} 返回内容为空`);
            }
            return { text: content, actualModel: model };
        }

        // Gemini 通道：严格使用用户所选模型，通过 thinkingLevel 控制思维链深度（严禁对 Gemini 4 传 thinkingBudget）
        const resp = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                contents: prompt,
                max_tokens: maxTokens,
                stream: false,
                responseMimeType: jsonMode ? 'application/json' : undefined,
                thinkingLevel: options?.thinkingLevel ?? (jsonMode ? 'LOW' : undefined)
            }),
            signal: controller.signal
        });

        if (!resp.ok) {
            const errRaw = await resp.text().catch(() => '');
            let errMsg = `HTTP ${resp.status}`;
            try {
                const parsed = JSON.parse(errRaw);
                if (parsed?.error) errMsg = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
            } catch {
                if (errRaw) errMsg = errRaw.slice(0, 220);
            }
            throw new Error(`Gemini (${model}) 接口调用失败：${errMsg}`);
        }

        const data = await resp.json();
        const usedModel = typeof data?.modelUsed === 'string' && data.modelUsed.trim() ? data.modelUsed.trim() : model;
        if (usedModel.toLowerCase() !== model.toLowerCase()) {
            throw new Error(`模型路由不一致：请求 ${model}，实际响应 ${usedModel}`);
        }

        const text = (typeof data?.text === 'string' ? data.text : '').trim();
        if (!text) {
            const reasonHint = data?.finishReason ? `（结束原因: ${data.finishReason}）` : '';
            throw new Error(`Gemini (${usedModel}) 返回内容为空${reasonHint}`);
        }
        return { text, actualModel: usedModel };
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            if (signal?.aborted) throw new Error('审稿任务已被用户取消');
            throw new Error(`模型 ${model} 响应超时（超过 ${Math.round(timeoutMs / 1000)} 秒）`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutTimer);
        signal?.removeEventListener('abort', onExternalAbort);
    }
}

const escapeControlCharsInsideStrings = (jsonText: string): string => {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < jsonText.length; i++) {
        const ch = jsonText[i];
        if (escaped) {
            out += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            out += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            out += ch;
            continue;
        }
        if (inString) {
            if (ch === '\n') {
                out += '\\n';
                continue;
            }
            if (ch === '\r') {
                out += '\\r';
                continue;
            }
            if (ch === '\t') {
                out += '\\t';
                continue;
            }
        }
        out += ch;
    }
    return out;
};

const tryParseCandidateJson = (candidate: string): any => {
    const attempts = [
        candidate,
        candidate.replace(/,\s*([}\]])/g, '$1'),
        escapeControlCharsInsideStrings(candidate).replace(/,\s*([}\]])/g, '$1')
    ];
    for (const attempt of attempts) {
        try {
            return JSON.parse(attempt);
        } catch {
            // continue
        }
    }
    return null;
};

const recoverTruncatedJsonArrayObjects = (rawSlice: string, expectedArrayKey: string): any => {
    // 提取已被截断 JSON 中最后一个完整闭合的数组对象元素（仅保留完整项，不伪造）
    const sanitized = escapeControlCharsInsideStrings(rawSlice);
    const keyMatch = new RegExp(`"${expectedArrayKey}"\\s*:\\s*\\[`).exec(sanitized);
    const arrStart = keyMatch ? keyMatch.index + keyMatch[0].length - 1 : sanitized.indexOf('[');
    if (arrStart === -1) return null;

    let inString = false;
    let escaped = false;
    let braceDepth = 0;
    const itemCloseIndices: number[] = [];

    for (let i = arrStart + 1; i < sanitized.length; i++) {
        const ch = sanitized[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === '{') {
            braceDepth++;
        } else if (ch === '}') {
            if (braceDepth > 0) braceDepth--;
            if (braceDepth === 0) {
                itemCloseIndices.push(i);
            }
        } else if (ch === ']' && braceDepth === 0) {
            break;
        }
    }

    for (let k = itemCloseIndices.length - 1; k >= 0; k--) {
        const itemsText = sanitized.slice(arrStart + 1, itemCloseIndices[k] + 1).replace(/,\s*$/, '');
        const candidateArr = `[${itemsText}]`;
        const parsedArr = tryParseCandidateJson(candidateArr);
        if (Array.isArray(parsedArr)) {
            return { [expectedArrayKey]: parsedArr };
        }
    }
    return null;
};

const parseJsonObjectSafe = (raw: string, expectedArrayKey: 'characters' | 'issues' | 'findings' = 'characters'): any => {
    if (!raw || typeof raw !== 'string') return null;
    const cleaned = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    if (!cleaned) return null;

    // 1. 直接解析整段（兼容外层为对象或纯数组的情况）
    const direct = tryParseCandidateJson(cleaned);
    if (direct) {
        if (Array.isArray(direct)) {
            return { [expectedArrayKey]: direct };
        }
        if (typeof direct === 'object') {
            return direct;
        }
    }

    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');

    // 2. 若纯数组先于对象出现（模型省掉了外层包装对象），优先按数组提取
    if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
        const arrEnd = cleaned.lastIndexOf(']');
        if (arrEnd > arrStart) {
            const arrParsed = tryParseCandidateJson(cleaned.slice(arrStart, arrEnd + 1));
            if (Array.isArray(arrParsed)) {
                return { [expectedArrayKey]: arrParsed };
            }
        }
    }

    // 3. 标准对象区间解析
    if (objStart !== -1) {
        const objEnd = cleaned.lastIndexOf('}');
        if (objEnd > objStart) {
            const parsedObj = tryParseCandidateJson(cleaned.slice(objStart, objEnd + 1));
            if (parsedObj && typeof parsedObj === 'object') {
                return Array.isArray(parsedObj) ? { [expectedArrayKey]: parsedObj } : parsedObj;
            }
        }
        // 4. 输出截断恢复（保留完整已闭合对象前缀）
        const recovered = recoverTruncatedJsonArrayObjects(cleaned.slice(objStart), expectedArrayKey);
        if (recovered) return recovered;
    }

    if (arrStart !== -1) {
        const recoveredArr = recoverTruncatedJsonArrayObjects(cleaned.slice(arrStart), expectedArrayKey);
        if (recoveredArr) return recoveredArr;
    }

    return null;
};

async function withSingleAutoRetry<T>(
    operation: () => Promise<T>,
    taskLabel: string,
    signal?: AbortSignal,
    onRetryNotice?: (msg: string) => void
): Promise<T> {
    try {
        return await operation();
    } catch (firstErr: any) {
        const msg = String(firstErr?.message || firstErr || '');
        const lower = msg.toLowerCase();
        if (
            signal?.aborted ||
            msg.includes('取消') ||
            lower.includes('not configured') ||
            lower.includes('api_key') ||
            lower.includes('permission_denied') ||
            lower.includes('403') ||
            lower.includes('resource_exhausted') ||
            lower.includes('429') ||
            msg.includes('模型路由不一致')
        ) {
            throw firstErr;
        }
        console.warn(`[审稿分段自动重试] ${taskLabel} 首次失败（${msg}），正在自动重试 1 次...`);
        onRetryNotice?.(`${taskLabel} 首次处理异常，正在自动重试...`);
        await new Promise((resolve) => setTimeout(resolve, 450));
        return await operation();
    }
}

interface TextChunk {
    text: string;
    startOffset: number;
    endOffset: number;
}

const splitIntoParagraphChunks = (text: string, maxChunkChars = 8500): TextChunk[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const chunks: TextChunk[] = [];
    let buf: string[] = [];
    let bufStart = 0;
    let cursor = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineWithNl = i < lines.length - 1 ? line + '\n' : line;
        const candidateLen = buf.join('\n').length + lineWithNl.length;

        if (buf.length > 0 && candidateLen > maxChunkChars) {
            const chunkText = buf.join('\n');
            chunks.push({
                text: chunkText,
                startOffset: bufStart,
                endOffset: bufStart + chunkText.length
            });
            buf = [line];
            bufStart = cursor;
        } else {
            if (buf.length === 0) bufStart = cursor;
            buf.push(line);
        }
        cursor += lineWithNl.length;
    }

    if (buf.length > 0) {
        const chunkText = buf.join('\n');
        chunks.push({
            text: chunkText,
            startOffset: bufStart,
            endOffset: bufStart + chunkText.length
        });
    }

    return chunks;
};

const isClanOrPlaceSuffix = (term: string): boolean => {
    if (term.length >= 2 && term.length <= 3 && /[家府族门派宗帮宫殿院楼村镇县省城]$/.test(term)) {
        return true;
    }
    return false;
};

const verifyAndRegisterCharacters = (
    fullText: string,
    chunkOffset: number,
    rawItems: any[],
    excludedSet: Set<string>,
    confirmedMap: Map<string, {
        canonical: string;
        mentions: Set<string>;
        role?: string;
        evidence: Set<string>;
        firstIndex: number;
    }>,
    uncertainCollector: Array<{
        name: string;
        mentions: string[];
        role?: string;
        evidence: string;
        reason: string;
        index: number;
    }>
) => {
    if (!Array.isArray(rawItems)) return;

    for (const item of rawItems) {
        if (!item || typeof item !== 'object') continue;
        const rawCanonical = typeof item.canonical === 'string' ? item.canonical.trim() : '';
        const rawMentions: string[] = Array.isArray(item.mentions)
            ? item.mentions.filter((m: unknown): m is string => typeof m === 'string').map((m: string) => m.trim())
            : [];
        const allCandidates = Array.from(new Set([rawCanonical, ...rawMentions].filter(Boolean)));

        // Strict verbatim verification: must exist verbatim in manuscript text, not excluded, not pure pronoun/generic title or clan name
        const validMentions = allCandidates.filter((m) => {
            if (m.length < 2 || m.length > 10) return false;
            if (excludedSet.has(m)) return false;
            if (STRICT_GENERIC_PRONOUNS_AND_TITLES.has(m)) return false;
            if (isClanOrPlaceSuffix(m)) return false;
            return fullText.includes(m);
        });

        if (validMentions.length === 0) continue;

        const chosenCanonical = validMentions.includes(rawCanonical) ? rawCanonical : validMentions[0];
        const rawEvidence = typeof item.evidence === 'string' ? item.evidence.trim() : '';
        const idx = locateVerbatimSpan(fullText, chosenCanonical, rawEvidence, chunkOffset);
        const verifiedEvidence = rawEvidence && fullText.includes(rawEvidence)
            ? rawEvidence
            : extractSnippetNear(fullText, chosenCanonical, idx);
        const confidence = item.confidence === 'uncertain' ? 'uncertain' : 'confirmed';
        const reason = typeof item.reason === 'string' ? item.reason.trim() : '';

        if (confidence === 'uncertain') {
            uncertainCollector.push({
                name: chosenCanonical,
                mentions: validMentions,
                role: typeof item.role === 'string' ? item.role.trim() : undefined,
                evidence: verifiedEvidence,
                reason: reason || 'AI 对该词语是否属于独立人物姓名或别称存在不确定性，请结合上下文确认',
                index: Math.max(0, idx)
            });
            continue;
        }

        // Merge into existing entity if any mention overlaps
        let targetKey: string | null = null;
        for (const [k, existing] of confirmedMap.entries()) {
            if (validMentions.some(m => existing.mentions.has(m))) {
                targetKey = k;
                break;
            }
        }

        if (targetKey) {
            const existing = confirmedMap.get(targetKey)!;
            validMentions.forEach(m => existing.mentions.add(m));
            if (verifiedEvidence) existing.evidence.add(verifiedEvidence);
            if (!existing.role && typeof item.role === 'string' && item.role.trim()) {
                existing.role = item.role.trim();
            }
            if (idx >= 0 && idx < existing.firstIndex) existing.firstIndex = idx;
        } else {
            confirmedMap.set(chosenCanonical, {
                canonical: chosenCanonical,
                mentions: new Set(validMentions),
                role: typeof item.role === 'string' ? item.role.trim() : undefined,
                evidence: new Set(verifiedEvidence ? [verifiedEvidence] : []),
                firstIndex: Math.max(0, idx)
            });
        }
    }
};

// --- 1. 原稿 AI 全语义解析（人物/别名/专属称谓/不确定项） ---
async function analyzeOriginalChunkWithAI(
    chunkText: string,
    chunkIndex: number,
    totalChunks: number,
    model: string,
    knownCharactersHint: string[],
    signal?: AbortSignal
): Promise<{ characters: any[]; actualModel: string }> {
    const hintText = knownCharactersHint.length > 0
        ? `\n前文已确认人物参考（若本段出现同一人物的别名/封号请自动关联）：${knownCharactersHint.slice(0, 40).join('、')}`
        : '';

    const prompt = `你是一名精通中国古代言情、宫斗、现言与悬疑小说的资深审稿编辑。请仔细阅读下面【原稿第 ${chunkIndex + 1}/${totalChunks} 段】完整上下文，通过语义理解提取文中**所有真实出现的人物**（包括主角、丫鬟、太医、太监、配角与仅出场一次的低频人物）。${hintText}

严格要求：
1. 必须先基于全文语境判断其是否真的是“人物”，然后再提取姓名、字号、小名/昵称、封号或明确指向单人的专属称谓。
2. 合并同一人物的不同称呼到同一个对象的 mentions 数组中（例如：姓名/小名/封号/氏称，如 ["沈霁", "阿霁", "昭妃"]、["钱嬷嬷", "钱氏"]、["陆未央", "未央"]）。
3. 严禁提取以下内容作为人物：
   - 通用泛称与亲属称谓（如：陛下、皇上、太后、皇后、贵妃、娘娘、王爷、太医、公公、嬷嬷、奴婢、父亲、母亲、哥哥、妹妹）
   - 家族/群体/地点机构名（如：沈家、陆家、顾府、江南、京城、小厨房）
   - 普通名词、动词短语、器物或行为（如：秋千、膝盖、军信、搜检、端茶、当场、置气、抬起、严讯、亲手做、谢陛下、许多事）
   - 严禁拼接或截断词组（如“容枝死了”只能提“容枝”，不能提“容枝死”）。
4. 明确指向特定单人的专属称谓（如：柔妃、韵妃、昭妃、顾嬷嬷、钱嬷嬷、刘公公）必须保留。
5. 如果某处疑似人物小名、称谓或冷僻称呼你**不能完全确定**是否真为人名，请照实标记 "confidence": "uncertain" 并说明简短 reason，切勿强行当成确认人物，也不要直接丢弃。
6. 所有 canonical、mentions、evidence 必须是下方原文中**逐字真实出现**的文本。

仅返回严格 JSON 对象（不要额外解释）：
{
  "characters": [
    {
      "canonical": "主名或最常称呼",
      "mentions": ["主名", "别名或封号"],
      "role": "一句话身份说明（如：女主/皇上/贴身丫鬟/太监/配角）",
      "evidence": "包含该人物的原文短句",
      "confidence": "confirmed 或 uncertain",
      "reason": "若为 uncertain 必填简短原因"
    }
  ]
}

【原稿正文片段】：
${chunkText}`;

    const res = await callReviewModel(prompt, model, signal, {
        jsonMode: true,
        thinkingLevel: 'LOW',
        maxTokens: 8192
    });
    const parsed = parseJsonObjectSafe(res.text, 'characters');
    const chars = Array.isArray(parsed?.characters)
        ? parsed.characters
        : Array.isArray(parsed?.roles)
        ? parsed.roles
        : Array.isArray(parsed?.items)
        ? parsed.items
        : null;
    if (!parsed || !Array.isArray(chars)) {
        console.error(`[原稿第 ${chunkIndex + 1} 段 JSON 解析失败] 原始返回前400字:`, res.text.slice(0, 400));
        throw new Error(`原稿第 ${chunkIndex + 1} 段 AI 返回结构无法解析`);
    }
    return { characters: chars, actualModel: res.actualModel };
}

// --- 2. 仿写稿 AI 合并语义审稿（单次调用同时完成：人物抽取 + 人物一致性 + 错别字/语句不通 + 待人工核对） ---
async function analyzeImitationChunkWithAI(
    chunkText: string,
    chunkIndex: number,
    totalChunks: number,
    model: string,
    knownCharactersHint: string[],
    signal?: AbortSignal
): Promise<{
    characters: any[];
    issues: any[];
    actualModel: string;
}> {
    const hintText = knownCharactersHint.length > 0
        ? `\n前文已确认人物参考（供别名合并与名字前后一致性核查）：${knownCharactersHint.slice(0, 40).join('、')}`
        : '';

    const prompt = `你是一名精通中文网络小说与出版校对的高级审稿编辑。请仔细通读下面【仿写稿第 ${chunkIndex + 1}/${totalChunks} 段】上下文，一次性完成三项语义审稿任务：人物提取、人物一致性审查、错别字与语句校对。${hintText}

【任务一：人物姓名与专属称谓提取（characters）】
1. 基于上下文确认所有真实出现的人物（含主角、丫鬟、太医、太监、低频配角），合并同一人物的姓名、昵称、封号与专属称谓（如 ["陆未央", "未央"]、["顾嬷嬷", "顾氏"]）。
2. 严禁把“秋千、膝盖、小厨房、军信、搜检、端茶、当场、置气、们忙活、沈家、陆家、陛下、娘娘、哥哥、太医”等普通词语、器物动作、家族名或通用称谓当成人物；仅保留能明确指向特定个人的专属称谓（如 韵妃、顾嬷嬷、刘公公 等）。
3. 拿不准的边缘人物/称谓标记 "confidence": "uncertain" 并给出简短 reason。

【任务二：人物一致性与文字错别字审查（issues）】
请只检查真正有把握的问题，遇到拿不准（可能是作者刻意修辞、古言白话或方言口语）的问题标记 "confidence": "uncertain" 交由人工核对：
- 人物一致性 (type="consistency")：同一人物姓名写错同音/形近字（如前面叫“陆陵”此处误作“陆凌”）、封号/位份/称呼混乱、人物关系前后矛盾（如前文说独生女后文忽然称其姐）。
- 错别字与同音误用 (type="typo" | "homophone")：明确错字别字、的/地/得误用、在/再误用、必需/必须误用、成语错字等。
- 漏字/多字 (type="missing_char" | "extra_char")：明显打字多字重复或句意残缺漏字。
- 固定搭配错误与明显语句不通 (type="collocation" | "grammar")：搭配不当或主谓残缺导致明显不通顺。
- **严厉防误报**：正常小说口语、古言文白词（岂敢、罢了、奴婢、臣妾）、对话省略句、刻意排比强调**不要报错**！不确定时设为 "confidence": "uncertain"。

【重要规则】
所有 canonical、mentions、evidence、wrongText、sentence 必须是下方原文中**逐字真实存在**的原文片段，不得自行编造或拼接。

仅返回严格 JSON 对象：
{
  "characters": [
    {
      "canonical": "主名",
      "mentions": ["主名", "别名或专属称谓"],
      "role": "身份说明",
      "evidence": "包含该人物的原文原句",
      "confidence": "confirmed 或 uncertain",
      "reason": "若为 uncertain 必填原因"
    }
  ],
  "issues": [
    {
      "type": "consistency | typo | homophone | missing_char | extra_char | collocation | grammar",
      "confidence": "confirmed 或 uncertain",
      "wrongText": "原文需要修改的精确短片段",
      "correctText": "建议修改后的文本",
      "sentence": "包含该问题的原文完整原句",
      "reason": "简短的判断原因"
    }
  ]
}

【仿写稿正文片段】：
${chunkText}`;

    const res = await callReviewModel(prompt, model, signal, {
        jsonMode: true,
        thinkingLevel: 'LOW',
        maxTokens: 8192
    });
    const parsed = parseJsonObjectSafe(res.text, 'characters');
    const chars = Array.isArray(parsed?.characters)
        ? parsed.characters
        : Array.isArray(parsed?.roles)
        ? parsed.roles
        : null;
    if (!parsed || !Array.isArray(chars)) {
        console.error(`[仿写第 ${chunkIndex + 1} 段 JSON 解析失败] 原始返回前400字:`, res.text.slice(0, 400));
        throw new Error(`仿写稿第 ${chunkIndex + 1} 段 AI 返回结构无法解析`);
    }
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    return {
        characters: chars,
        issues,
        actualModel: res.actualModel
    };
}

// --- 3. 同字换序 / 同音 / 近音 / 重名 / 专属称谓比对 ---
const getSyllables = (name: string): string[] => {
    const arr = pinyin(name, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
    return arr.map(s => s.toLowerCase().trim()).filter(Boolean);
};

const normalizeFuzzyPinyin = (syl: string): string => {
    return syl
        .replace(/^zh/, 'z')
        .replace(/^ch/, 'c')
        .replace(/^sh/, 's')
        .replace(/ang$/, 'an')
        .replace(/eng$/, 'en')
        .replace(/ing$/, 'in')
        .replace(/^n(?=[aeiouü])/, 'l');
};

const isSyllableClose = (s1: string, s2: string): boolean => {
    if (s1 === s2) return true;
    return normalizeFuzzyPinyin(s1) === normalizeFuzzyPinyin(s2);
};

const SPECIFIC_TITLE_END_RX = /(?:嬷嬷|公公|太监|姑姑|太医|御医|大夫|贵妃|皇贵妃|妃|嫔|贵人|常在|答应|婕妤|才人|昭仪|美人|王妃|侧妃|公主|郡主|世子|小姐|姑娘|公子|少爷|夫人|太太|先生|氏|总|董|队长|局长)$/;

const isSwappedCharPair = (a: string, b: string): boolean => {
    const cleanA = a.replace(/[^\u4e00-\u9fa5]/g, '');
    const cleanB = b.replace(/[^\u4e00-\u9fa5]/g, '');
    if (cleanA.length < 2 || cleanA.length !== cleanB.length || cleanA === cleanB) return false;
    return [...cleanA].sort().join('') === [...cleanB].sort().join('');
};

const compareTwoCharacterMentions = (
    origMention: string,
    imitMention: string
): {
    conflictType: CharacterConflictItem['conflictType'];
    origPinyin: string;
    imitPinyin: string;
} | null => {
    const oSyl = getSyllables(origMention);
    const iSyl = getSyllables(imitMention);
    const origPinyin = oSyl.join(' ');
    const imitPinyin = iSyl.join(' ');

    if (origMention === imitMention) {
        return {
            conflictType: SPECIFIC_TITLE_END_RX.test(origMention) ? 'title' : 'exact',
            origPinyin,
            imitPinyin
        };
    }

    if (isSwappedCharPair(origMention, imitMention)) {
        return {
            conflictType: 'swapped',
            origPinyin,
            imitPinyin
        };
    }

    if (oSyl.length < 2 || oSyl.length !== iSyl.length) {
        return null;
    }

    if (oSyl.every((s, idx) => s === iSyl[idx])) {
        return {
            conflictType: 'homophone',
            origPinyin,
            imitPinyin
        };
    }

    let exactCount = 0;
    let fuzzyOnlyCount = 0;
    for (let idx = 0; idx < oSyl.length; idx++) {
        if (oSyl[idx] === iSyl[idx]) {
            exactCount++;
        } else if (isSyllableClose(oSyl[idx], iSyl[idx])) {
            fuzzyOnlyCount++;
        } else {
            return null;
        }
    }

    if (exactCount >= oSyl.length - 1 && fuzzyOnlyCount >= 1) {
        return {
            conflictType: 'near_homophone',
            origPinyin,
            imitPinyin
        };
    }

    return null;
};

const CONFLICT_PRIORITY: Record<CharacterConflictItem['conflictType'], number> = {
    exact: 5,
    title: 4,
    swapped: 3,
    homophone: 2,
    near_homophone: 1
};

export const compareCharacterConflicts = (
    originalText: string,
    imitationText: string,
    origEntities: ReviewedCharacterEntity[],
    imitEntities: ReviewedCharacterEntity[]
): {
    confirmedConflicts: CharacterConflictItem[];
    uncertainConflictManualItems: ManualReviewItem[];
} => {
    const confirmedConflicts: CharacterConflictItem[] = [];
    const uncertainConflictManualItems: ManualReviewItem[] = [];
    const seenPairs = new Set<string>();

    for (const origEnt of origEntities) {
        for (const imitEnt of imitEntities) {
            const bestForImit = new Map<string, {
                origM: string;
                imitM: string;
                conflictType: CharacterConflictItem['conflictType'];
                origPinyin: string;
                imitPinyin: string;
            }>();

            for (const oM of origEnt.mentions) {
                for (const iM of imitEnt.mentions) {
                    const cmp = compareTwoCharacterMentions(oM, iM);
                    if (!cmp) continue;
                    const prev = bestForImit.get(iM);
                    if (!prev || CONFLICT_PRIORITY[cmp.conflictType] > CONFLICT_PRIORITY[prev.conflictType]) {
                        bestForImit.set(iM, {
                            origM: oM,
                            imitM: iM,
                            conflictType: cmp.conflictType,
                            origPinyin: cmp.origPinyin,
                            imitPinyin: cmp.imitPinyin
                        });
                    }
                }
            }

            bestForImit.forEach((m) => {
                const pairKey = `${m.origM}->${m.imitM}`;
                if (seenPairs.has(pairKey)) return;
                const count = countExactOccurrences(imitationText, m.imitM);
                if (count === 0) return;
                seenPairs.add(pairKey);

                const origIdx = Math.max(0, originalText.indexOf(m.origM));
                const imitIdx = Math.max(0, imitationText.indexOf(m.imitM));

                // 若单字通用称谓外或任一方置信度不确定，或某些近音存疑，放入待人工核对；否则进入确认冲突
                const isBothConfirmed = origEnt.confidence === 'confirmed' && imitEnt.confidence === 'confirmed';
                const labelMap: Record<CharacterConflictItem['conflictType'], string> = {
                    exact: '完全重名',
                    title: '相同专属称谓',
                    swapped: '同字换序命名',
                    homophone: '同音谐音',
                    near_homophone: '近音谐音'
                };

                if (isBothConfirmed) {
                    confirmedConflicts.push({
                        id: `conflict-${confirmedConflicts.length}-${m.origM}-${m.imitM}`,
                        originalName: m.origM,
                        imitationName: m.imitM,
                        originalEntityDisplay: origEnt.mentions.join(' / '),
                        imitationEntityDisplay: imitEnt.mentions.join(' / '),
                        originalEvidence: origEnt.evidence[0],
                        imitationEvidence: imitEnt.evidence[0],
                        originalIndex: origIdx,
                        imitationIndex: imitIdx,
                        conflictType: m.conflictType,
                        isExactMatch: m.conflictType === 'exact' || m.conflictType === 'title' || m.conflictType === 'swapped',
                        originalPinyin: m.origPinyin,
                        imitationPinyin: m.imitPinyin,
                        count,
                        recommendedNames: NAME_RECOMMENDATIONS.slice(0, 3)
                    });
                } else {
                    const loc = getLocationInfo(imitationText, imitIdx);
                    uncertainConflictManualItems.push({
                        id: `manual-conflict-${uncertainConflictManualItems.length}-${m.origM}-${m.imitM}`,
                        issueType: 'conflict',
                        aiJudgment: `AI不确定：疑似与原稿角色「${m.origM}」构成${labelMap[m.conflictType]}`,
                        originalTextSnippet: origEnt.evidence[0] || m.origM,
                        imitationTextSnippet: imitEnt.evidence[0] || m.imitM,
                        originalIndex: origIdx,
                        imitationIndex: imitIdx,
                        locationLabel: `${loc.label}（共出现 ${count} 次）`,
                        reason: `双方人物「${m.origM}」(${m.origPinyin}) 与「${m.imitM}」(${m.imitPinyin}) 存在${labelMap[m.conflictType]}，但其中一方为待确认人物称呼。`,
                        suggestedFix: `若确为对应人物，建议将仿写中的「${m.imitM}」替换为「${NAME_RECOMMENDATIONS[0]}」等区分度更高的名称`,
                        wrongText: m.imitM,
                        correctText: NAME_RECOMMENDATIONS[0],
                        status: 'pending'
                    });
                }
            });
        }
    }

    return {
        confirmedConflicts: confirmedConflicts.sort((a, b) => CONFLICT_PRIORITY[b.conflictType] - CONFLICT_PRIORITY[a.conflictType]),
        uncertainConflictManualItems
    };
};

// --- 4. 连续 15 字以上相同台词/句段检测 + 句子级查重调色盘 ---
export const detectDialogue15CharOverlaps = (
    originalText: string,
    imitationText: string
): DialogueSimilarityItem[] => {
    if (!originalText || !imitationText) return [];
    const results: DialogueSimilarityItem[] = [];
    const seenImitSpans: Array<{ start: number; end: number }> = [];

    // 先建立原稿去标点滑动索引（>=15汉字/字母数字连续匹配，映射回原文位置）
    const origNormChars: Array<{ ch: string; origIdx: number }> = [];
    for (let i = 0; i < originalText.length; i++) {
        if (/[\u4e00-\u9fa5A-Za-z0-9]/.test(originalText[i])) {
            origNormChars.push({ ch: originalText[i], origIdx: i });
        }
    }
    const origCleanStr = origNormChars.map(x => x.ch).join('');

    const imitNormChars: Array<{ ch: string; origIdx: number }> = [];
    for (let i = 0; i < imitationText.length; i++) {
        if (/[\u4e00-\u9fa5A-Za-z0-9]/.test(imitationText[i])) {
            imitNormChars.push({ ch: imitationText[i], origIdx: i });
        }
    }
    const imitCleanStr = imitNormChars.map(x => x.ch).join('');

    if (origCleanStr.length < 15 || imitCleanStr.length < 15) return [];

    // 用 15 字种子哈希定位最长公共连续片段
    const seedLen = 15;
    const origSeedMap = new Map<string, number[]>();
    for (let i = 0; i <= origCleanStr.length - seedLen; i++) {
        const sub = origCleanStr.slice(i, i + seedLen);
        const arr = origSeedMap.get(sub);
        if (arr) {
            if (arr.length < 5) arr.push(i);
        } else {
            origSeedMap.set(sub, [i]);
        }
    }

    let iIdx = 0;
    while (iIdx <= imitCleanStr.length - seedLen) {
        const seed = imitCleanStr.slice(iIdx, iIdx + seedLen);
        const matches = origSeedMap.get(seed);
        if (!matches) {
            iIdx++;
            continue;
        }

        let bestLen = seedLen;
        let bestOrigStart = matches[0];
        for (const oStart of matches) {
            let len = seedLen;
            while (
                iIdx + len < imitCleanStr.length &&
                oStart + len < origCleanStr.length &&
                imitCleanStr[iIdx + len] === origCleanStr[oStart + len]
            ) {
                len++;
            }
            if (len > bestLen) {
                bestLen = len;
                bestOrigStart = oStart;
            }
        }

        const rawImitStart = imitNormChars[iIdx].origIdx;
        const rawImitEnd = imitNormChars[iIdx + bestLen - 1].origIdx + 1;
        const rawOrigStart = origNormChars[bestOrigStart].origIdx;
        const rawOrigEnd = origNormChars[bestOrigStart + bestLen - 1].origIdx + 1;

        if (!seenImitSpans.some(s => !(rawImitEnd <= s.start || rawImitStart >= s.end))) {
            seenImitSpans.push({ start: rawImitStart, end: rawImitEnd });
            const imitSlice = imitationText.slice(rawImitStart, rawImitEnd);
            const origSlice = originalText.slice(rawOrigStart, rawOrigEnd);
            const isDialogue = /[“「”」]/.test(
                imitationText.slice(Math.max(0, rawImitStart - 12), Math.min(imitationText.length, rawImitEnd + 12))
            );
            results.push({
                id: `overlap-15-${rawImitStart}`,
                kind: 'dialogue_15',
                severity: 'danger',
                originalSnippet: origSlice,
                imitationSnippet: imitSlice,
                originalIndex: rawOrigStart,
                imitationIndex: rawImitStart,
                length: bestLen,
                reason: isDialogue
                    ? `检测到连续 ${bestLen} 字台词/对白与原稿完全一致（已超 15 字警戒线），需重点改写`
                    : `检测到连续 ${bestLen} 字正文句段与原稿一字不差，存在直接照搬风险`
            });
        }

        iIdx += bestLen;
    }

    return results;
};

// --- 5. AI 跨稿语义查重（长句、台词意译复用、关键桥段、情节结构） ---
async function analyzeCrossSimilarityWithAI(
    originalText: string,
    imitationText: string,
    model: string,
    signal?: AbortSignal
): Promise<{
    confirmedSimilarities: DialogueSimilarityItem[];
    uncertainSimilarityManualItems: ManualReviewItem[];
}> {
    const sampleWindow = (txt: string, maxTotal: number): string => {
        if (txt.length <= maxTotal) return txt;
        const third = Math.floor(maxTotal / 3);
        const midStart = Math.floor((txt.length - third) / 2);
        return [
            `【开头部分】\n${txt.slice(0, third)}`,
            `【中段部分】\n${txt.slice(midStart, midStart + third)}`,
            `【后段部分】\n${txt.slice(txt.length - third)}`
        ].join('\n\n……（略）……\n\n');
    };

    const buildPrompt = (maxPerSide: number) => {
        const origSample = sampleWindow(originalText, maxPerSide);
        const imitSample = sampleWindow(imitationText, maxPerSide);
        return `你是一名小说版权与反洗稿审查专家。请对比以下【原稿】与【仿写稿】，找出实质性内容雷同（最多返回最明显的 12 条）。

重点排查对象：
1. 明显重复的长句（>=12字，句式与核心意象/动作链高度雷同，并非日常“不救”“知道了”“陛下”等短句通用表达）
2. 高度雷同的台词/对白
3. 关键桥段与情节结构照搬（具体冲突事件顺序、反转方式、道具陷阱高度贴合原稿）

严厉禁止：
- 普通短语（如“冷笑一声”“转身离去”“谢陛下”“端茶上来”）或通用古言常见写法绝对不能判定雷同！
- 无法确定是否属于合理套路借鉴还是过度雷同的片段，标记 "confidence": "uncertain" 进入人工核对列表。
- originalSnippet 和 imitationSnippet 必须是双方文本中**真实存在的原句或片段**。

仅返回严格 JSON 对象（无相似则 {"findings": []}）：
{
  "findings": [
    {
      "kind": "long_sentence | plot_structure",
      "confidence": "confirmed | uncertain",
      "originalSnippet": "原稿对应真实片段",
      "imitationSnippet": "仿写对应真实片段",
      "reason": "简短说明相似处（25字内）",
      "suggestedRewrite": "建议改写思路或替代句"
    }
  ]
}

【原稿参照】：
${origSample}

【仿写待审】：
${imitSample}`;
    };

    let parsed: any = null;
    let lastError: Error | null = null;
    for (const windowSize of [6800, 4200]) {
        if (signal?.aborted) throw new Error('审稿任务已被用户取消');
        try {
            const res = await callReviewModel(buildPrompt(windowSize), model, signal, {
                jsonMode: true,
                timeoutMs: 36000,
                thinkingLevel: 'LOW',
                maxTokens: 4096
            });
            parsed = parseJsonObjectSafe(res.text, 'findings');
            if (parsed && Array.isArray(parsed.findings)) {
                break;
            }
            console.error('[跨稿语义查重 JSON 解析失败] 原始返回前400字:', res.text.slice(0, 400));
            lastError = new Error('跨稿语义查重返回结构非标准 JSON');
        } catch (err: any) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (
                signal?.aborted ||
                lastError.message.includes('取消') ||
                lastError.message.includes('not configured') ||
                lastError.message.includes('模型路由不一致')
            ) {
                throw lastError;
            }
        }
    }

    if (!parsed || !Array.isArray(parsed.findings)) {
        throw lastError || new Error('跨稿语义查重未返回有效结果');
    }

    const findings = parsed.findings;
    const confirmedSimilarities: DialogueSimilarityItem[] = [];
    const uncertainSimilarityManualItems: ManualReviewItem[] = [];

    findings.forEach((f: any, idx: number) => {
        const origSnip = typeof f.originalSnippet === 'string' ? f.originalSnippet.trim() : '';
        const imitSnip = typeof f.imitationSnippet === 'string' ? f.imitationSnippet.trim() : '';
        if (!imitSnip || imitSnip.length < 10) return;

        const origIdx = origSnip ? originalText.indexOf(origSnip) : -1;
        const imitIdx = imitationText.indexOf(imitSnip);
        if (imitIdx === -1) return;

        const cleanLen = imitSnip.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').length;
        if (cleanLen < 8) return;

        const reason = typeof f.reason === 'string' && f.reason.trim()
            ? f.reason.trim()
            : '句式意象或关键桥段与原稿高度相近';
        const suggestedRewrite = typeof f.suggestedRewrite === 'string' ? f.suggestedRewrite.trim() : '建议更换冲突切入点、角色反应动作与句式表达';

        if (f.confidence === 'uncertain') {
            const loc = getLocationInfo(imitationText, imitIdx);
            uncertainSimilarityManualItems.push({
                id: `manual-sim-${idx}-${imitIdx}`,
                issueType: 'similarity',
                aiJudgment: `AI不确定：疑似${f.kind === 'plot_structure' ? '关键桥段/结构' : '长句/台词'}相近`,
                originalTextSnippet: origSnip || '（原稿对应语义桥段）',
                imitationTextSnippet: imitSnip,
                originalIndex: origIdx >= 0 ? origIdx : undefined,
                imitationIndex: imitIdx,
                locationLabel: loc.label,
                reason,
                suggestedFix: suggestedRewrite,
                wrongText: imitSnip,
                correctText: suggestedRewrite.length > 10 && !suggestedRewrite.startsWith('建议') ? suggestedRewrite : undefined,
                status: 'pending'
            });
        } else {
            confirmedSimilarities.push({
                id: `sim-ai-${idx}-${imitIdx}`,
                kind: f.kind === 'plot_structure' ? 'plot_structure' : 'long_sentence',
                severity: f.kind === 'plot_structure' ? 'danger' : 'warning',
                originalSnippet: origSnip || '（原稿对应语义桥段）',
                imitationSnippet: imitSnip,
                originalIndex: origIdx >= 0 ? origIdx : 0,
                imitationIndex: imitIdx,
                length: cleanLen,
                reason,
                suggestedRewrite
            });
        }
    });

    return { confirmedSimilarities, uncertainSimilarityManualItems };
}

// --- 6. 句子级查重调色盘（保留原有四色阈值与短句豁免，并标注 15 字以上重复句段） ---
const calculateNgramSimilarity = (str1: string, str2: string, n = 2): number => {
    if (!str1 || !str2) return 0;
    const s1 = str1.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    const s2 = str2.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < n || s2.length < n) {
        return s1.includes(s2) || s2.includes(s1) ? 0.65 : 0;
    }

    const grams1 = new Set<string>();
    for (let i = 0; i <= s1.length - n; i++) grams1.add(s1.slice(i, i + n));
    const grams2 = new Set<string>();
    for (let i = 0; i <= s2.length - n; i++) grams2.add(s2.slice(i, i + n));

    let inter = 0;
    grams1.forEach(g => {
        if (grams2.has(g)) inter++;
    });
    return (2 * inter) / (grams1.size + grams2.size);
};

interface SentenceSpan {
    text: string;
    startIndex: number;
    endIndex: number;
}

const extractSentenceSpans = (text: string): SentenceSpan[] => {
    const spans: SentenceSpan[] = [];
    const rx = /[^。！？!?\n]+/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
        const raw = m[0];
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const leadSpaces = raw.indexOf(trimmed);
        const startIndex = (m.index ?? 0) + Math.max(0, leadSpaces);
        spans.push({
            text: trimmed,
            startIndex,
            endIndex: startIndex + trimmed.length
        });
    }
    return spans;
};

export const computeSentenceSimilarityPalette = (
    originalText: string,
    imitationText: string,
    dialogue15Overlaps: DialogueSimilarityItem[]
): SentenceSimilarity[] => {
    const origSpans = extractSentenceSpans(originalText);
    const imitSpans = extractSentenceSpans(imitationText);

    return imitSpans.map((span, i) => {
        const cleanImit = span.text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
        const cleanLen = cleanImit.length;

        const overlapping15 = dialogue15Overlaps.find(
            d => d.kind === 'dialogue_15' && !(span.endIndex <= d.imitationIndex || span.startIndex >= d.imitationIndex + d.imitationSnippet.length)
        );

        // 常见短句（如“不救”、“知道了”）豁免，绝不单独触发严重雷同警告
        if (cleanLen < 6 && !overlapping15) {
            return {
                imitationIndex: i,
                startIndex: span.startIndex,
                endIndex: span.endIndex,
                sentence: span.text,
                similarity: 0.08,
                matchedOriginalSentence: '',
                matchedOriginalSimilarity: 0.08,
                colorLevel: 'safe'
            };
        }

        let maxSim = 0;
        let matchedOrig = '';
        let matchedOrigIdx = -1;

        for (const oSpan of origSpans) {
            const cleanOrig = oSpan.text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
            if (cleanOrig.length < 5) continue;
            const sim = calculateNgramSimilarity(span.text, oSpan.text);
            if (sim > maxSim) {
                maxSim = sim;
                matchedOrig = oSpan.text;
                matchedOrigIdx = oSpan.startIndex;
            }
        }

        if (overlapping15) {
            maxSim = Math.max(maxSim, 0.9);
            if (!matchedOrig) {
                matchedOrig = overlapping15.originalSnippet;
                matchedOrigIdx = overlapping15.originalIndex;
            }
        }

        let colorLevel: SentenceSimilarity['colorLevel'] = 'safe';
        if ((maxSim >= 0.75 && cleanLen >= 8) || overlapping15) {
            colorLevel = 'danger';
        } else if (maxSim >= 0.55 && cleanLen >= 6) {
            colorLevel = 'warning';
        } else if (maxSim >= 0.35 && cleanLen >= 6) {
            colorLevel = 'caution';
        }

        return {
            imitationIndex: i,
            startIndex: span.startIndex,
            endIndex: span.endIndex,
            sentence: span.text,
            similarity: maxSim,
            matchedOriginalSentence: matchedOrig,
            matchedOriginalIndex: matchedOrigIdx >= 0 ? matchedOrigIdx : undefined,
            matchedOriginalSimilarity: maxSim,
            isLongDialogueOverlap: !!overlapping15,
            colorLevel
        };
    });
};

// --- 7. 统一审稿执行器（支持全文首审 & 修改后仅重检受影响段落） ---
export interface RunAuditParams {
    originalText: string;
    imitationText: string;
    model: string;
    excludedCharacters: Set<string>;
    customAddedCharacters: string[];
    previousCache: AuditCacheState | null;
    forceFull?: boolean;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
}

const VALID_TYPO_CATS = new Set<TypoAuditItem['category']>([
    'typo', 'homophone', 'extra_char', 'missing_char', 'collocation', 'consistency', 'grammar'
]);

export async function runComprehensiveManuscriptAudit(params: RunAuditParams): Promise<{
    report: AuditReportResult;
    nextCache: AuditCacheState;
}> {
    const {
        originalText,
        imitationText,
        model,
        excludedCharacters,
        customAddedCharacters,
        previousCache,
        forceFull = false,
        signal,
        onProgress
    } = params;

    const startTime = performance.now();
    let actualModelUsed = model;

    // 段落快照辅助，用于增量重检判定
    const imitParagraphs = imitationText.split('\n');
    const canIncrementalOriginal =
        !forceFull &&
        previousCache !== null &&
        previousCache.modelUsed === model &&
        previousCache.originalText === originalText;

    const prevImitLines = canIncrementalOriginal ? previousCache!.imitationText.split('\n') : [];
    const dirtyLineIndices: number[] = [];

    if (canIncrementalOriginal && prevImitLines.length > 0 && previousCache!.imitationParagraphResults.size > 0) {
        const maxLines = Math.max(prevImitLines.length, imitParagraphs.length);
        for (let i = 0; i < maxLines; i++) {
            if ((prevImitLines[i] || '') !== (imitParagraphs[i] || '')) {
                dirtyLineIndices.push(i);
            }
        }
    }

    // 当且仅当原稿未变、模型未变，且仿写修改比例 < 55% 时执行局部增量复检
    const shouldRunIncremental =
        canIncrementalOriginal &&
        dirtyLineIndices.length > 0 &&
        dirtyLineIndices.length <= Math.max(2, Math.floor(imitParagraphs.length * 0.55));

    const origChunks = splitIntoParagraphChunks(originalText, 8500);
    const imitChunks = splitIntoParagraphChunks(imitationText, 8500);

    const origConfirmedMap = new Map<string, {
        canonical: string;
        mentions: Set<string>;
        role?: string;
        evidence: Set<string>;
        firstIndex: number;
    }>();
    const origUncertainRaw: Array<{
        name: string;
        mentions: string[];
        role?: string;
        evidence: string;
        reason: string;
        index: number;
    }> = [];

    const imitConfirmedMap = new Map<string, {
        canonical: string;
        mentions: Set<string>;
        role?: string;
        evidence: Set<string>;
        firstIndex: number;
    }>();
    const imitUncertainRaw: Array<{
        name: string;
        mentions: string[];
        role?: string;
        evidence: string;
        reason: string;
        index: number;
    }> = [];

    const typoIssues: TypoAuditItem[] = [];
    const manualReviewItems: ManualReviewItem[] = [];

    let originalSucceededChunks = 0;
    let imitationSucceededChunks = 0;
    const failedTaskDetails: FailedAuditTask[] = [];
    const originalChunkCharacters = new Map<number, any[]>();
    const imitationChunkResults = new Map<number, { characters: any[]; issues: any[] }>();

    // Helper: 校验并吸收仿写 issues（明确错误进 typoIssues，不确定进 manualReviewItems）
    const absorbImitationIssues = (rawIssues: any[], searchOffset: number) => {
        if (!Array.isArray(rawIssues)) return;
        for (const item of rawIssues) {
            if (!item || typeof item !== 'object') continue;
            const wrongText = typeof item.wrongText === 'string' ? item.wrongText.trim() : '';
            const correctText = typeof item.correctText === 'string' ? item.correctText.trim() : '';
            const sentence = typeof item.sentence === 'string' ? item.sentence.trim() : '';
            const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
            if (!wrongText) continue;

            const idx = locateVerbatimSpan(imitationText, wrongText, sentence, searchOffset);
            if (idx === -1) continue; // 必须逐字存在于仿写正文中

            const loc = getLocationInfo(imitationText, idx);
            const verifiedSentence = sentence && imitationText.includes(sentence)
                ? sentence
                : extractSnippetNear(imitationText, wrongText, idx);

            const issueTypeMap: Record<string, ManualReviewItem['issueType']> = {
                consistency: 'consistency',
                typo: 'typo',
                homophone: 'typo',
                missing_char: 'typo',
                extra_char: 'typo',
                collocation: 'typo',
                grammar: 'typo'
            };

            const cat: TypoAuditItem['category'] = VALID_TYPO_CATS.has(item.type) ? item.type : 'typo';

            if (item.confidence === 'uncertain') {
                if (!manualReviewItems.some(m => m.imitationIndex === idx && m.wrongText === wrongText)) {
                    manualReviewItems.push({
                        id: `manual-issue-${idx}-${wrongText}`,
                        issueType: issueTypeMap[cat] || 'typo',
                        aiJudgment: `AI不确定：疑似${cat === 'consistency' ? '人物前后不一致' : '错别字或语句欠妥'}`,
                        originalTextSnippet: '—（仅涉及仿写正文）',
                        imitationTextSnippet: verifiedSentence,
                        imitationIndex: idx,
                        locationLabel: loc.label,
                        reason: reason || 'AI 无法确认属于笔误还是刻意小说表达，请人工核对',
                        suggestedFix: correctText ? `建议改为：${correctText}` : '请结合上下文确认是否需要修改',
                        wrongText,
                        correctText: correctText && correctText !== wrongText ? correctText : undefined,
                        status: 'pending'
                    });
                }
            } else {
                if (!correctText || correctText === wrongText) continue;
                const duplicate = typoIssues.some(
                    t => !(idx + wrongText.length <= t.index || idx >= t.index + t.wrongText.length)
                );
                if (!duplicate) {
                    typoIssues.push({
                        id: `typo-ai-${idx}-${wrongText}`,
                        index: idx,
                        wrongText,
                        correctText,
                        sentence: verifiedSentence,
                        explanation: reason || '上下文校对发现用词或人物前后不一致错误',
                        locationLabel: loc.label,
                        category: cat
                    });
                }
            }
        }
    };

    const nextParagraphCache = new Map<string, {
        entities: ReviewedCharacterEntity[];
        typos: TypoAuditItem[];
        manualItems: ManualReviewItem[];
    }>();

    let precomputedSimSettled: PromiseSettledResult<{
        confirmedSimilarities: DialogueSimilarityItem[];
        uncertainSimilarityManualItems: ManualReviewItem[];
    }>;

    if (shouldRunIncremental && previousCache) {
        onProgress?.(`正在局部增量复检（仅重检变更内容及邻接上下文，原稿复用缓存）...`);
        previousCache.originalEntities.forEach((ent) => {
            if (ent.confidence === 'confirmed') {
                origConfirmedMap.set(ent.canonical, {
                    canonical: ent.canonical,
                    mentions: new Set(ent.mentions.filter(m => !excludedCharacters.has(m))),
                    role: ent.role,
                    evidence: new Set(ent.evidence),
                    firstIndex: ent.firstIndex
                });
            }
        });
        originalSucceededChunks = origChunks.length;

        const minDirtyLine = Math.max(0, Math.min(...dirtyLineIndices) - 1);
        const maxDirtyLine = Math.min(imitParagraphs.length - 1, Math.max(...dirtyLineIndices) + 1);
        const dirtySegmentText = imitParagraphs.slice(minDirtyLine, maxDirtyLine + 1).join('\n');
        let dirtyOffset = 0;
        for (let i = 0; i < minDirtyLine; i++) {
            dirtyOffset += imitParagraphs[i].length + 1;
        }
        const dirtyEndOffset = dirtyOffset + dirtySegmentText.length;

        previousCache.imitationParagraphResults.forEach((cached, hashKey) => {
            if (hashKey === '__FULL__') {
                cached.entities.forEach((ent) => {
                    const mentionsAlive = ent.mentions.filter(m => !excludedCharacters.has(m) && imitationText.includes(m));
                    if (mentionsAlive.length > 0) {
                        imitConfirmedMap.set(ent.canonical, {
                            canonical: ent.canonical,
                            mentions: new Set(mentionsAlive),
                            role: ent.role,
                            evidence: new Set(ent.evidence),
                            firstIndex: Math.max(0, imitationText.indexOf(mentionsAlive[0]))
                        });
                    }
                });
                cached.typos.forEach((t) => {
                    if (t.index >= dirtyOffset && t.index <= dirtyEndOffset) return;
                    const reIdx = locateVerbatimSpan(imitationText, t.wrongText, t.sentence);
                    if (reIdx !== -1 && (reIdx < dirtyOffset || reIdx > dirtyEndOffset)) {
                        typoIssues.push({
                            ...t,
                            index: reIdx,
                            locationLabel: getLocationInfo(imitationText, reIdx).label
                        });
                    }
                });
                cached.manualItems.forEach((m) => {
                    if (m.issueType === 'similarity') return;
                    if (m.imitationIndex !== undefined && m.imitationIndex >= dirtyOffset && m.imitationIndex <= dirtyEndOffset) return;
                    if (m.status !== 'pending') return;
                    const searchTarget = m.wrongText || m.candidateName || '';
                    if (searchTarget && !imitationText.includes(searchTarget)) return;
                    if (m.imitationIndex !== undefined && searchTarget) {
                        const reIdx = locateVerbatimSpan(imitationText, searchTarget, m.imitationTextSnippet);
                        if (reIdx !== -1 && (reIdx < dirtyOffset || reIdx > dirtyEndOffset)) {
                            manualReviewItems.push({
                                ...m,
                                imitationIndex: reIdx,
                                locationLabel: m.candidateTarget === 'original' ? m.locationLabel : getLocationInfo(imitationText, reIdx).label
                            });
                        }
                    } else {
                        manualReviewItems.push(m);
                    }
                });
            }
        });

        const knownHint = Array.from(imitConfirmedMap.keys());
        const dirtySubChunks = splitIntoParagraphChunks(dirtySegmentText, 8500);

        const runDirty = async () => {
            let dirtyCursor = dirtyOffset;
            for (let i = 0; i < dirtySubChunks.length; i++) {
                const sub = dirtySubChunks[i];
                const aiRes = await withSingleAutoRetry(
                    () => analyzeImitationChunkWithAI(sub.text, i, dirtySubChunks.length, model, knownHint, signal),
                    `仿写变更段 ${i + 1}`,
                    signal,
                    onProgress
                );
                actualModelUsed = aiRes.actualModel;
                verifyAndRegisterCharacters(
                    imitationText,
                    dirtyCursor,
                    aiRes.characters,
                    excludedCharacters,
                    imitConfirmedMap,
                    imitUncertainRaw
                );
                absorbImitationIssues(aiRes.issues, dirtyCursor);
                dirtyCursor += sub.text.length + 1;
            }
            imitationSucceededChunks = imitChunks.length;
        };

        const crossSimPromise = withSingleAutoRetry(
            () => analyzeCrossSimilarityWithAI(originalText, imitationText, model, signal),
            '跨稿语义查重',
            signal,
            onProgress
        );
        const [dirtySettled, simSettled] = await Promise.allSettled([runDirty(), crossSimPromise]);
        if (dirtySettled.status === 'rejected') {
            const msg = dirtySettled.reason?.message || '变更段落复检失败';
            if (msg.includes('取消')) throw dirtySettled.reason;
            console.error('[局部复检失败]', dirtySettled.reason);
            failedTaskDetails.push({
                id: 'imit-dirty-recheck',
                kind: 'imitation_chunk',
                chunkIndex: 0,
                totalChunks: imitChunks.length,
                label: '仿写变更段落',
                errorMessage: msg
            });
        }
        precomputedSimSettled = simSettled;
    } else {
        // --- 完整全文语义审稿（原稿人物 + 仿写人物/错别字/一致性 + 跨稿语义查重 三路并行） ---
        onProgress?.(`正在并行调用 ${model} 执行审稿分析...`);

        let firstFatalErr: Error | null = null;

        const runOriginalFull = async () => {
            const hintAcc: string[] = [];
            for (let i = 0; i < origChunks.length; i++) {
                const c = origChunks[i];
                try {
                    onProgress?.(`正在审查原稿第 ${i + 1}/${origChunks.length} 段人物语境...`);
                    const res = await withSingleAutoRetry(
                        () => analyzeOriginalChunkWithAI(c.text, i, origChunks.length, model, hintAcc, signal),
                        `原稿第 ${i + 1} 段`,
                        signal,
                        onProgress
                    );
                    actualModelUsed = res.actualModel;
                    originalSucceededChunks++;
                    originalChunkCharacters.set(i, res.characters);
                    verifyAndRegisterCharacters(
                        originalText,
                        c.startOffset,
                        res.characters,
                        excludedCharacters,
                        origConfirmedMap,
                        origUncertainRaw
                    );
                    origConfirmedMap.forEach((_, k) => {
                        if (!hintAcc.includes(k)) hintAcc.push(k);
                    });
                } catch (err: any) {
                    const eObj = err instanceof Error ? err : new Error(String(err));
                    if (eObj.message.includes('取消')) throw eObj;
                    console.error(`[审稿分段失败] 原稿第 ${i + 1}/${origChunks.length} 段:`, eObj);
                    if (!firstFatalErr) firstFatalErr = eObj;
                    failedTaskDetails.push({
                        id: `orig-chunk-${i}`,
                        kind: 'original_chunk',
                        chunkIndex: i,
                        totalChunks: origChunks.length,
                        label: `原稿第 ${i + 1} 段`,
                        errorMessage: eObj.message
                    });
                }
            }
        };

        const runImitationFull = async () => {
            const hintAcc: string[] = [];
            for (let i = 0; i < imitChunks.length; i++) {
                const c = imitChunks[i];
                try {
                    onProgress?.(`正在审查仿写第 ${i + 1}/${imitChunks.length} 段人物、一致性与错别字...`);
                    const res = await withSingleAutoRetry(
                        () => analyzeImitationChunkWithAI(c.text, i, imitChunks.length, model, hintAcc, signal),
                        `仿写第 ${i + 1} 段`,
                        signal,
                        onProgress
                    );
                    actualModelUsed = res.actualModel;
                    imitationSucceededChunks++;
                    imitationChunkResults.set(i, { characters: res.characters, issues: res.issues });
                    verifyAndRegisterCharacters(
                        imitationText,
                        c.startOffset,
                        res.characters,
                        excludedCharacters,
                        imitConfirmedMap,
                        imitUncertainRaw
                    );
                    absorbImitationIssues(res.issues, c.startOffset);
                    imitConfirmedMap.forEach((_, k) => {
                        if (!hintAcc.includes(k)) hintAcc.push(k);
                    });
                } catch (err: any) {
                    const eObj = err instanceof Error ? err : new Error(String(err));
                    if (eObj.message.includes('取消')) throw eObj;
                    console.error(`[审稿分段失败] 仿写第 ${i + 1}/${imitChunks.length} 段:`, eObj);
                    if (!firstFatalErr) firstFatalErr = eObj;
                    failedTaskDetails.push({
                        id: `imit-chunk-${i}`,
                        kind: 'imitation_chunk',
                        chunkIndex: i,
                        totalChunks: imitChunks.length,
                        label: `仿写第 ${i + 1} 段`,
                        errorMessage: eObj.message
                    });
                }
            }
        };

        const [origSettled, imitSettled, simSettled] = await Promise.allSettled([
            runOriginalFull(),
            runImitationFull(),
            withSingleAutoRetry(
                () => analyzeCrossSimilarityWithAI(originalText, imitationText, model, signal),
                '跨稿语义查重',
                signal,
                onProgress
            )
        ]);

        if (signal?.aborted) {
            throw new Error('审稿任务已被用户取消');
        }
        if (origSettled.status === 'rejected' && String(origSettled.reason?.message || '').includes('取消')) {
            throw origSettled.reason;
        }
        if (imitSettled.status === 'rejected' && String(imitSettled.reason?.message || '').includes('取消')) {
            throw imitSettled.reason;
        }

        // 若双侧全部分段均彻底失败，直接报错中断，让用户检查当前模型并自主决定是否切换
        if (originalSucceededChunks === 0 && imitationSucceededChunks === 0) {
            throw firstFatalErr || new Error(`所选模型 ${model} 接口调用失败，请检查接口配置或切换模型重试`);
        }

        precomputedSimSettled = simSettled;
    }

    // 加入用户手动补充的关键人物
    for (const customName of customAddedCharacters) {
        const clean = customName.trim();
        if (!clean || excludedCharacters.has(clean)) continue;
        if (originalText.includes(clean) && !origConfirmedMap.has(clean)) {
            const idx = originalText.indexOf(clean);
            origConfirmedMap.set(clean, {
                canonical: clean,
                mentions: new Set([clean]),
                role: '人工加入人物',
                evidence: new Set([extractSnippetNear(originalText, clean, idx)]),
                firstIndex: Math.max(0, idx)
            });
        }
        if (imitationText.includes(clean) && !imitConfirmedMap.has(clean)) {
            const idx = imitationText.indexOf(clean);
            imitConfirmedMap.set(clean, {
                canonical: clean,
                mentions: new Set([clean]),
                role: '人工加入人物',
                evidence: new Set([extractSnippetNear(imitationText, clean, idx)]),
                firstIndex: Math.max(0, idx)
            });
        }
    }

    const toEntityList = (
        text: string,
        map: Map<string, { canonical: string; mentions: Set<string>; role?: string; evidence: Set<string>; firstIndex: number }>,
        prefix: string
    ): ReviewedCharacterEntity[] => {
        const out: ReviewedCharacterEntity[] = [];
        let i = 0;
        map.forEach((val) => {
            const mentions = [val.canonical, ...Array.from(val.mentions).filter(m => m !== val.canonical)];
            const count = mentions.reduce((sum, m) => sum + countExactOccurrences(text, m), 0);
            if (count > 0) {
                out.push({
                    id: `${prefix}-${i++}-${val.canonical}`,
                    canonical: val.canonical,
                    mentions,
                    role: val.role,
                    evidence: Array.from(val.evidence).slice(0, 3),
                    count,
                    confidence: 'confirmed',
                    firstIndex: val.firstIndex
                });
            }
        });
        return out.sort((a, b) => b.count - a.count);
    };

    const originalEntities = toEntityList(originalText, origConfirmedMap, 'orig');
    const imitationEntities = toEntityList(imitationText, imitConfirmedMap, 'imit');

    // 将 AI 不确定的人物候选加入「待人工核对」（保留全部 candidateMentions 以便确认时正确归并别名）
    const origConfirmedMentions = new Set(originalEntities.flatMap(e => e.mentions));
    origUncertainRaw.forEach((u, idx) => {
        if (u.mentions.some(m => origConfirmedMentions.has(m))) return;
        const loc = getLocationInfo(originalText, u.index);
        manualReviewItems.push({
            id: `manual-orig-char-${idx}-${u.name}`,
            issueType: 'character',
            aiJudgment: `AI不确定：原稿中「${u.name}」是否属于独立人物`,
            originalTextSnippet: u.evidence || u.name,
            imitationTextSnippet: '—（原稿只读 · 人物待确认）',
            originalIndex: u.index,
            locationLabel: `原稿 ${loc.label}`,
            reason: u.reason,
            suggestedFix: `若确为人物或已有角色别名，点「确认为人物」自动归并；若非人物请点「不是人物」`,
            candidateName: u.name,
            candidateMentions: u.mentions,
            candidateRole: u.role,
            candidateTarget: 'original',
            status: 'pending'
        });
    });

    const imitConfirmedMentions = new Set(imitationEntities.flatMap(e => e.mentions));
    imitUncertainRaw.forEach((u, idx) => {
        if (u.mentions.some(m => imitConfirmedMentions.has(m))) return;
        const loc = getLocationInfo(imitationText, u.index);
        manualReviewItems.push({
            id: `manual-imit-char-${idx}-${u.name}`,
            issueType: 'character',
            aiJudgment: `AI不确定：仿写中「${u.name}」是否属于独立人物`,
            originalTextSnippet: '—（仿写人物待确认）',
            imitationTextSnippet: u.evidence || u.name,
            imitationIndex: u.index,
            locationLabel: `仿写 ${loc.label}`,
            reason: u.reason,
            suggestedFix: `若确为人物或已有角色别名，点「确认为人物」自动归并；非人物请点「不是人物」`,
            candidateName: u.name,
            candidateMentions: u.mentions,
            candidateRole: u.role,
            candidateTarget: 'imitation',
            status: 'pending'
        });
    });

    // 构建用于碰撞的临时 uncertain 实体（帮助识别待定角色潜在同音冲突）
    const origForConflict: ReviewedCharacterEntity[] = [
        ...originalEntities,
        ...origUncertainRaw
            .filter(u => !u.mentions.some(m => origConfirmedMentions.has(m)))
            .map((u, idx) => ({
                id: `orig-u-${idx}`,
                canonical: u.name,
                mentions: u.mentions,
                evidence: [u.evidence],
                count: countExactOccurrences(originalText, u.name),
                confidence: 'uncertain' as const,
                firstIndex: u.index
            }))
    ];
    const imitForConflict: ReviewedCharacterEntity[] = [
        ...imitationEntities,
        ...imitUncertainRaw
            .filter(u => !u.mentions.some(m => imitConfirmedMentions.has(m)))
            .map((u, idx) => ({
                id: `imit-u-${idx}`,
                canonical: u.name,
                mentions: u.mentions,
                evidence: [u.evidence],
                count: countExactOccurrences(imitationText, u.name),
                confidence: 'uncertain' as const,
                firstIndex: u.index
            }))
    ];

    const { confirmedConflicts, uncertainConflictManualItems } = compareCharacterConflicts(
        originalText,
        imitationText,
        origForConflict,
        imitForConflict
    );
    manualReviewItems.push(...uncertainConflictManualItems);

    // 跨稿相似度审查（汇总并行 AI 语义查重结果 + 确定性 15 字连续重复台词）
    onProgress?.('正在汇总 15 字以上重复台词与调色盘计算...');
    const dialogue15Overlaps = detectDialogue15CharOverlaps(originalText, imitationText);

    let similarityChecked = false;
    let aiSimilarities: DialogueSimilarityItem[] = [];
    if (precomputedSimSettled.status === 'fulfilled') {
        similarityChecked = true;
        aiSimilarities = precomputedSimSettled.value.confirmedSimilarities;
        manualReviewItems.push(...precomputedSimSettled.value.uncertainSimilarityManualItems);
    } else {
        const simMsg = precomputedSimSettled.reason?.message || '未知错误';
        console.error('[跨稿语义查重失败]', precomputedSimSettled.reason);
        failedTaskDetails.push({
            id: 'cross-similarity',
            kind: 'cross_similarity',
            label: '跨稿语义查重',
            errorMessage: simMsg
        });
    }

    const mergedSimilarityAlerts: DialogueSimilarityItem[] = [...dialogue15Overlaps];
    for (const sItem of aiSimilarities) {
        const overlapsExisting = mergedSimilarityAlerts.some(
            ex => !(sItem.imitationIndex + sItem.imitationSnippet.length <= ex.imitationIndex || sItem.imitationIndex >= ex.imitationIndex + ex.imitationSnippet.length)
        );
        if (!overlapsExisting) {
            mergedSimilarityAlerts.push(sItem);
        }
    }

    // 句子级调色盘
    const sentenceSimilarities = computeSentenceSimilarityPalette(
        originalText,
        imitationText,
        dialogue15Overlaps
    );

    const cleanOrigLen = originalText.replace(/\s+/g, '').length;
    const cleanImitLen = imitationText.replace(/\s+/g, '').length;
    const characterCheckComplete =
        originalSucceededChunks === origChunks.length &&
        imitationSucceededChunks === imitChunks.length;
    const typoCheckComplete =
        imitationSucceededChunks === imitChunks.length &&
        !failedTaskDetails.some(d => d.kind === 'imitation_chunk');
    const allChunksOk =
        characterCheckComplete &&
        typoCheckComplete &&
        similarityChecked &&
        failedTaskDetails.length === 0;

    const failedTaskLabels = failedTaskDetails.map(d => `${d.label}未完成`);

    const coverage: CoverageStatus = {
        originalTotalChunks: origChunks.length,
        originalSucceededChunks,
        imitationTotalChunks: imitChunks.length,
        imitationSucceededChunks,
        characterCheckComplete,
        typoCheckComplete,
        similarityChecked,
        isComplete: allChunksOk,
        failedTasks: failedTaskLabels,
        failedTaskDetails,
        warningMessage: !allChunksOk ? '审稿未完成，部分内容需要重试' : undefined
    };

    // 更新缓存供后续局部增量复检或失败分段单独重试使用
    nextParagraphCache.set('__FULL__', {
        entities: imitationEntities,
        typos: typoIssues,
        manualItems: manualReviewItems
    });

    const durationMs = Math.round(performance.now() - startTime);

    const draftReport: ComprehensiveAuditReport = {
        timestamp: Date.now(),
        durationMs,
        modelRequested: model,
        modelUsed: actualModelUsed,
        isIncremental: shouldRunIncremental,
        recheckedParagraphCount: shouldRunIncremental ? dirtyLineIndices.length : undefined,
        overallSimilarity: 0,
        originalWordCount: cleanOrigLen,
        imitationWordCount: cleanImitLen,
        originalEntities,
        imitationEntities,
        characterConflicts: confirmedConflicts,
        typoIssues: typoIssues.sort((a, b) => a.index - b.index),
        similarityAlerts: mergedSimilarityAlerts,
        manualReviewItems,
        sentenceSimilarities,
        colorStats: { dangerCount: 0, warningCount: 0, cautionCount: 0, safeCount: 0 },
        coverage,
        verdict: 'warning',
        verdictMessage: ''
    };

    const report = recalculateAuditReport(draftReport);

    const nextCache: AuditCacheState = {
        originalText,
        imitationText,
        modelUsed: model,
        originalEntities,
        originalChunkCharacters,
        imitationChunkResults,
        imitationParagraphResults: nextParagraphCache
    };

    return { report, nextCache };
}

// --- 失败分段单独重试（保留全部已成功结果及人工核对记录，严禁重审已成功段落） ---
export interface RetryFailedAuditParams {
    originalText: string;
    imitationText: string;
    model: string;
    currentReport: AuditReportResult;
    previousCache: AuditCacheState | null;
    excludedCharacters: Set<string>;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
}

export async function retryFailedAuditParts(params: RetryFailedAuditParams): Promise<{
    report: AuditReportResult;
    nextCache: AuditCacheState;
}> {
    const {
        originalText,
        imitationText,
        model,
        currentReport,
        previousCache,
        excludedCharacters,
        signal,
        onProgress
    } = params;

    const failedList = currentReport.coverage.failedTaskDetails || [];
    if (failedList.length === 0) {
        return {
            report: currentReport,
            nextCache: previousCache || {
                originalText,
                imitationText,
                modelUsed: model,
                originalEntities: currentReport.originalEntities,
                imitationParagraphResults: new Map()
            }
        };
    }

    const retryStart = performance.now();
    const origChunks = splitIntoParagraphChunks(originalText, 8500);
    const imitChunks = splitIntoParagraphChunks(imitationText, 8500);

    let nextOrigEntities = [...currentReport.originalEntities];
    let nextImitEntities = [...currentReport.imitationEntities];
    const nextTypos = [...currentReport.typoIssues];
    const nextManualItems = [...currentReport.manualReviewItems];
    const nextSimAlerts = [...currentReport.similarityAlerts];

    let originalSucceededChunks = currentReport.coverage.originalSucceededChunks;
    let imitationSucceededChunks = currentReport.coverage.imitationSucceededChunks;
    let similarityChecked = currentReport.coverage.similarityChecked;
    let actualModelUsed = model;

    const remainingFailed: FailedAuditTask[] = [];
    const origHints = nextOrigEntities.map(e => e.canonical);
    const imitHints = nextImitEntities.map(e => e.canonical);

    const origTempMap = new Map<string, { canonical: string; mentions: Set<string>; role?: string; evidence: Set<string>; firstIndex: number }>();
    const origUncertainTemp: Array<{ name: string; mentions: string[]; role?: string; evidence: string; reason: string; index: number }> = [];
    const imitTempMap = new Map<string, { canonical: string; mentions: Set<string>; role?: string; evidence: Set<string>; firstIndex: number }>();
    const imitUncertainTemp: Array<{ name: string; mentions: string[]; role?: string; evidence: string; reason: string; index: number }> = [];

    const origChunkCharMap = new Map<number, any[]>(previousCache?.originalChunkCharacters || []);
    const imitChunkResMap = new Map<number, { characters: any[]; issues: any[] }>(previousCache?.imitationChunkResults || []);

    onProgress?.(`正在仅重试 ${failedList.length} 项未完成内容（已保留其余已完成结果与人工核对记录）...`);

    const taskResults = await Promise.allSettled(
        failedList.map(async (task) => {
            if (task.kind === 'original_chunk') {
                const idx = task.chunkIndex ?? 0;
                const chunk = origChunks[idx];
                if (!chunk) return { task, ok: true as const };
                const res = await withSingleAutoRetry(
                    () => analyzeOriginalChunkWithAI(chunk.text, idx, origChunks.length, model, origHints, signal),
                    task.label,
                    signal,
                    onProgress
                );
                return { task, ok: true as const, kind: 'original_chunk' as const, idx, chunk, res };
            }
            if (task.kind === 'imitation_chunk') {
                const idx = task.chunkIndex ?? 0;
                const chunk = imitChunks[idx];
                if (!chunk) return { task, ok: true as const };
                const res = await withSingleAutoRetry(
                    () => analyzeImitationChunkWithAI(chunk.text, idx, imitChunks.length, model, imitHints, signal),
                    task.label,
                    signal,
                    onProgress
                );
                return { task, ok: true as const, kind: 'imitation_chunk' as const, idx, chunk, res };
            }
            const simRes = await withSingleAutoRetry(
                () => analyzeCrossSimilarityWithAI(originalText, imitationText, model, signal),
                task.label,
                signal,
                onProgress
            );
            return { task, ok: true as const, kind: 'cross_similarity' as const, simRes };
        })
    );

    if (signal?.aborted) {
        throw new Error('审稿任务已被用户取消');
    }

    for (let tIdx = 0; tIdx < taskResults.length; tIdx++) {
        const settled = taskResults[tIdx];
        const origTask = failedList[tIdx];

        if (settled.status === 'rejected') {
            const err = settled.reason instanceof Error ? settled.reason : new Error(String(settled.reason));
            if (err.message.includes('取消')) throw err;
            console.error(`[局部重试仍失败] ${origTask.label}:`, err);
            remainingFailed.push({ ...origTask, errorMessage: err.message });
            continue;
        }

        const val = settled.value;
        if (val.kind === 'original_chunk') {
            actualModelUsed = val.res.actualModel;
            originalSucceededChunks = Math.min(origChunks.length, originalSucceededChunks + 1);
            origChunkCharMap.set(val.idx, val.res.characters);
            verifyAndRegisterCharacters(
                originalText,
                val.chunk.startOffset,
                val.res.characters,
                excludedCharacters,
                origTempMap,
                origUncertainTemp
            );
        } else if (val.kind === 'imitation_chunk') {
            actualModelUsed = val.res.actualModel;
            imitationSucceededChunks = Math.min(imitChunks.length, imitationSucceededChunks + 1);
            imitChunkResMap.set(val.idx, { characters: val.res.characters, issues: val.res.issues });
            verifyAndRegisterCharacters(
                imitationText,
                val.chunk.startOffset,
                val.res.characters,
                excludedCharacters,
                imitTempMap,
                imitUncertainTemp
            );

            // 吸收仿写 issues（不覆盖已存在的错别字与已有人工核对状态）
            for (const item of val.res.issues) {
                if (!item || typeof item !== 'object') continue;
                const wrongText = typeof item.wrongText === 'string' ? item.wrongText.trim() : '';
                const correctText = typeof item.correctText === 'string' ? item.correctText.trim() : '';
                const sentence = typeof item.sentence === 'string' ? item.sentence.trim() : '';
                const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
                if (!wrongText) continue;

                const idx = locateVerbatimSpan(imitationText, wrongText, sentence, val.chunk.startOffset);
                if (idx === -1) continue;

                const loc = getLocationInfo(imitationText, idx);
                const verifiedSentence = sentence && imitationText.includes(sentence)
                    ? sentence
                    : extractSnippetNear(imitationText, wrongText, idx);
                const cat: TypoAuditItem['category'] = VALID_TYPO_CATS.has(item.type) ? item.type : 'typo';

                if (item.confidence === 'uncertain') {
                    if (!nextManualItems.some(m => m.imitationIndex === idx && m.wrongText === wrongText)) {
                        nextManualItems.push({
                            id: `manual-issue-retry-${idx}-${wrongText}`,
                            issueType: cat === 'consistency' ? 'consistency' : 'typo',
                            aiJudgment: `AI不确定：疑似${cat === 'consistency' ? '人物前后不一致' : '错别字或语句欠妥'}`,
                            originalTextSnippet: '—（仅涉及仿写正文）',
                            imitationTextSnippet: verifiedSentence,
                            imitationIndex: idx,
                            locationLabel: loc.label,
                            reason: reason || 'AI 无法确认属于笔误还是刻意小说表达，请人工核对',
                            suggestedFix: correctText ? `建议改为：${correctText}` : '请结合上下文确认是否需要修改',
                            wrongText,
                            correctText: correctText && correctText !== wrongText ? correctText : undefined,
                            status: 'pending'
                        });
                    }
                } else if (correctText && correctText !== wrongText) {
                    const dup = nextTypos.some(t => !(idx + wrongText.length <= t.index || idx >= t.index + t.wrongText.length));
                    if (!dup) {
                        nextTypos.push({
                            id: `typo-retry-${idx}-${wrongText}`,
                            index: idx,
                            wrongText,
                            correctText,
                            sentence: verifiedSentence,
                            explanation: reason || '上下文校对发现用词或人物前后不一致错误',
                            locationLabel: loc.label,
                            category: cat
                        });
                    }
                }
            }
        } else if (val.kind === 'cross_similarity') {
            similarityChecked = true;
            for (const sItem of val.simRes.confirmedSimilarities) {
                const overlapsExisting = nextSimAlerts.some(
                    ex => !(sItem.imitationIndex + sItem.imitationSnippet.length <= ex.imitationIndex || sItem.imitationIndex >= ex.imitationIndex + ex.imitationSnippet.length)
                );
                if (!overlapsExisting) nextSimAlerts.push(sItem);
            }
            for (const mItem of val.simRes.uncertainSimilarityManualItems) {
                if (!nextManualItems.some(m => m.imitationIndex === mItem.imitationIndex && m.imitationTextSnippet === mItem.imitationTextSnippet)) {
                    nextManualItems.push(mItem);
                }
            }
        }
    }

    // 归并新提取的已确认人物（绝不重复生成已有角色，保留人工已修改的实体）
    origTempMap.forEach((val) => {
        nextOrigEntities = mergeCharacterIntoEntities(nextOrigEntities, originalText, {
            canonical: val.canonical,
            mentions: Array.from(val.mentions),
            role: val.role,
            evidence: Array.from(val.evidence)[0],
            firstIndex: val.firstIndex,
            idPrefix: 'orig-retry'
        });
    });

    imitTempMap.forEach((val) => {
        nextImitEntities = mergeCharacterIntoEntities(nextImitEntities, imitationText, {
            canonical: val.canonical,
            mentions: Array.from(val.mentions),
            role: val.role,
            evidence: Array.from(val.evidence)[0],
            firstIndex: val.firstIndex,
            idPrefix: 'imit-retry'
        });
    });

    const resolvedNames = new Set(
        nextManualItems
            .filter(m => m.status !== 'pending' && m.issueType === 'character' && m.candidateName)
            .map(m => m.candidateName!)
    );

    const origConfirmedSet = new Set(nextOrigEntities.flatMap(e => e.mentions));
    origUncertainTemp.forEach((u, idx) => {
        if (u.mentions.some(m => origConfirmedSet.has(m) || excludedCharacters.has(m) || resolvedNames.has(m))) return;
        if (nextManualItems.some(m => m.issueType === 'character' && m.candidateTarget === 'original' && m.candidateName === u.name)) return;
        const loc = getLocationInfo(originalText, u.index);
        nextManualItems.push({
            id: `manual-orig-char-retry-${idx}-${u.name}`,
            issueType: 'character',
            aiJudgment: `AI不确定：原稿中「${u.name}」是否属于独立人物`,
            originalTextSnippet: u.evidence || u.name,
            imitationTextSnippet: '—（原稿只读 · 人物待确认）',
            originalIndex: u.index,
            locationLabel: `原稿 ${loc.label}`,
            reason: u.reason,
            suggestedFix: `若确为人物或已有角色别名，点「确认为人物」自动归并；若非人物请点「不是人物」`,
            candidateName: u.name,
            candidateMentions: u.mentions,
            candidateRole: u.role,
            candidateTarget: 'original',
            status: 'pending'
        });
    });

    const imitConfirmedSet = new Set(nextImitEntities.flatMap(e => e.mentions));
    imitUncertainTemp.forEach((u, idx) => {
        if (u.mentions.some(m => imitConfirmedSet.has(m) || excludedCharacters.has(m) || resolvedNames.has(m))) return;
        if (nextManualItems.some(m => m.issueType === 'character' && m.candidateTarget === 'imitation' && m.candidateName === u.name)) return;
        const loc = getLocationInfo(imitationText, u.index);
        nextManualItems.push({
            id: `manual-imit-char-retry-${idx}-${u.name}`,
            issueType: 'character',
            aiJudgment: `AI不确定：仿写中「${u.name}」是否属于独立人物`,
            originalTextSnippet: '—（仿写人物待确认）',
            imitationTextSnippet: u.evidence || u.name,
            imitationIndex: u.index,
            locationLabel: `仿写 ${loc.label}`,
            reason: u.reason,
            suggestedFix: `若确为人物或已有角色别名，点「确认为人物」自动归并；非人物请点「不是人物」`,
            candidateName: u.name,
            candidateMentions: u.mentions,
            candidateRole: u.role,
            candidateTarget: 'imitation',
            status: 'pending'
        });
    });

    // 重新计算角色冲突（保留已忽略/已处理的待定冲突状态）
    const { confirmedConflicts, uncertainConflictManualItems } = compareCharacterConflicts(
        originalText,
        imitationText,
        nextOrigEntities,
        nextImitEntities
    );
    uncertainConflictManualItems.forEach((cItem) => {
        if (!nextManualItems.some(m => m.issueType === 'conflict' && m.wrongText === cItem.wrongText && m.originalTextSnippet === cItem.originalTextSnippet)) {
            nextManualItems.push(cItem);
        }
    });

    const retryDurationMs = Math.round(performance.now() - retryStart);
    const characterCheckComplete =
        originalSucceededChunks === origChunks.length &&
        imitationSucceededChunks === imitChunks.length &&
        !remainingFailed.some(f => f.kind === 'original_chunk' || f.kind === 'imitation_chunk');
    const typoCheckComplete =
        imitationSucceededChunks === imitChunks.length &&
        !remainingFailed.some(f => f.kind === 'imitation_chunk');
    const allChunksOk =
        characterCheckComplete &&
        typoCheckComplete &&
        similarityChecked &&
        remainingFailed.length === 0;

    const coverage: CoverageStatus = {
        originalTotalChunks: origChunks.length,
        originalSucceededChunks,
        imitationTotalChunks: imitChunks.length,
        imitationSucceededChunks,
        characterCheckComplete,
        typoCheckComplete,
        similarityChecked,
        isComplete: allChunksOk,
        failedTasks: remainingFailed.map(f => `${f.label}未完成`),
        failedTaskDetails: remainingFailed,
        warningMessage: !allChunksOk ? '审稿未完成，部分内容需要重试' : undefined
    };

    const nextParagraphCache = new Map(previousCache?.imitationParagraphResults || []);
    nextParagraphCache.set('__FULL__', {
        entities: nextImitEntities,
        typos: nextTypos,
        manualItems: nextManualItems
    });

    const report = recalculateAuditReport({
        ...currentReport,
        timestamp: Date.now(),
        durationMs: currentReport.durationMs + retryDurationMs,
        modelRequested: model,
        modelUsed: actualModelUsed,
        originalEntities: nextOrigEntities.sort((a, b) => b.count - a.count),
        imitationEntities: nextImitEntities.sort((a, b) => b.count - a.count),
        characterConflicts: confirmedConflicts,
        typoIssues: nextTypos.sort((a, b) => a.index - b.index),
        similarityAlerts: nextSimAlerts,
        manualReviewItems: nextManualItems,
        coverage
    });

    const nextCache: AuditCacheState = {
        originalText,
        imitationText,
        modelUsed: model,
        originalEntities: report.originalEntities,
        originalChunkCharacters: origChunkCharMap,
        imitationChunkResults: imitChunkResMap,
        imitationParagraphResults: nextParagraphCache
    };

    return { report, nextCache };
}

// --- 人物实体归并辅助（确认为人物/修改归并时去重合并别名，严禁重复生成角色） ---
export function mergeCharacterIntoEntities(
    entities: ReviewedCharacterEntity[],
    fullText: string,
    opts: {
        canonical: string;
        mentions?: string[];
        role?: string;
        evidence?: string;
        firstIndex?: number;
        idPrefix?: string;
        mergeTargetName?: string;
    }
): ReviewedCharacterEntity[] {
    const cleanCanonical = opts.canonical.trim();
    if (!cleanCanonical) return entities;

    const rawCandidates = [cleanCanonical, ...(opts.mentions || [])]
        .map(m => m.trim())
        .filter(Boolean);
    const validCandidates = Array.from(new Set(rawCandidates.filter(m => fullText.includes(m))));
    const finalMentions = validCandidates.length > 0 ? validCandidates : [cleanCanonical];

    const mergeKey = opts.mergeTargetName?.trim();
    const matchIndex = entities.findIndex((ent) => {
        if (mergeKey && (ent.canonical === mergeKey || ent.mentions.includes(mergeKey))) return true;
        if (ent.canonical === cleanCanonical || ent.mentions.includes(cleanCanonical)) return true;
        return ent.mentions.some(m => finalMentions.includes(m));
    });

    if (matchIndex !== -1) {
        return entities.map((ent, idx) => {
            if (idx !== matchIndex) return ent;
            const mergedMentions = Array.from(new Set([...ent.mentions, ...finalMentions]));
            const mergedEvidence = opts.evidence
                ? Array.from(new Set([...ent.evidence, opts.evidence])).slice(0, 3)
                : ent.evidence;
            const nextCount = mergedMentions.reduce((sum, m) => sum + countExactOccurrences(fullText, m), 0);
            return {
                ...ent,
                mentions: mergedMentions,
                role: ent.role || opts.role,
                evidence: mergedEvidence,
                count: nextCount > 0 ? nextCount : ent.count,
                firstIndex: opts.firstIndex !== undefined && opts.firstIndex >= 0
                    ? Math.min(ent.firstIndex, opts.firstIndex)
                    : ent.firstIndex
            };
        });
    }

    const count = finalMentions.reduce((sum, m) => sum + countExactOccurrences(fullText, m), 0);
    const computedIdx = opts.firstIndex !== undefined && opts.firstIndex >= 0
        ? opts.firstIndex
        : Math.max(0, fullText.indexOf(finalMentions[0]));

    return [
        ...entities,
        {
            id: `${opts.idPrefix || 'manual-char'}-${Date.now()}-${cleanCanonical}`,
            canonical: cleanCanonical,
            mentions: finalMentions,
            role: opts.role || '人工确认人物',
            evidence: opts.evidence ? [opts.evidence] : [cleanCanonical],
            count: count > 0 ? count : 1,
            confidence: 'confirmed',
            firstIndex: computedIdx
        }
    ];
}

export function recalculateAuditReport(report: ComprehensiveAuditReport): ComprehensiveAuditReport {
    let dangerCount = 0;
    let warningCount = 0;
    let cautionCount = 0;
    let safeCount = 0;
    let totalWeightedSim = 0;
    let totalAnalyzedChars = 0;

    report.sentenceSimilarities.forEach((s) => {
        const cLen = s.sentence.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').length;
        if (s.colorLevel === 'danger') dangerCount++;
        else if (s.colorLevel === 'warning') warningCount++;
        else if (s.colorLevel === 'caution') cautionCount++;
        else safeCount++;

        const weight = Math.max(1, cLen);
        totalWeightedSim += s.similarity * weight;
        totalAnalyzedChars += weight;
    });

    const overallSimilarity = totalAnalyzedChars > 0
        ? Math.round((totalWeightedSim / totalAnalyzedChars) * 100)
        : 0;

    const dialogue15Count = report.similarityAlerts.filter(a => a.kind === 'dialogue_15').length;
    const pendingManualCount = report.manualReviewItems.filter(m => m.status === 'pending').length;

    let verdict: ComprehensiveAuditReport['verdict'] = 'pass';
    let verdictMessage = '';

    if (overallSimilarity >= 55 || (overallSimilarity >= 35 && dangerCount >= 3) || dialogue15Count >= 2) {
        verdict = 'danger';
        verdictMessage = report.coverage.isComplete
            ? `检测到连续15字以上高度重合或高相似长句，请重点改写标红区域`
            : `审稿未完成，部分内容需要重试`;
    } else if (!report.coverage.isComplete) {
        verdict = 'warning';
        verdictMessage = '审稿未完成，部分内容需要重试';
    } else if (
        report.characterConflicts.length > 0 ||
        report.typoIssues.length > 0 ||
        report.similarityAlerts.length > 0 ||
        dangerCount >= 1 ||
        warningCount >= 3 ||
        pendingManualCount > 0
    ) {
        verdict = 'warning';
        verdictMessage = '';
    } else {
        verdict = 'pass';
        verdictMessage = '';
    }

    return {
        ...report,
        overallSimilarity,
        colorStats: { dangerCount, warningCount, cautionCount, safeCount },
        verdict,
        verdictMessage
    };
}

export type AuditReportResult = ComprehensiveAuditReport;
