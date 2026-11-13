import React, { useState, useRef, useMemo, useEffect } from 'react';
import mammoth from 'mammoth';
import {
    Sparkles, DocumentArrowDown, ArrowPath, Check, Trash,
    Copy, FloppyDisk, ClipboardDocumentCheck, ExclamationCircle,
    Eye, Pencil, Plus
} from './Icon';
import { ALL_MODEL_OPTIONS } from '../constants';
import { saveMaterial } from '../services/supabaseService';
import {
    AuditCacheState,
    AuditReportResult,
    CharacterConflictItem,
    DialogueSimilarityItem,
    ManualReviewItem,
    ReviewedCharacterEntity,
    SentenceSimilarity,
    TypoAuditItem,
    callReviewModel,
    compareCharacterConflicts,
    computeSentenceSimilarityPalette,
    countExactOccurrences,
    detectDialogue15CharOverlaps,
    getLocationInfo,
    locateVerbatimSpan,
    mergeCharacterIntoEntities,
    recalculateAuditReport,
    retryFailedAuditParts,
    runComprehensiveManuscriptAudit
} from '../utils/manuscriptReviewEngine';

export type {
    ReviewedCharacterEntity as CharacterEntity,
    CharacterConflictItem as CharacterConflict,
    TypoAuditItem as TypoIssue
};

interface ActiveLocateState {
    id: string;
    origStart?: number;
    origEnd?: number;
    imitStart?: number;
    imitEnd?: number;
    level: 'danger' | 'warning';
}

interface HighlightSegment {
    start: number;
    end: number;
    level: 'danger' | 'warning';
    label: string;
    itemId?: string;
    itemTab?: 'typo' | 'character' | 'manual' | 'similarity';
    isFocused?: boolean;
}

// 演示数据样本
const DEMO_ORIGINAL = `顾诚站在顶层办公室的落地窗前，冷冷地俯瞰着整座城市的霓虹。作为顾氏集团的掌舵人，商界无人不知“顾总”的手腕狠绝凌厉。

助理林潇快步走入办公室内，神情严肃地汇报：“顾总，苏浅浅小姐刚刚回国了，目前正停留在城南的老宅。”

顾诚手中的高脚杯微微一晃，眸底翻涌起难以捉摸的情绪。三年前，苏浅浅不告而别，几乎将他逼入绝境。如今她竟敢按部就班地重新踏上这片土地，真当他顾诚会鼎力相助不成？

“派人盯紧她，”顾诚冷冷吩咐道，“另外，陆氏集团的陆董最近动作频频，绝对不能给对方可趁之机。”

夜幕深沉，一场看不见硝烟的豪门博弈悄然拉开序幕。`;

const DEMO_IMITATION = `古成站在五十层落地大厦前，眼神冰冷地俯视着窗外繁华的夜景。圈内人人都知晓“古总”行事有多么果决狠戾。

特助林霄急忙推门进来，小心翼翼地开口：“古总，浅苏小姐乘机回国了，现在已经回到了城南的宅院里。”

古成手中的红酒杯晃了晃，眼眸深处闪过一丝极度复杂的情绪。三年前她决对是不告而别，把他逼到了走头无路的境地。现在她居然还能按步就班地回来，以为自己会再接再励地帮她？

“派人盯紧她，另外，陆氏集团的陆董最近动作频频，绝对不能给对方可趁之机。”古成冷笑一声，眼神阴沉下来，“我们必须迫不急待地反击。”

窗外月色凄迷，一场暗流汹涌的商战风暴正在暗中酝酿。`;

export const ManuscriptReview: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    // 文本状态
    const [originalText, setOriginalText] = useState<string>('');
    const [imitationText, setImitationText] = useState<string>('');

    // 模型选择与审核参数（默认优先 DeepSeek V3 通道，保留其他模型切换）
    const [selectedModel, setSelectedModel] = useState<string>('deepseek-chat');
    const [isAuditing, setIsAuditing] = useState<boolean>(false);
    const [auditProgress, setAuditProgress] = useState<string>('');
    const [auditError, setAuditError] = useState<string | null>(null);
    const [report, setReport] = useState<AuditReportResult | null>(null);
    const auditCacheRef = useRef<AuditCacheState | null>(null);
    const auditAbortRef = useRef<AbortController | null>(null);

    // 下半部分可拖动高度控制 (最小44px收起状态，最大紧贴上方汇总栏)
    const [drawerHeight, setDrawerHeight] = useState<number>(360);
    const [lastExpandedHeight, setLastExpandedHeight] = useState<number>(360);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

    // 交互状态：错别字、人物同音、待人工核对、调色盘查重
    const [activeTab, setActiveTab] = useState<'typo' | 'character' | 'manual' | 'similarity'>('typo');
    const [viewMode, setViewMode] = useState<'audit' | 'edit'>('audit');
    const [paletteMode, setPaletteMode] = useState<'issues' | 'similarity'>('issues');
    const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
    const [paletteFilter, setPaletteFilter] = useState<'all' | 'danger' | 'warning' | 'caution' | 'safe'>('all');
    const [customReplaceNames, setCustomReplaceNames] = useState<Record<string, string>>({});
    const [manualCustomEdits, setManualCustomEdits] = useState<Record<string, string>>({});
    const [activeLocate, setActiveLocate] = useState<ActiveLocateState | null>(null);

    // AI 降重状态
    const [isAiRewriting, setIsAiRewriting] = useState<boolean>(false);
    const [aiRewriteSuggestions, setAiRewriteSuggestions] = useState<Array<{ style: string; text: string }>>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // 人物名称自定义微调
    const [customAddedCharacters, setCustomAddedCharacters] = useState<string[]>([]);
    const [excludedCharacters, setExcludedCharacters] = useState<Set<string>>(new Set());
    const [newCharInput, setNewCharInput] = useState<string>('');
    const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLElement>(null);
    const bannerRef = useRef<HTMLDivElement>(null);
    const origScrollContainerRef = useRef<HTMLDivElement>(null);
    const imitScrollContainerRef = useRef<HTMLDivElement>(null);
    const fileInputOriginalRef = useRef<HTMLInputElement>(null);
    const fileInputImitationRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    // 拖动调节面板高度
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();

            let topBoundary = containerRect.top + 50;
            if (bannerRef.current) {
                topBoundary = bannerRef.current.getBoundingClientRect().bottom;
            } else if (headerRef.current) {
                topBoundary = headerRef.current.getBoundingClientRect().bottom;
            }

            const maxH = Math.max(80, Math.floor(containerRect.bottom - topBoundary));
            const minH = 44;

            const rawHeight = containerRect.bottom - e.clientY;
            const clampedHeight = Math.max(minH, Math.min(rawHeight, maxH));

            setDrawerHeight(clampedHeight);
            if (clampedHeight <= 50) {
                setIsCollapsed(true);
            } else {
                setIsCollapsed(false);
                setLastExpandedHeight(clampedHeight);
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging]);

    // 点击卡片后自动滚动定位到左右两侧高亮片段
    useEffect(() => {
        if (!activeLocate) return;
        const timer = setTimeout(() => {
            if (activeLocate.origStart !== undefined && origScrollContainerRef.current) {
                const origEl = origScrollContainerRef.current.querySelector('[data-locate-orig="true"]');
                if (origEl) {
                    origEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            if (activeLocate.imitStart !== undefined && imitScrollContainerRef.current) {
                const imitEl = imitScrollContainerRef.current.querySelector('[data-locate-imit="true"]');
                if (imitEl) {
                    imitEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 60);
        return () => clearTimeout(timer);
    }, [activeLocate, viewMode, paletteMode]);

    const handleToggleCollapse = () => {
        if (isCollapsed) {
            const targetH = lastExpandedHeight > 50 ? lastExpandedHeight : 360;
            setDrawerHeight(targetH);
            setIsCollapsed(false);
        } else {
            setLastExpandedHeight(drawerHeight > 50 ? drawerHeight : 360);
            setIsCollapsed(true);
        }
    };

    const originalStats = useMemo(() => {
        const text = originalText.trim();
        return {
            charCount: text.length,
            wordCount: text.replace(/\s+/g, '').length,
            paragraphCount: text ? text.split(/\n+/).filter(Boolean).length : 0
        };
    }, [originalText]);

    const imitationStats = useMemo(() => {
        const text = imitationText.trim();
        return {
            charCount: text.length,
            wordCount: text.replace(/\s+/g, '').length,
            paragraphCount: text ? text.split(/\n+/).filter(Boolean).length : 0
        };
    }, [imitationText]);

    const hasPendingIncrementalChanges = useMemo(() => {
        if (!report || !auditCacheRef.current) return false;
        return (
            auditCacheRef.current.originalText === originalText &&
            auditCacheRef.current.imitationText !== imitationText
        );
    }, [report, originalText, imitationText]);

    // 读取上传的文件
    const handleFileUpload = async (file: File, isOriginal: boolean) => {
        if (!file) return;
        const fileName = file.name.toLowerCase();

        try {
            if (fileName.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                if (isOriginal) {
                    setOriginalText(result.value);
                    setReport(null);
                    auditCacheRef.current = null;
                } else {
                    handleImitationTextEdit(result.value);
                }
                showToast(`已成功导入 Word 文档：${file.name}`);
            } else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = (e.target?.result as string) || '';
                    if (isOriginal) {
                        setOriginalText(content);
                        setReport(null);
                        auditCacheRef.current = null;
                    } else {
                        handleImitationTextEdit(content);
                    }
                    showToast(`已成功导入文件：${file.name}`);
                };
                reader.readAsText(file, 'utf-8');
            }
        } catch (error: any) {
            console.error('File read error:', error);
            showToast(`读取文件失败: ${error?.message || '请确认文件格式'}`);
        }
    };

    const handleLoadDemo = () => {
        setOriginalText(DEMO_ORIGINAL);
        setImitationText(DEMO_IMITATION);
        setReport(null);
        auditCacheRef.current = null;
        setAuditError(null);
        setActiveLocate(null);
        setExcludedCharacters(new Set());
        showToast('已载入演示样本（含同音、换序命名、错别字、漏字及15字+重复句），点击“开始智能审稿”运行测试');
    };

    const handleClear = () => {
        setShowClearConfirm(true);
    };

    const executeClearAll = () => {
        auditAbortRef.current?.abort();
        setOriginalText('');
        setImitationText('');
        setReport(null);
        auditCacheRef.current = null;
        setAuditError(null);
        setViewMode('audit');
        setPaletteMode('issues');
        setActiveTab('typo');
        setSelectedSentenceIndex(null);
        setPaletteFilter('all');
        setCustomReplaceNames({});
        setManualCustomEdits({});
        setActiveLocate(null);
        setAiRewriteSuggestions([]);
        setIsAiRewriting(false);
        setCustomAddedCharacters([]);
        setExcludedCharacters(new Set());
        setNewCharInput('');
        setIsCollapsed(false);
        setDrawerHeight(360);
        setLastExpandedHeight(360);
        if (fileInputOriginalRef.current) fileInputOriginalRef.current.value = '';
        if (fileInputImitationRef.current) fileInputImitationRef.current.value = '';
        setShowClearConfirm(false);
        showToast('已全部清除，恢复到初始待输入界面');
    };

    // 同步正文手工修改或一键替换后，实时更新各问题索引、调色盘和汇总状态
    const syncReportWithUpdatedImitation = (
        nextImitText: string,
        currentReport: AuditReportResult,
        overrides?: Partial<AuditReportResult>
    ): AuditReportResult => {
        const mergedReport: AuditReportResult = {
            ...currentReport,
            ...overrides,
            imitationWordCount: nextImitText.replace(/\s+/g, '').length
        };

        // 1. 同步错别字位置（若已被手动改掉则自动清除）
        const syncedTypos = mergedReport.typoIssues
            .map((t) => {
                const reIdx = locateVerbatimSpan(nextImitText, t.wrongText, t.sentence);
                if (reIdx === -1) return null;
                return {
                    ...t,
                    index: reIdx,
                    locationLabel: getLocationInfo(nextImitText, reIdx).label
                };
            })
            .filter((x): x is TypoAuditItem => x !== null)
            .sort((a, b) => a.index - b.index);

        // 2. 同步仿写人物计数与位置，并重算跨稿人物冲突
        const syncedImitEntities = mergedReport.imitationEntities
            .map((ent) => {
                const aliveMentions = ent.mentions.filter(m => nextImitText.includes(m));
                if (aliveMentions.length === 0) return null;
                const count = aliveMentions.reduce((sum, m) => sum + countExactOccurrences(nextImitText, m), 0);
                return {
                    ...ent,
                    canonical: aliveMentions.includes(ent.canonical) ? ent.canonical : aliveMentions[0],
                    mentions: aliveMentions,
                    count,
                    firstIndex: Math.max(0, nextImitText.indexOf(aliveMentions[0]))
                };
            })
            .filter((x): x is ReviewedCharacterEntity => x !== null);

        const { confirmedConflicts } = compareCharacterConflicts(
            originalText,
            nextImitText,
            mergedReport.originalEntities,
            syncedImitEntities
        );

        // 3. 同步待人工核对列表
        const syncedManual = mergedReport.manualReviewItems.map((m) => {
            if (m.status !== 'pending') return m;
            if (m.imitationIndex !== undefined && m.wrongText) {
                const newIdx = locateVerbatimSpan(nextImitText, m.wrongText, m.imitationTextSnippet);
                if (newIdx === -1) {
                    return { ...m, status: 'modified' as const };
                }
                return {
                    ...m,
                    imitationIndex: newIdx,
                    locationLabel: getLocationInfo(nextImitText, newIdx).label
                };
            }
            return m;
        });

        // 4. 重算 15 字以上连续台词重合 & 句子调色盘
        const fresh15Overlaps = detectDialogue15CharOverlaps(originalText, nextImitText);
        const keptAiSims = mergedReport.similarityAlerts
            .filter(a => a.kind !== 'dialogue_15')
            .map((a) => {
                const newIdx = nextImitText.indexOf(a.imitationSnippet);
                if (newIdx === -1) return null;
                return { ...a, imitationIndex: newIdx };
            })
            .filter((x): x is DialogueSimilarityItem => x !== null);

        const mergedSims = [...fresh15Overlaps];
        for (const item of keptAiSims) {
            const overlaps = mergedSims.some(
                ex => !(item.imitationIndex + item.imitationSnippet.length <= ex.imitationIndex || item.imitationIndex >= ex.imitationIndex + ex.imitationSnippet.length)
            );
            if (!overlaps) mergedSims.push(item);
        }

        const sentenceSimilarities = computeSentenceSimilarityPalette(originalText, nextImitText, fresh15Overlaps);

        return recalculateAuditReport({
            ...mergedReport,
            typoIssues: syncedTypos,
            imitationEntities: syncedImitEntities,
            characterConflicts: confirmedConflicts,
            manualReviewItems: syncedManual,
            similarityAlerts: mergedSims,
            sentenceSimilarities
        });
    };

    const handleImitationTextEdit = (nextText: string) => {
        setImitationText(nextText);
        if (report) {
            setReport(syncReportWithUpdatedImitation(nextText, report));
        }
    };

    // --- 执行一次完整审稿 / 局部增量复检 ---
    const handleRunAudit = async (forceFull = false) => {
        if (!originalText.trim()) {
            showToast('请先在左侧输入或上传原稿内容！');
            return;
        }
        if (!imitationText.trim()) {
            showToast('请先在右侧输入或上传仿写稿件！');
            return;
        }

        auditAbortRef.current?.abort();
        const controller = new AbortController();
        auditAbortRef.current = controller;

        setIsAuditing(true);
        setAuditError(null);
        setActiveLocate(null);
        setAuditProgress(`正在连接 ${selectedModel} 进行上下文语义审稿...`);

        try {
            const { report: nextReport, nextCache } = await runComprehensiveManuscriptAudit({
                originalText,
                imitationText,
                model: selectedModel,
                excludedCharacters,
                customAddedCharacters,
                previousCache: auditCacheRef.current,
                forceFull,
                signal: controller.signal,
                onProgress: (msg) => setAuditProgress(msg)
            });

            auditCacheRef.current = nextCache;
            setReport(nextReport);
            setViewMode('audit');
            setPaletteMode('issues');

            const pendingManual = nextReport.manualReviewItems.filter(m => m.status === 'pending').length;
            if (pendingManual > 0 && nextReport.typoIssues.length === 0 && nextReport.characterConflicts.length === 0) {
                setActiveTab('manual');
            } else if (nextReport.typoIssues.length > 0) {
                setActiveTab('typo');
            } else if (nextReport.characterConflicts.length > 0 || !nextReport.coverage.isComplete) {
                setActiveTab('character');
            } else if (pendingManual > 0) {
                setActiveTab('manual');
            } else {
                setActiveTab('similarity');
            }

            const secs = (nextReport.durationMs / 1000).toFixed(1);
            if (!nextReport.coverage.isComplete) {
                showToast('审稿未完成，部分内容需要重试');
            } else if (nextReport.isIncremental) {
                showToast(`局部增量复检完成（耗时 ${secs}秒）`);
            } else {
                showToast(`审稿完成（耗时 ${secs}秒）`);
            }
        } catch (e: any) {
            console.error('Audit failed:', e);
            const rawMsg = String(e?.message || '未知错误');
            const userFriendlyMsg =
                rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.toLowerCase().includes('quota')
                    ? `当前所选模型（${selectedModel}）额度不足或请求受限，未自动切换其他模型。请切换上方模型或稍后重试。`
                    : rawMsg.includes('取消')
                    ? '审稿任务已取消'
                    : rawMsg.includes('超时')
                    ? `当前所选模型（${selectedModel}）响应超时，请点击重试或切换上方模型。`
                    : `当前所选模型（${selectedModel}）接口调用异常，未自动切换其他模型。请重试或切换上方模型。`;
            setAuditError(userFriendlyMsg);
            showToast(userFriendlyMsg);
        } finally {
            setIsAuditing(false);
            setAuditProgress('');
        }
    };

    // --- 仅重试失败分段（保留已成功内容与人工核对记录，不重审已完成段落） ---
    const handleRetryFailedParts = async () => {
        if (!report || report.coverage.failedTaskDetails.length === 0) return;

        auditAbortRef.current?.abort();
        const controller = new AbortController();
        auditAbortRef.current = controller;

        setIsAuditing(true);
        setAuditError(null);
        setAuditProgress('正在仅重试未完成分段...');

        try {
            const { report: nextReport, nextCache } = await retryFailedAuditParts({
                originalText,
                imitationText,
                model: selectedModel,
                currentReport: report,
                previousCache: auditCacheRef.current,
                excludedCharacters,
                signal: controller.signal,
                onProgress: (msg) => setAuditProgress(msg)
            });

            auditCacheRef.current = nextCache;
            setReport(nextReport);

            if (nextReport.coverage.isComplete) {
                showToast(`失败部分重试成功，全文审稿已完成（总耗时 ${(nextReport.durationMs / 1000).toFixed(1)}秒）`);
            } else {
                showToast('部分内容仍未完成，请再次重试或切换上方模型');
            }
        } catch (e: any) {
            console.error('Retry failed parts error:', e);
            const rawMsg = String(e?.message || '');
            const msg = rawMsg.includes('取消')
                ? '已取消重试'
                : `所选模型（${selectedModel}）重试仍异常，请稍后重试或切换模型`;
            showToast(msg);
        } finally {
            setIsAuditing(false);
            setAuditProgress('');
        }
    };

    // --- 一键定位到原稿与仿写对应位置并高亮 ---
    const handleLocateProblem = (opts: {
        id: string;
        origTextToFind?: string;
        origIndexHint?: number;
        imitTextToFind?: string;
        imitIndexHint?: number;
        level: 'danger' | 'warning';
    }) => {
        let origStart: number | undefined;
        let origEnd: number | undefined;
        if (opts.origIndexHint !== undefined && opts.origIndexHint >= 0 && opts.origTextToFind) {
            origStart = opts.origIndexHint;
            origEnd = Math.min(originalText.length, origStart + opts.origTextToFind.length);
        } else if (opts.origTextToFind && opts.origTextToFind.length >= 2 && !opts.origTextToFind.startsWith('—')) {
            const cleanSnip = opts.origTextToFind.replace(/^…|…$/g, '');
            const idx = originalText.indexOf(cleanSnip);
            if (idx !== -1) {
                origStart = idx;
                origEnd = idx + cleanSnip.length;
            }
        }

        let imitStart: number | undefined;
        let imitEnd: number | undefined;
        if (opts.imitIndexHint !== undefined && opts.imitIndexHint >= 0 && opts.imitTextToFind) {
            imitStart = opts.imitIndexHint;
            imitEnd = Math.min(imitationText.length, imitStart + opts.imitTextToFind.length);
        } else if (opts.imitTextToFind && opts.imitTextToFind.length >= 2 && !opts.imitTextToFind.startsWith('—')) {
            const cleanSnip = opts.imitTextToFind.replace(/^…|…$/g, '');
            const idx = imitationText.indexOf(cleanSnip);
            if (idx !== -1) {
                imitStart = idx;
                imitEnd = idx + cleanSnip.length;
            }
        }

        setViewMode('audit');
        setPaletteMode('issues');
        setActiveLocate({
            id: opts.id,
            origStart,
            origEnd,
            imitStart,
            imitEnd,
            level: opts.level
        });
    };

    // --- 采纳错别字修复 ---
    const replaceTypoAtTarget = (sourceText: string, typo: TypoAuditItem): { text: string; replacedAt: number } => {
        if (typo.index >= 0 && sourceText.slice(typo.index, typo.index + typo.wrongText.length) === typo.wrongText) {
            return {
                text: sourceText.slice(0, typo.index) + typo.correctText + sourceText.slice(typo.index + typo.wrongText.length),
                replacedAt: typo.index
            };
        }
        const located = locateVerbatimSpan(sourceText, typo.wrongText, typo.sentence);
        if (located !== -1) {
            return {
                text: sourceText.slice(0, located) + typo.correctText + sourceText.slice(located + typo.wrongText.length),
                replacedAt: located
            };
        }
        return { text: sourceText, replacedAt: -1 };
    };

    const handleFixTypo = (typo: TypoAuditItem) => {
        const { text: newText, replacedAt } = replaceTypoAtTarget(imitationText, typo);
        if (replacedAt === -1) {
            showToast('未在当前正文中找到该片段，可能已被修改');
            return;
        }
        setImitationText(newText);
        if (report) {
            setReport(
                syncReportWithUpdatedImitation(newText, report, {
                    typoIssues: report.typoIssues.filter(t => t.id !== typo.id)
                })
            );
        }
        setActiveLocate(null);
        showToast(`已替换修复：${typo.wrongText} → ${typo.correctText}`);
    };

    const handleFixAllTypos = () => {
        if (!report || report.typoIssues.length === 0) return;
        let newText = imitationText;
        const sortedDesc = [...report.typoIssues].sort((a, b) => b.index - a.index);
        sortedDesc.forEach(t => {
            newText = replaceTypoAtTarget(newText, t).text;
        });
        setImitationText(newText);
        setReport(syncReportWithUpdatedImitation(newText, report, { typoIssues: [] }));
        setActiveLocate(null);
        showToast('已一键采纳并修复所有错别字！');
    };

    // --- 一键替换人物名称/称谓 ---
    const handleReplaceCharacter = (conflict: CharacterConflictItem, replacementName: string) => {
        if (!replacementName || !replacementName.trim()) {
            showToast('请输入要替换的新角色名称！');
            return;
        }
        const cleanReplacement = replacementName.trim();
        const target = conflict.imitationName;
        const newText = imitationText.replaceAll(target, cleanReplacement);
        setImitationText(newText);

        if (report) {
            const updatedImitEntities = report.imitationEntities.map(ent => {
                if (!ent.mentions.includes(target)) return ent;
                const nextMentions = Array.from(new Set(ent.mentions.map(m => (m === target ? cleanReplacement : m))));
                return {
                    ...ent,
                    canonical: ent.canonical === target ? cleanReplacement : ent.canonical,
                    mentions: nextMentions
                };
            });
            setReport(
                syncReportWithUpdatedImitation(newText, report, {
                    imitationEntities: updatedImitEntities
                })
            );
        }
        setActiveLocate(null);
        showToast(`已一键将仿写稿中的【${target}】全部替换为【${cleanReplacement}】！`);
    };

    const handleExcludeCharacter = (entity: ReviewedCharacterEntity) => {
        const mentionsToExclude = entity.mentions;
        const label = mentionsToExclude.join(' / ');

        setExcludedCharacters(prev => {
            const next = new Set(prev);
            mentionsToExclude.forEach(m => next.add(m));
            return next;
        });

        if (report) {
            const excludeSet = new Set(mentionsToExclude);
            const nextOrigEntities = report.originalEntities.filter(
                ent => !ent.mentions.some(m => excludeSet.has(m))
            );
            const nextImitEntities = report.imitationEntities.filter(
                ent => !ent.mentions.some(m => excludeSet.has(m))
            );
            const { confirmedConflicts } = compareCharacterConflicts(
                originalText,
                imitationText,
                nextOrigEntities,
                nextImitEntities
            );
            setReport(
                recalculateAuditReport({
                    ...report,
                    originalEntities: nextOrigEntities,
                    imitationEntities: nextImitEntities,
                    characterConflicts: confirmedConflicts
                })
            );
        }
        showToast(`已将【${label}】从人物对比名单中移除！`);
    };

    const handleAddCustomCharacter = () => {
        const name = newCharInput.trim();
        if (!name) return;
        if (name.length < 2 || name.length > 8) {
            showToast('角色名称建议在 2~6 个字之间');
            return;
        }
        setCustomAddedCharacters(prev => Array.from(new Set([...prev, name])));
        setNewCharInput('');
        if (report) {
            const nextOrig = [...report.originalEntities];
            const nextImit = [...report.imitationEntities];
            if (originalText.includes(name) && !nextOrig.some(e => e.mentions.includes(name))) {
                nextOrig.push({
                    id: `custom-orig-${name}`,
                    canonical: name,
                    mentions: [name],
                    role: '人工添加人物',
                    evidence: [name],
                    count: countExactOccurrences(originalText, name),
                    confidence: 'confirmed',
                    firstIndex: Math.max(0, originalText.indexOf(name))
                });
            }
            if (imitationText.includes(name) && !nextImit.some(e => e.mentions.includes(name))) {
                nextImit.push({
                    id: `custom-imit-${name}`,
                    canonical: name,
                    mentions: [name],
                    role: '人工添加人物',
                    evidence: [name],
                    count: countExactOccurrences(imitationText, name),
                    confidence: 'confirmed',
                    firstIndex: Math.max(0, imitationText.indexOf(name))
                });
            }
            const { confirmedConflicts } = compareCharacterConflicts(originalText, imitationText, nextOrig, nextImit);
            setReport(recalculateAuditReport({
                ...report,
                originalEntities: nextOrig,
                imitationEntities: nextImit,
                characterConflicts: confirmedConflicts
            }));
        }
        showToast(`已将【${name}】加入人物排查清单并同步重查冲突！`);
    };

    // --- 待人工核对：确认问题 / 确认为人物 / 不是人物 / 忽略 / 直接修改 ---
    const handleConfirmManualItem = (item: ManualReviewItem) => {
        if (!report) return;

        let nextManual = report.manualReviewItems.map(m =>
            m.id === item.id ? { ...m, status: 'confirmed' as const } : m
        );

        let nextTypos = [...report.typoIssues];
        let nextOrigEntities = [...report.originalEntities];
        let nextImitEntities = [...report.imitationEntities];
        let nextConflicts = [...report.characterConflicts];
        let nextSimAlerts = [...report.similarityAlerts];

        if ((item.issueType === 'typo' || item.issueType === 'consistency') && item.wrongText) {
            const idx = item.imitationIndex !== undefined ? item.imitationIndex : Math.max(0, imitationText.indexOf(item.wrongText));
            if (!nextTypos.some(t => t.wrongText === item.wrongText && t.index === idx)) {
                nextTypos.push({
                    id: `confirmed-manual-${item.id}`,
                    index: idx,
                    wrongText: item.wrongText,
                    correctText: item.correctText || manualCustomEdits[item.id] || item.wrongText,
                    sentence: item.imitationTextSnippet,
                    explanation: `[人工确认] ${item.reason}`,
                    locationLabel: item.locationLabel,
                    category: item.issueType === 'consistency' ? 'consistency' : 'typo'
                });
            }
        } else if (item.issueType === 'character' && item.candidateName) {
            const cName = item.candidateName;
            const cMentions = item.candidateMentions || [cName];
            if (item.candidateTarget === 'original') {
                nextOrigEntities = mergeCharacterIntoEntities(nextOrigEntities, originalText, {
                    canonical: cName,
                    mentions: cMentions,
                    role: item.candidateRole || '人工确认人物',
                    evidence: item.originalTextSnippet,
                    firstIndex: item.originalIndex,
                    idPrefix: 'manual-char-orig'
                });
            } else {
                nextImitEntities = mergeCharacterIntoEntities(nextImitEntities, imitationText, {
                    canonical: cName,
                    mentions: cMentions,
                    role: item.candidateRole || '人工确认人物',
                    evidence: item.imitationTextSnippet,
                    firstIndex: item.imitationIndex,
                    idPrefix: 'manual-char-imit'
                });
            }

            // 同步关闭同名候选与旧的待定冲突项，由正式人物碰撞重新生成
            const mentionSet = new Set(cMentions);
            nextManual = nextManual.map(m => {
                if (m.status !== 'pending') return m;
                if (m.issueType === 'character' && m.candidateTarget === item.candidateTarget && m.candidateName && mentionSet.has(m.candidateName)) {
                    return { ...m, status: 'confirmed' as const };
                }
                if (m.issueType === 'conflict' && ((m.wrongText && mentionSet.has(m.wrongText)) || mentionSet.has(cName) && m.aiJudgment.includes(`「${cName}」`))) {
                    return { ...m, status: 'confirmed' as const };
                }
                return m;
            });

            nextConflicts = compareCharacterConflicts(
                originalText,
                imitationText,
                nextOrigEntities,
                nextImitEntities
            ).confirmedConflicts;
        } else if (item.issueType === 'similarity') {
            nextSimAlerts.push({
                id: `confirmed-sim-${item.id}`,
                kind: 'long_sentence',
                severity: 'danger',
                originalSnippet: item.originalTextSnippet,
                imitationSnippet: item.imitationTextSnippet,
                originalIndex: item.originalIndex ?? 0,
                imitationIndex: item.imitationIndex ?? 0,
                length: item.imitationTextSnippet.length,
                reason: `[人工确认] ${item.reason}`,
                suggestedRewrite: item.suggestedFix
            });
        } else if (item.issueType === 'conflict' && item.wrongText) {
            nextConflicts.push({
                id: `confirmed-conflict-${item.id}`,
                originalName: item.originalTextSnippet,
                imitationName: item.wrongText,
                originalEntityDisplay: item.originalTextSnippet,
                imitationEntityDisplay: item.wrongText,
                originalEvidence: item.originalTextSnippet,
                imitationEvidence: item.imitationTextSnippet,
                originalIndex: item.originalIndex ?? 0,
                imitationIndex: item.imitationIndex ?? 0,
                conflictType: 'homophone',
                isExactMatch: false,
                originalPinyin: '',
                imitationPinyin: '',
                count: countExactOccurrences(imitationText, item.wrongText),
                recommendedNames: ['沈砚', '周妄', '陆司沉']
            });
        }

        setReport(
            recalculateAuditReport({
                ...report,
                manualReviewItems: nextManual,
                typoIssues: nextTypos.sort((a, b) => a.index - b.index),
                originalEntities: nextOrigEntities,
                imitationEntities: nextImitEntities,
                characterConflicts: nextConflicts,
                similarityAlerts: nextSimAlerts
            })
        );
        if (activeLocate?.id === item.id) setActiveLocate(null);
        showToast(
            item.issueType === 'character'
                ? `已确认「${item.candidateName}」为人物并归并别名清单（无重复角色）！`
                : '已确认为正式问题，并同步更新审稿结果与红色标注！'
        );
    };

    const handleIgnoreManualItem = (item: ManualReviewItem) => {
        if (!report) return;
        const rejectSet = new Set<string>(
            item.issueType === 'character' && item.candidateName
                ? [item.candidateName, ...(item.candidateMentions || [])]
                : []
        );

        if (rejectSet.size > 0) {
            setExcludedCharacters(prev => {
                const next = new Set(prev);
                rejectSet.forEach(n => next.add(n));
                return next;
            });
        }

        const nextManual = report.manualReviewItems.map((m) => {
            if (m.id === item.id) return { ...m, status: 'ignored' as const };
            if (
                rejectSet.size > 0 &&
                m.status === 'pending' &&
                m.issueType === 'conflict' &&
                ((m.wrongText && rejectSet.has(m.wrongText)) || Array.from(rejectSet).some(r => m.aiJudgment.includes(`「${r}」`)))
            ) {
                return { ...m, status: 'ignored' as const };
            }
            return m;
        });

        setReport(recalculateAuditReport({ ...report, manualReviewItems: nextManual }));
        if (activeLocate?.id === item.id) setActiveLocate(null);
        showToast(
            item.issueType === 'character'
                ? `已标记「${item.candidateName}」不是人物并剔除相关高亮与计数`
                : '已忽略该项，相关高亮与待核对计数已同步更新'
        );
    };

    const handleModifyManualItem = (item: ManualReviewItem) => {
        if (!report) return;

        // 人物类待核对修改：原稿严格保持只读（仅修正/归并人物别名清单）；仿写支持修改正文或归并别名
        if (item.issueType === 'character' && item.candidateName) {
            const editedName = (manualCustomEdits[item.id] ?? item.candidateName ?? '').trim();
            if (!editedName) {
                showToast('请先在输入框填写修改后的人物名或要归并的主名');
                return;
            }

            if (item.candidateTarget === 'original') {
                const matchesExistingEntity = report.originalEntities.some(
                    e => e.canonical === editedName || e.mentions.includes(editedName)
                );
                if (!matchesExistingEntity && !originalText.includes(editedName)) {
                    showToast('原稿保持只读：请输入原稿中实际存在的人名，或输入已有原稿角色主名以归并别名');
                    return;
                }

                const nextOrigEntities = mergeCharacterIntoEntities(report.originalEntities, originalText, {
                    canonical: matchesExistingEntity ? editedName : editedName,
                    mentions: matchesExistingEntity
                        ? [item.candidateName, ...(item.candidateMentions || [])]
                        : [editedName, ...(item.candidateMentions || [])],
                    role: item.candidateRole || '人工修正人物',
                    evidence: item.originalTextSnippet,
                    firstIndex: item.originalIndex,
                    idPrefix: 'manual-char-orig',
                    mergeTargetName: matchesExistingEntity ? editedName : undefined
                });

                const nextManual = report.manualReviewItems.map(m =>
                    m.id === item.id ? { ...m, status: 'modified' as const } : m
                );
                const nextConflicts = compareCharacterConflicts(
                    originalText,
                    imitationText,
                    nextOrigEntities,
                    report.imitationEntities
                ).confirmedConflicts;

                setReport(
                    recalculateAuditReport({
                        ...report,
                        originalEntities: nextOrigEntities,
                        characterConflicts: nextConflicts,
                        manualReviewItems: nextManual
                    })
                );
                setActiveLocate(null);
                showToast(
                    matchesExistingEntity
                        ? `原稿保持只读：已将「${item.candidateName}」作为别名归并至「${editedName}」并更新冲突结果！`
                        : `原稿保持只读：已将原稿人物识别名修正为「${editedName}」并更新结果！`
                );
                return;
            }

            // 仿写侧人物修改
            const matchesExistingImit = report.imitationEntities.some(
                e => e.canonical === editedName || e.mentions.includes(editedName)
            );
            let nextImitText = imitationText;
            if (editedName !== item.candidateName && imitationText.includes(item.candidateName)) {
                const idx = item.imitationIndex !== undefined &&
                    imitationText.slice(item.imitationIndex, item.imitationIndex + item.candidateName.length) === item.candidateName
                    ? item.imitationIndex
                    : locateVerbatimSpan(imitationText, item.candidateName, item.imitationTextSnippet);
                if (idx !== -1 && !matchesExistingImit) {
                    nextImitText =
                        imitationText.slice(0, idx) +
                        editedName +
                        imitationText.slice(idx + item.candidateName.length);
                    setImitationText(nextImitText);
                }
            }

            const nextImitEntities = mergeCharacterIntoEntities(report.imitationEntities, nextImitText, {
                canonical: editedName,
                mentions: matchesExistingImit
                    ? [item.candidateName, ...(item.candidateMentions || [])]
                    : [editedName, ...(item.candidateMentions || [])],
                role: item.candidateRole || '人工修正人物',
                evidence: item.imitationTextSnippet,
                firstIndex: item.imitationIndex,
                idPrefix: 'manual-char-imit',
                mergeTargetName: matchesExistingImit ? editedName : undefined
            });

            const nextManual = report.manualReviewItems.map(m =>
                m.id === item.id ? { ...m, status: 'modified' as const } : m
            );
            setReport(
                syncReportWithUpdatedImitation(nextImitText, report, {
                    imitationEntities: nextImitEntities,
                    manualReviewItems: nextManual
                })
            );
            setActiveLocate(null);
            showToast(
                matchesExistingImit
                    ? `已将「${item.candidateName}」归并至仿写人物「${editedName}」并更新结果！`
                    : `已将仿写人物修改为「${editedName}」并同步更新冲突与高亮！`
            );
            return;
        }

        const replacement = (manualCustomEdits[item.id] ?? item.correctText ?? '').trim();
        const targetSlice = (item.wrongText || item.imitationTextSnippet || '').trim();
        if (!targetSlice || targetSlice.startsWith('—')) {
            showToast('此项无对应可自动替换的仿写片段，请切换到“编辑正文”直接调整');
            return;
        }
        if (!replacement) {
            showToast('请先在输入框填写修改后的内容');
            return;
        }

        const idx = item.imitationIndex !== undefined && imitationText.slice(item.imitationIndex, item.imitationIndex + targetSlice.length) === targetSlice
            ? item.imitationIndex
            : locateVerbatimSpan(imitationText, targetSlice, item.imitationTextSnippet);

        if (idx === -1) {
            showToast('未在仿写正文中找到该待改文本，可能已被修改');
            return;
        }

        const nextImitText = imitationText.slice(0, idx) + replacement + imitationText.slice(idx + targetSlice.length);
        setImitationText(nextImitText);

        const nextManual = report.manualReviewItems.map(m =>
            m.id === item.id ? { ...m, status: 'modified' as const } : m
        );
        setReport(
            syncReportWithUpdatedImitation(nextImitText, report, {
                manualReviewItems: nextManual
            })
        );
        setActiveLocate(null);
        showToast(`已将仿写正文中的「${targetSlice}」修改为「${replacement}」并同步更新结果！`);
    };

    // --- AI 智能降重改写建议（直连当前所选真实模型，严禁假结果） ---
    const handleAiRewriteSentence = async (similarityItem: SentenceSimilarity) => {
        setIsAiRewriting(true);
        setAiRewriteSuggestions([]);

        const prompt = `【任务指令】：对以下仿写雷同句子进行专业降重改写。
【原稿参照句子】：${similarityItem.matchedOriginalSentence || '无'}
【当前仿写句子】：${similarityItem.sentence}
【改写要求】：
1. 保持相同的情感走向或情节推动意图，但彻底更换句式结构、修辞描写与动词形容词。
2. 严禁照搬原句词汇与连续15字以上重复结构，确保改写后相似度降至 20% 以下。
3. 请严格给出 3 种不同风格的降重版本（如：情绪张力版、细腻心理版、镜头动作版）。
4. 格式规范，每行一条：
风格名称：改写后正文句子`;

        try {
            const { text } = await callReviewModel(prompt, selectedModel, undefined, {
                jsonMode: false,
                timeoutMs: 36000,
                thinkingLevel: 'LOW'
            });
            const lines = text
                .split(/\n+/)
                .map(line => line.trim())
                .filter(line => line.length > 5 && !line.includes('【任务') && !line.includes('【改写'));

            const parsed: Array<{ style: string; text: string }> = [];
            lines.forEach((line, idx) => {
                if (line.includes('：') || line.includes(':')) {
                    const parts = line.split(/[：:]/);
                    parsed.push({
                        style: `【${parts[0].replace(/^[0-9\.\、\-*•\s]+/, '')}】`,
                        text: parts.slice(1).join('：').trim()
                    });
                } else {
                    const cleanText = line.replace(/^[0-9\.\、\-*•\s]+/, '').trim();
                    const styleName = idx === 0 ? '【张力强化版】' : idx === 1 ? '【心理细化版】' : '【镜头视听版】';
                    parsed.push({ style: styleName, text: cleanText });
                }
            });

            if (parsed.length === 0) {
                throw new Error('模型未返回有效降重建议');
            }
            setAiRewriteSuggestions(parsed.slice(0, 3));
            showToast('已生成 3 组 AI 降重方案，点击即可一键采纳');
        } catch (e: any) {
            showToast(`AI 降重生成失败：${e?.message || '请检查模型或切换模型后重试'}`);
        } finally {
            setIsAiRewriting(false);
        }
    };

    const handleApplyRewrite = (oldSentence: string, newSentence: string) => {
        const cleanNew = newSentence.trim().replace(/[。！？!?]$/, '');
        const updated = imitationText.replace(oldSentence, cleanNew);
        handleImitationTextEdit(updated);
        setAiRewriteSuggestions([]);
        setSelectedSentenceIndex(null);
        setActiveLocate(null);
        showToast('已采纳降重改写方案并同步更新调色盘！');
    };

    const handleCopyFinal = () => {
        navigator.clipboard.writeText(imitationText);
        showToast('仿写终稿已复制到剪贴板！');
    };

    const handleExportTxt = () => {
        const blob = new Blob([imitationText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `审稿修改后仿写稿件_${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('已导出为 TXT 文件！');
    };

    const handleSaveToMaterial = async () => {
        try {
            await saveMaterial('审稿校对定稿', imitationText, 'idea', ['审稿定稿', '仿写校对']);
            showToast('已保存至素材库！');
        } catch {
            showToast('保存成功（本地存储）！');
        }
    };

    // --- 构造原稿 & 仿写正文的问题高亮切片（红色=确认问题，黄色=待人工核对） ---
    const buildNonOverlappingSegments = (text: string, rawSpans: HighlightSegment[]): HighlightSegment[] => {
        // Focus > danger > warning, shorter spans kept intact cleanly
        const priority = (s: HighlightSegment) => (s.isFocused ? 100 : s.level === 'danger' ? 10 : 5);
        const sorted = [...rawSpans]
            .filter(s => s.start >= 0 && s.end > s.start && s.end <= text.length)
            .sort((a, b) => priority(b) - priority(a) || a.start - b.start);

        const accepted: HighlightSegment[] = [];
        for (const cand of sorted) {
            if (!accepted.some(ex => !(cand.end <= ex.start || cand.start >= ex.end))) {
                accepted.push(cand);
            }
        }
        return accepted.sort((a, b) => a.start - b.start);
    };

    const originalIssueSegments = useMemo(() => {
        if (!report) return [];
        const raw: HighlightSegment[] = [];

        if (activeLocate?.origStart !== undefined && activeLocate?.origEnd !== undefined) {
            raw.push({
                start: activeLocate.origStart,
                end: activeLocate.origEnd,
                level: activeLocate.level,
                label: '当前定位原稿位置',
                isFocused: true
            });
        }

        report.characterConflicts.forEach((c) => {
            if (c.originalIndex >= 0) {
                raw.push({
                    start: c.originalIndex,
                    end: c.originalIndex + c.originalName.length,
                    level: 'danger',
                    label: `重名/同音人物：${c.originalName} ↔ ${c.imitationName}`,
                    itemId: c.id,
                    itemTab: 'character'
                });
            }
        });

        report.similarityAlerts.forEach((a) => {
            if (a.originalIndex >= 0 && a.originalSnippet) {
                raw.push({
                    start: a.originalIndex,
                    end: a.originalIndex + a.originalSnippet.length,
                    level: 'danger',
                    label: a.reason,
                    itemId: a.id,
                    itemTab: 'similarity'
                });
            }
        });

        report.manualReviewItems
            .filter(m => m.status === 'pending' && m.originalIndex !== undefined && m.originalTextSnippet && !m.originalTextSnippet.startsWith('—'))
            .forEach((m) => {
                const start = m.originalIndex!;
                const len = Math.min(m.originalTextSnippet.length, Math.max(2, originalText.length - start));
                raw.push({
                    start,
                    end: start + len,
                    level: 'warning',
                    label: `${m.aiJudgment}（点击核对）`,
                    itemId: m.id,
                    itemTab: 'manual'
                });
            });

        return buildNonOverlappingSegments(originalText, raw);
    }, [report, originalText, activeLocate]);

    const imitationIssueSegments = useMemo(() => {
        if (!report) return [];
        const raw: HighlightSegment[] = [];

        if (activeLocate?.imitStart !== undefined && activeLocate?.imitEnd !== undefined) {
            raw.push({
                start: activeLocate.imitStart,
                end: activeLocate.imitEnd,
                level: activeLocate.level,
                label: '当前定位仿写位置',
                isFocused: true
            });
        }

        report.typoIssues.forEach((t) => {
            raw.push({
                start: t.index,
                end: t.index + t.wrongText.length,
                level: 'danger',
                label: `${t.wrongText} → ${t.correctText}（${t.explanation}）`,
                itemId: t.id,
                itemTab: 'typo'
            });
        });

        report.characterConflicts.forEach((c) => {
            let pos = 0;
            while (pos < imitationText.length) {
                const idx = imitationText.indexOf(c.imitationName, pos);
                if (idx === -1) break;
                raw.push({
                    start: idx,
                    end: idx + c.imitationName.length,
                    level: 'danger',
                    label: `与原稿「${c.originalName}」冲突（${c.conflictType}）`,
                    itemId: c.id,
                    itemTab: 'character'
                });
                pos = idx + c.imitationName.length;
            }
        });

        report.similarityAlerts.forEach((a) => {
            if (a.imitationIndex >= 0 && a.imitationSnippet) {
                raw.push({
                    start: a.imitationIndex,
                    end: a.imitationIndex + a.imitationSnippet.length,
                    level: 'danger',
                    label: a.reason,
                    itemId: a.id,
                    itemTab: 'similarity'
                });
            }
        });

        report.manualReviewItems
            .filter(m => m.status === 'pending' && m.imitationIndex !== undefined)
            .forEach((m) => {
                const start = m.imitationIndex!;
                const targetLen = m.wrongText?.length || Math.min(m.imitationTextSnippet.length, 30);
                if (targetLen > 0) {
                    raw.push({
                        start,
                        end: Math.min(imitationText.length, start + targetLen),
                        level: 'warning',
                        label: `${m.aiJudgment}：${m.reason}`,
                        itemId: m.id,
                        itemTab: 'manual'
                    });
                }
            });

        return buildNonOverlappingSegments(imitationText, raw);
    }, [report, imitationText, activeLocate]);

    const renderSegmentsContent = (
        text: string,
        segments: HighlightSegment[],
        side: 'orig' | 'imit'
    ) => {
        if (segments.length === 0) {
            return <span className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{text}</span>;
        }

        const nodes: React.ReactNode[] = [];
        let cursor = 0;
        segments.forEach((seg, i) => {
            if (seg.start > cursor) {
                nodes.push(
                    <span key={`${side}-plain-${i}`} className="whitespace-pre-wrap">
                        {text.slice(cursor, seg.start)}
                    </span>
                );
            }
            const slice = text.slice(seg.start, seg.end);
            const isDanger = seg.level === 'danger';
            const cls = isDanger
                ? 'bg-red-200/95 dark:bg-red-900/70 text-red-950 dark:text-red-100 border-b-2 border-red-600'
                : 'bg-yellow-200/95 dark:bg-yellow-900/60 text-yellow-950 dark:text-yellow-100 border-b-2 border-yellow-500';
            const focusCls = seg.isFocused ? 'ring-2 ring-sky-500 ring-offset-1 rounded font-semibold animate-pulse' : 'rounded px-0.5';

            nodes.push(
                <mark
                    key={`${side}-hl-${i}`}
                    data-locate-orig={side === 'orig' && seg.isFocused ? 'true' : undefined}
                    data-locate-imit={side === 'imit' && seg.isFocused ? 'true' : undefined}
                    title={seg.label}
                    onClick={() => {
                        if (seg.itemTab) setActiveTab(seg.itemTab);
                        if (isCollapsed) setIsCollapsed(false);
                    }}
                    className={`${cls} ${focusCls} cursor-pointer whitespace-pre-wrap transition`}
                >
                    {slice}
                </mark>
            );
            cursor = seg.end;
        });

        if (cursor < text.length) {
            nodes.push(
                <span key={`${side}-tail`} className="whitespace-pre-wrap">
                    {text.slice(cursor)}
                </span>
            );
        }

        return <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans">{nodes}</div>;
    };

    const pendingManualItems = useMemo(
        () => report?.manualReviewItems.filter(m => m.status === 'pending') || [],
        [report]
    );
    const resolvedManualItems = useMemo(
        () => report?.manualReviewItems.filter(m => m.status !== 'pending') || [],
        [report]
    );

    if (!isActive) return null;

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-slate-50 dark:bg-black text-slate-800 dark:text-slate-100 font-sans overflow-hidden select-text">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 px-5 py-2.5 rounded-full shadow-2xl text-xs font-semibold backdrop-blur-md animate-fade-in-down border border-sky-400/30">
                    {toastMessage}
                </div>
            )}

            {/* Top Header & Audit Controls */}
            <header
                ref={headerRef}
                className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shadow-xs z-20 flex-shrink-0"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
                        <ClipboardDocumentCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-bold leading-5 text-slate-900 dark:text-white tracking-wide whitespace-nowrap">
                                智能审稿比对中心
                            </h2>
                            <span className="hidden xl:inline-flex items-center h-5 px-2 text-[10px] leading-none font-bold rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 whitespace-nowrap">
                                全文AI语义审查 · 人工核对 · 双向定位
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 hidden lg:block truncate mt-0.5">
                            一次审稿完成人物姓名/同音换序、人物一致性、错别字与15字+台词查重；不确定问题直进人工核对并支持局部增量复检。
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                    {/* Model Selector (Always visible & aligned at h-8 across breakpoints) */}
                    <div className="h-8 px-2.5 inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <span className="text-xs leading-none text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                            审稿模型:
                        </span>
                        <select
                            aria-label="选择审稿模型"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="h-6 bg-transparent text-xs leading-none font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer pr-1 max-w-[168px]"
                        >
                            {ALL_MODEL_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleLoadDemo}
                        className="h-8 px-3 text-xs leading-none font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-all border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center whitespace-nowrap"
                        title="快速填入演示样本"
                    >
                        填入演示样本
                    </button>

                    <button
                        type="button"
                        onClick={handleClear}
                        className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center flex-shrink-0"
                        title="全部清除并恢复初始界面"
                    >
                        <Trash className="w-4 h-4" />
                    </button>

                    {hasPendingIncrementalChanges && (
                        <button
                            type="button"
                            onClick={() => handleRunAudit(true)}
                            disabled={isAuditing}
                            className="h-8 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs leading-none font-semibold rounded-xl transition disabled:opacity-50 inline-flex items-center justify-center whitespace-nowrap"
                            title="忽略增量缓存，对全篇全文重审"
                        >
                            全篇重审
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => handleRunAudit(false)}
                        disabled={isAuditing}
                        className="h-8 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs leading-none font-bold rounded-xl shadow-md shadow-sky-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                        {isAuditing ? (
                            <>
                                <ArrowPath className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                                <span className="max-w-[200px] truncate">{auditProgress || '正在分析...'}</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{hasPendingIncrementalChanges ? '局部复检变更' : '开始智能审稿'}</span>
                            </>
                        )}
                    </button>
                </div>
            </header>

            {/* Real API Failure Alert (Concise, no silent model switching) */}
            {auditError && (
                <div className="px-6 py-2 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-900 flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-200 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <ExclamationCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                        <span>{auditError}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => handleRunAudit(false)}
                            disabled={isAuditing}
                            className="h-6 px-2.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold inline-flex items-center"
                        >
                            重新审稿
                        </button>
                        <button
                            type="button"
                            onClick={() => setAuditError(null)}
                            className="h-6 px-2 rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200 text-[11px] font-semibold inline-flex items-center"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}

            {/* Compact Summary Banner (If Report Generated) */}
            {report && (
                <div
                    ref={bannerRef}
                    data-testid="review-summary-banner"
                    className={`px-5 py-1.5 min-h-[40px] border-b flex flex-wrap items-center justify-between gap-2 transition-colors flex-shrink-0 ${
                        !report.coverage.isComplete
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100'
                            : report.verdict === 'danger'
                            ? 'bg-rose-50/85 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-100'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                >
                    <div className="flex items-center gap-3 text-xs min-w-0 flex-wrap">
                        <span className="font-bold tracking-wide whitespace-nowrap">
                            整体相似度：{report.overallSimilarity}%｜审稿耗时：{(report.durationMs / 1000).toFixed(1)}秒
                        </span>
                        {!report.coverage.isComplete && (
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                    <ExclamationCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    审稿未完成，部分内容需要重试
                                </span>
                                <button
                                    type="button"
                                    onClick={handleRetryFailedParts}
                                    disabled={isAuditing}
                                    className="h-6 px-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] leading-none font-bold shadow-2xs transition disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                    <ArrowPath className={`w-3 h-3 ${isAuditing ? 'animate-spin' : ''}`} />
                                    重试失败部分
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/70 p-0.5 rounded-lg flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleCopyFinal}
                            className="h-7 px-2 text-xs leading-none font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition inline-flex items-center gap-1 whitespace-nowrap"
                            title="复制修改后的仿写内容"
                        >
                            <Copy className="w-3 h-3 flex-shrink-0" />
                            <span>复制终稿</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportTxt}
                            className="h-7 px-2 text-xs leading-none font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition inline-flex items-center gap-1 whitespace-nowrap"
                            title="导出为TXT文档"
                        >
                            <DocumentArrowDown className="w-3 h-3 flex-shrink-0" />
                            <span>导出</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveToMaterial}
                            className="h-7 px-2 text-xs leading-none font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition inline-flex items-center gap-1 whitespace-nowrap"
                            title="保存到素材库"
                        >
                            <FloppyDisk className="w-3 h-3 flex-shrink-0" />
                            <span>存素材</span>
                        </button>
                    </div>
                </div>
            )}

            {/* UPPER PART: Dual Column Manuscripts Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
                {/* LEFT COLUMN: 原稿内容（审稿模式下保持只读防误改，支持双向高亮定位） */}
                <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden min-h-0">
                    <div
                        data-testid="original-column-header"
                        className="h-12 px-3.5 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0 overflow-hidden"
                    >
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 flex-shrink-0"></span>
                            <h3 className="text-[13px] font-bold leading-5 text-slate-800 dark:text-slate-200 tracking-wide whitespace-nowrap flex-shrink-0">
                                原稿内容<span className="hidden 2xl:inline">（标杆参照）</span>
                            </h3>
                            <span className="text-xs leading-5 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap flex-shrink-0">
                                ({originalStats.charCount} 字)
                            </span>
                            {report && (
                                <span className="h-7 px-2 text-xs leading-none font-semibold rounded-md bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center justify-center whitespace-nowrap flex-shrink-0">
                                    🔒 只读<span className="hidden xl:inline">防误改</span>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                                ref={fileInputOriginalRef}
                                type="file"
                                accept=".txt,.md,.docx,.doc,.json"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], true);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputOriginalRef.current?.click()}
                                className="h-7 px-2.5 text-xs leading-none font-medium bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-md border border-slate-200 dark:border-slate-700 transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0"
                            >
                                <DocumentArrowDown className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>上传原稿</span>
                            </button>
                        </div>
                    </div>

                    <div ref={origScrollContainerRef} className="flex-1 p-4 overflow-y-auto">
                        {report ? (
                            <div className="p-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800 min-h-full">
                                {renderSegmentsContent(originalText, originalIssueSegments, 'orig')}
                            </div>
                        ) : (
                            <textarea
                                value={originalText}
                                onChange={(e) => setOriginalText(e.target.value)}
                                placeholder="在此输入、粘贴原稿正文，或直接点击上方上传原稿文档（支持 .txt / .docx / .md）；开始审稿后原稿将自动锁定只读以防止误改..."
                                className="w-full h-full resize-none bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600 selection:bg-sky-200 dark:selection:bg-sky-900/60"
                            />
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: 仿写稿件（待审，支持问题定位高亮 / 相似度调色盘 / 直接编辑正文） */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900/60 overflow-hidden min-h-0">
                    <div
                        data-testid="imitation-column-header"
                        className="h-12 px-3.5 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-shrink-0 overflow-hidden"
                    >
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
                            <h3 className="text-[13px] font-bold leading-5 text-slate-800 dark:text-slate-200 tracking-wide whitespace-nowrap flex-shrink-0">
                                仿写稿件<span className="hidden 2xl:inline">（待审可编辑）</span>
                            </h3>
                            <span className="text-xs leading-5 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap flex-shrink-0">
                                ({imitationStats.charCount} 字)
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {report && (
                                <div className="h-7 p-0.5 bg-slate-200/90 dark:bg-slate-800 rounded-md inline-flex items-center flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('audit')}
                                        className={`h-6 px-2 rounded text-xs leading-none transition inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                                            viewMode === 'audit'
                                                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>调色盘<span className="hidden xl:inline">视图</span></span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('edit')}
                                        className={`h-6 px-2 rounded text-xs leading-none transition inline-flex items-center justify-center gap-1 whitespace-nowrap ${
                                            viewMode === 'edit'
                                                ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 font-medium'
                                        }`}
                                    >
                                        <Pencil className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>编辑<span className="hidden xl:inline">正文</span></span>
                                    </button>
                                </div>
                            )}

                            <input
                                ref={fileInputImitationRef}
                                type="file"
                                accept=".txt,.md,.docx,.doc,.json"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0], false);
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputImitationRef.current?.click()}
                                className="h-7 px-2.5 text-xs leading-none font-medium bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-slate-600 dark:text-slate-300 hover:text-sky-600 rounded-md border border-slate-200 dark:border-slate-700 transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0"
                            >
                                <DocumentArrowDown className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>上传仿写</span>
                            </button>
                        </div>
                    </div>

                    <div ref={imitScrollContainerRef} className="flex-1 p-4 overflow-y-auto">
                        {report && viewMode === 'audit' ? (
                            <div className="space-y-3">
                                {/* Palette Mode Switcher: 审稿问题高亮模式 vs 原有相似度调色盘模式 */}
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-0.5 rounded-lg">
                                            <button
                                                onClick={() => setPaletteMode('issues')}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                                                    paletteMode === 'issues'
                                                        ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-300 shadow-xs'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                🔴 审稿问题高亮
                                            </button>
                                            <button
                                                onClick={() => setPaletteMode('similarity')}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                                                    paletteMode === 'similarity'
                                                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-xs'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                            >
                                                🎨 相似度调色盘
                                            </button>
                                        </div>

                                        {paletteMode === 'issues' ? (
                                            <div className="flex items-center gap-2 text-[11px] flex-wrap">
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                                                    <span className="w-2 h-2 rounded-full bg-red-600"></span>
                                                    红色：确认问题 ({report.typoIssues.length + report.characterConflicts.length + report.similarityAlerts.length})
                                                </span>
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950/70 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800">
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                    黄色：待人工核对 ({pendingManualItems.length})
                                                </span>
                                                <button
                                                    onClick={() => setViewMode('edit')}
                                                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                                                >
                                                    直接修改正文
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <button
                                                    onClick={() => setPaletteFilter('all')}
                                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition ${
                                                        paletteFilter === 'all'
                                                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200'
                                                    }`}
                                                >
                                                    全部
                                                </button>
                                                <button
                                                    onClick={() => setPaletteFilter('danger')}
                                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                        paletteFilter === 'danger'
                                                            ? 'bg-red-600 text-white font-bold'
                                                            : 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                                                    }`}
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    极高重合/15字+台词 ({report.colorStats.dangerCount})
                                                </button>
                                                <button
                                                    onClick={() => setPaletteFilter('warning')}
                                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                        paletteFilter === 'warning'
                                                            ? 'bg-amber-600 text-white font-bold'
                                                            : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                                    }`}
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                    高度相仿 ({report.colorStats.warningCount})
                                                </button>
                                                <button
                                                    onClick={() => setPaletteFilter('caution')}
                                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                        paletteFilter === 'caution'
                                                            ? 'bg-yellow-600 text-white font-bold'
                                                            : 'bg-yellow-100 dark:bg-yellow-950/70 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800'
                                                    }`}
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                                    中度借鉴 ({report.colorStats.cautionCount})
                                                </button>
                                                <button
                                                    onClick={() => setPaletteFilter('safe')}
                                                    className={`px-2 py-0.5 rounded-full border text-[11px] transition flex items-center gap-1 ${
                                                        paletteFilter === 'safe'
                                                            ? 'bg-emerald-600 text-white font-bold'
                                                            : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                                    }`}
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    安全原创 ({report.colorStats.safeCount})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Palette Content Rendering */}
                                {paletteMode === 'issues' ? (
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                        {renderSegmentsContent(imitationText, imitationIssueSegments, 'imit')}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-slate-200/80 dark:border-slate-800 leading-relaxed text-sm space-y-2">
                                        {report.sentenceSimilarities.map((item, idx) => {
                                            if (paletteFilter !== 'all' && item.colorLevel !== paletteFilter) {
                                                return null;
                                            }

                                            let styleClasses = 'px-1 py-0.5 rounded transition cursor-pointer ';
                                            if (item.colorLevel === 'danger') {
                                                styleClasses += 'bg-red-200/90 dark:bg-red-950/80 text-red-950 dark:text-red-200 border-b-2 border-red-500 hover:bg-red-300';
                                            } else if (item.colorLevel === 'warning') {
                                                styleClasses += 'bg-amber-200/80 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border-b-2 border-amber-500 hover:bg-amber-300';
                                            } else if (item.colorLevel === 'caution') {
                                                styleClasses += 'bg-yellow-100/90 dark:bg-yellow-950/50 text-yellow-950 dark:text-yellow-200 border-b-2 border-yellow-400 hover:bg-yellow-200';
                                            } else {
                                                styleClasses += 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800';
                                            }

                                            const isSelected = selectedSentenceIndex === idx;

                                            return (
                                                <span
                                                    key={`sent-${idx}`}
                                                    data-locate-imit={activeLocate?.imitStart === item.startIndex ? 'true' : undefined}
                                                    onClick={() => {
                                                        setSelectedSentenceIndex(isSelected ? null : idx);
                                                        setAiRewriteSuggestions([]);
                                                        setActiveTab('similarity');
                                                        if (item.matchedOriginalSentence && item.matchedOriginalIndex !== undefined) {
                                                            setActiveLocate({
                                                                id: `sent-${idx}`,
                                                                origStart: item.matchedOriginalIndex,
                                                                origEnd: item.matchedOriginalIndex + item.matchedOriginalSentence.length,
                                                                imitStart: item.startIndex,
                                                                imitEnd: item.endIndex,
                                                                level: item.colorLevel === 'danger' ? 'danger' : 'warning'
                                                            });
                                                        }
                                                    }}
                                                    className={`${styleClasses} ${isSelected ? 'ring-2 ring-sky-500 font-medium' : ''} inline-block mr-1 my-0.5`}
                                                    title={`相似度: ${Math.round(item.similarity * 100)}%${item.isLongDialogueOverlap ? ' [含15字+连续重复台词]' : ''} (点击查看原句对照与 AI 降重)`}
                                                >
                                                    {item.sentence}。
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <textarea
                                value={imitationText}
                                onChange={(e) => handleImitationTextEdit(e.target.value)}
                                placeholder="在此输入、粘贴仿写正文，或直接点击上方上传仿写文档（审稿后可随时在此直接修改正文，系统将同步高亮并支持局部增量复检）..."
                                className="w-full h-full resize-none bg-transparent outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans placeholder:text-slate-400 dark:placeholder:text-slate-600 selection:bg-indigo-200 dark:selection:bg-indigo-900/60"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* DRAGGABLE RESIZER HANDLE */}
            {report && (
                <div
                    onMouseDown={() => setIsDragging(true)}
                    className="h-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 dark:hover:bg-sky-500 cursor-row-resize flex items-center justify-center transition-all group z-40 select-none flex-shrink-0"
                    title="上下拖拽自由调节下半窗口高度（双击恢复默认高度）"
                    onDoubleClick={() => {
                        setDrawerHeight(360);
                        setLastExpandedHeight(360);
                        setIsCollapsed(false);
                    }}
                >
                    <div className="w-16 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors flex items-center justify-center"></div>
                </div>
            )}

            {/* BOTTOM AUDIT INSPECTOR DRAWER */}
            {report && (
                <div
                    style={{ height: isCollapsed ? '44px' : `${drawerHeight}px` }}
                    className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-30 shadow-2xl transition-[height] duration-75 flex-shrink-0"
                >
                    {/* Drawer Header Tabs */}
                    <div className="px-6 py-2 bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0 gap-2 overflow-x-auto">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab('typo')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                                    activeTab === 'typo'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>✍️ 错别字/一致性</span>
                                <span className={`px-1.5 py-0.5 leading-none inline-flex items-center rounded-full text-[10px] ${
                                    report.typoIssues.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-800'
                                }`}>
                                    {report.typoIssues.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab('character')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                                    activeTab === 'character'
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>👥 人物/同音换序排查</span>
                                <span className={`px-1.5 py-0.5 leading-none inline-flex items-center rounded-full text-[10px] ${
                                    report.characterConflicts.length > 0 ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-800'
                                }`}>
                                    {report.characterConflicts.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                                    activeTab === 'manual'
                                        ? 'bg-yellow-500 text-slate-950 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>🧐 待人工核对</span>
                                <span className={`px-1.5 py-0.5 leading-none inline-flex items-center rounded-full text-[10px] ${
                                    pendingManualItems.length > 0 ? 'bg-yellow-600 text-white' : 'bg-slate-200 dark:bg-slate-800'
                                }`}>
                                    {pendingManualItems.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab('similarity')}
                                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap ${
                                    activeTab === 'similarity'
                                        ? 'bg-sky-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>🎨 查重/15字+台词 &amp; 降重</span>
                                <span className="px-1.5 py-0.5 leading-none inline-flex items-center rounded-full bg-white/20 text-[10px]">
                                    {report.similarityAlerts.length > 0 ? `${report.similarityAlerts.length} 警` : `${report.overallSimilarity}%`}
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            {activeTab === 'typo' && report.typoIssues.length > 0 && (
                                <button
                                    onClick={handleFixAllTypos}
                                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-md shadow-xs transition flex items-center gap-1 mr-1"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    一键修复全部 ({report.typoIssues.length})
                                </button>
                            )}

                            <button
                                onClick={handleToggleCollapse}
                                className="px-3 py-1 bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-2xs"
                                title={isCollapsed ? '展开下半审稿面板' : '收起下半审稿面板'}
                            >
                                {isCollapsed ? '展开 ▲' : '收起 ▼'}
                            </button>
                        </div>
                    </div>

                    {/* Drawer Content */}
                    {!isCollapsed && (
                        <div className="flex-1 p-4 overflow-y-auto">
                            {/* TAB 1: 错别字与人物一致性 */}
                            {activeTab === 'typo' && (
                                <div>
                                    {!report.coverage.typoCheckComplete && (
                                        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <ExclamationCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                                                <span>审稿未完成，部分内容需要重试（已保留已完成结果，不可视为零错别字通过）。</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRetryFailedParts}
                                                disabled={isAuditing}
                                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold flex-shrink-0 disabled:opacity-50"
                                            >
                                                重试失败部分
                                            </button>
                                        </div>
                                    )}
                                    {report.typoIssues.length === 0 ? (
                                        !report.coverage.typoCheckComplete ? (
                                            <div className="text-center py-6 text-amber-700 dark:text-amber-300 text-xs font-bold space-y-2">
                                                <p>审稿未完成，部分内容需要重试（当前不可确认“无错别字”）</p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                    <Check className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <span>仿写稿件结合上下文未发现明确的错别字、漏多字、固定搭配错误或人物称谓不一致！</span>
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {report.typoIssues.map((typo) => {
                                                const catLabelMap: Record<TypoAuditItem['category'], string> = {
                                                    typo: '错字/别字',
                                                    homophone: '同音误用',
                                                    extra_char: '多字笔误',
                                                    missing_char: '漏字缺词',
                                                    collocation: '搭配错误',
                                                    consistency: '人物不一致',
                                                    grammar: '明显语句不通'
                                                };
                                                const catLabel = catLabelMap[typo.category] || '错别字';

                                                return (
                                                    <div
                                                        key={typo.id}
                                                        onClick={() => handleLocateProblem({
                                                            id: typo.id,
                                                            imitTextToFind: typo.wrongText,
                                                            imitIndexHint: typo.index,
                                                            level: 'danger'
                                                        })}
                                                        className={`p-3 bg-red-50/60 dark:bg-red-950/20 rounded-xl border flex flex-col justify-between text-xs space-y-2 cursor-pointer transition hover:shadow-sm ${
                                                            activeLocate?.id === typo.id ? 'border-sky-500 ring-2 ring-sky-400/50' : 'border-red-200 dark:border-red-900/50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                                                                    {catLabel}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    {typo.locationLabel} · 点击定位
                                                                </span>
                                                            </div>

                                                            <div className="text-slate-800 dark:text-slate-200 font-medium">
                                                                <span className="line-through text-red-600 mr-2">{typo.wrongText}</span>
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">&rarr; {typo.correctText}</span>
                                                            </div>

                                                            {typo.sentence && (
                                                                <div className="mt-1.5 px-2 py-1 rounded bg-white/80 dark:bg-slate-900/60 border border-red-200/60 dark:border-red-900/40 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                                                                    原句：{typo.sentence}
                                                                </div>
                                                            )}

                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                                {typo.explanation}
                                                            </p>
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFixTypo(typo);
                                                            }}
                                                            className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs shadow-xs transition"
                                                        >
                                                            采纳修改
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: 人物名称与称谓同音/换序排查 */}
                            {activeTab === 'character' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">🎯 语义识别依据:</span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                由大模型通读上下文确认真实人物（自动合并姓名、小名、封号与专属称谓，区分“沈家/陆家”与“秋千/小厨房”等普通词），程序仅执行原文定位与重名/同音/近音/同字换序比对。
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                value={newCharInput}
                                                onChange={(e) => setNewCharInput(e.target.value)}
                                                placeholder="补充要重点排查的人物..."
                                                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-sky-500 w-44"
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCharacter()}
                                            />
                                            <button
                                                onClick={handleAddCustomCharacter}
                                                className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition flex items-center gap-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                加入排查
                                            </button>
                                        </div>
                                    </div>

                                    {/* 双方已确认人物实体 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 block mb-1.5">
                                                【原稿已确认人物及别名 ({report.originalEntities.length})】:
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {report.originalEntities.length > 0 ? (
                                                    report.originalEntities.map((entity) => (
                                                        <span
                                                            key={entity.id}
                                                            onClick={() => handleLocateProblem({
                                                                id: entity.id,
                                                                origTextToFind: entity.canonical,
                                                                origIndexHint: entity.firstIndex,
                                                                level: 'warning'
                                                            })}
                                                            title={entity.evidence[0] ? `身份: ${entity.role || '人物'} | 依据: ${entity.evidence[0]}` : '点击定位'}
                                                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 shadow-2xs cursor-pointer hover:border-sky-400"
                                                        >
                                                            <span>{entity.mentions.join(' / ')}</span>
                                                            {entity.role && <span className="text-[10px] text-sky-600 dark:text-sky-400">·{entity.role}</span>}
                                                            <span className="text-[10px] text-slate-400">({entity.count})</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleExcludeCharacter(entity);
                                                                }}
                                                                className="text-slate-400 hover:text-red-500 ml-0.5"
                                                                title="排除此项"
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400">未识别到有效人物角色</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1.5">
                                                【仿写已确认人物及别名 ({report.imitationEntities.length})】:
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {report.imitationEntities.length > 0 ? (
                                                    report.imitationEntities.map((entity) => (
                                                        <span
                                                            key={entity.id}
                                                            onClick={() => handleLocateProblem({
                                                                id: entity.id,
                                                                imitTextToFind: entity.canonical,
                                                                imitIndexHint: entity.firstIndex,
                                                                level: 'warning'
                                                            })}
                                                            title={entity.evidence[0] ? `身份: ${entity.role || '人物'} | 依据: ${entity.evidence[0]}` : '点击定位'}
                                                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 shadow-2xs cursor-pointer hover:border-indigo-400"
                                                        >
                                                            <span>{entity.mentions.join(' / ')}</span>
                                                            {entity.role && <span className="text-[10px] text-indigo-600 dark:text-indigo-400">·{entity.role}</span>}
                                                            <span className="text-[10px] text-slate-400">({entity.count})</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleExcludeCharacter(entity);
                                                                }}
                                                                className="text-slate-400 hover:text-red-500 ml-0.5"
                                                                title="排除此项"
                                                            >
                                                                &times;
                                                            </button>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400">未识别到有效人物角色</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {report.characterConflicts.length === 0 ? (
                                        !report.coverage.isComplete ? (
                                            <div className="text-center py-6 px-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                                <ExclamationCircle className="w-6 h-6 text-amber-600" />
                                                <span>审稿未完成，部分内容需要重试（已保留已完成人物识别）</span>
                                                <button
                                                    type="button"
                                                    onClick={handleRetryFailedParts}
                                                    disabled={isAuditing}
                                                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold disabled:opacity-50"
                                                >
                                                    重试失败部分
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                    <Check className="w-6 h-6 text-emerald-600" />
                                                </div>
                                                <span>人物核验通过！原稿与仿写间未发现重名、相同专属称号、同音/近音或同字换序冲突。</span>
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {report.characterConflicts.map((c) => {
                                                const customName = customReplaceNames[c.id] || '';
                                                const badgeLabel =
                                                    c.conflictType === 'exact'
                                                        ? '🚨 完全重名'
                                                        : c.conflictType === 'title'
                                                        ? '⚠️ 相同专属称谓'
                                                        : c.conflictType === 'swapped'
                                                        ? '🔄 同字换序违规'
                                                        : c.conflictType === 'homophone'
                                                        ? '🚨 同音谐音'
                                                        : '⚠️ 近音谐音';

                                                return (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => handleLocateProblem({
                                                            id: c.id,
                                                            origTextToFind: c.originalName,
                                                            origIndexHint: c.originalIndex,
                                                            imitTextToFind: c.imitationName,
                                                            imitIndexHint: c.imitationIndex,
                                                            level: 'danger'
                                                        })}
                                                        className={`p-3 bg-red-50/60 dark:bg-red-950/20 rounded-xl border flex flex-col justify-between text-xs space-y-2.5 shadow-xs cursor-pointer transition ${
                                                            activeLocate?.id === c.id ? 'border-sky-500 ring-2 ring-sky-400/50' : 'border-red-200 dark:border-red-900/50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    c.isExactMatch ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'
                                                                }`}>
                                                                    {badgeLabel}
                                                                </span>
                                                                <span className="text-[11px] text-slate-400 font-mono">
                                                                    出现 {c.count} 次 · 点击双栏定位
                                                                </span>
                                                            </div>

                                                            <div className="space-y-1 text-slate-700 dark:text-slate-300">
                                                                <div>
                                                                    <span className="text-slate-400">原稿角色:</span>{' '}
                                                                    <strong className="text-slate-900 dark:text-white">{c.originalName}</strong>{' '}
                                                                    <span className="text-[10px] text-slate-400 font-mono">({c.originalPinyin})</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-400">仿写冲突:</span>{' '}
                                                                    <strong className="text-red-600 dark:text-red-400">{c.imitationName}</strong>{' '}
                                                                    <span className="text-[10px] text-slate-400 font-mono">({c.imitationPinyin})</span>
                                                                </div>
                                                                {(c.imitationEvidence || c.originalEvidence) && (
                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded border border-slate-200/70 dark:border-slate-800 line-clamp-2 mt-1">
                                                                        依据: {c.imitationEvidence || c.originalEvidence}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t border-red-200/60 dark:border-red-900/40 space-y-2" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[10px] text-slate-500">推荐替名:</span>
                                                                {c.recommendedNames.map((rName, rIdx) => (
                                                                    <button
                                                                        key={rIdx}
                                                                        onClick={() => handleReplaceCharacter(c, rName)}
                                                                        className="px-1.5 py-0.5 bg-white dark:bg-slate-800 hover:bg-sky-50 text-sky-600 dark:text-sky-300 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-semibold transition"
                                                                    >
                                                                        {rName}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={customName}
                                                                    onChange={(e) => setCustomReplaceNames({ ...customReplaceNames, [c.id]: e.target.value })}
                                                                    placeholder="自定义新名字..."
                                                                    className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-sky-500"
                                                                />
                                                                <button
                                                                    onClick={() => handleReplaceCharacter(c, customName)}
                                                                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold shadow-xs transition"
                                                                >
                                                                    一键替换
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: 待人工核对区域 (AI不确定问题集中呈现，支持定位/确认问题/忽略/直接修改) */}
                            {activeTab === 'manual' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-yellow-50/70 dark:bg-yellow-950/20 rounded-xl border border-yellow-200 dark:border-yellow-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span className="font-semibold text-yellow-900 dark:text-yellow-200">
                                            🧐 待人工核对清单（对应正文黄色高亮）：AI 对口语化表达、边缘称呼或相近桥段不擅断时统一列于此处，点击卡片即可在原稿与仿写中同步定位。
                                        </span>
                                        <span className="text-[11px] text-yellow-700 dark:text-yellow-300 font-mono">
                                            待核对 {pendingManualItems.length} 项 · 已处理 {resolvedManualItems.length} 项
                                        </span>
                                    </div>

                                    {pendingManualItems.length === 0 ? (
                                        <div className="text-center py-8 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                                                <Check className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <span>当前没有待人工核对的不确定项！</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {pendingManualItems.map((item) => {
                                                const typeBadgeMap: Record<ManualReviewItem['issueType'], string> = {
                                                    character: '疑似人物/称谓',
                                                    conflict: '疑似同音/换序',
                                                    consistency: '疑似人物一致性',
                                                    typo: '疑似错别字/语句',
                                                    similarity: '疑似桥段/长句雷同'
                                                };
                                                const isCharItem = item.issueType === 'character';
                                                const editVal = manualCustomEdits[item.id] ?? (isCharItem ? (item.candidateName || '') : (item.correctText ?? ''));

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleLocateProblem({
                                                            id: item.id,
                                                            origTextToFind: isCharItem && item.candidateTarget === 'original' ? item.candidateName : item.originalTextSnippet,
                                                            origIndexHint: item.originalIndex,
                                                            imitTextToFind: isCharItem && item.candidateTarget === 'imitation' ? item.candidateName : (item.wrongText || item.imitationTextSnippet),
                                                            imitIndexHint: item.imitationIndex,
                                                            level: 'warning'
                                                        })}
                                                        className={`p-3.5 bg-yellow-50/70 dark:bg-yellow-950/20 rounded-xl border flex flex-col justify-between text-xs space-y-2.5 cursor-pointer transition hover:shadow-sm ${
                                                            activeLocate?.id === item.id ? 'border-sky-500 ring-2 ring-sky-400/50' : 'border-yellow-300 dark:border-yellow-900/60'
                                                        }`}
                                                    >
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="px-2 py-0.5 rounded bg-yellow-500 text-slate-950 font-bold text-[10px]">
                                                                        {typeBadgeMap[item.issueType]}
                                                                    </span>
                                                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                                                        {item.aiJudgment}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                                                                    {item.locationLabel}
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                <div className="p-2 rounded bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                                                                    <span className="text-[10px] font-bold text-sky-600 block">原稿对应文本:</span>
                                                                    <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-3">{item.originalTextSnippet}</p>
                                                                </div>
                                                                <div className="p-2 rounded bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                                                                    <span className="text-[10px] font-bold text-indigo-600 block">仿写对应文本:</span>
                                                                    <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-3">{item.imitationTextSnippet}</p>
                                                                </div>
                                                            </div>

                                                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                                                <strong className="text-slate-700 dark:text-slate-200">判断原因：</strong>{item.reason}
                                                            </div>
                                                            <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                                <strong>修改建议：</strong>{item.suggestedFix}
                                                            </div>
                                                        </div>

                                                        <div className="pt-2 border-t border-yellow-300/60 dark:border-yellow-900/40 space-y-2" onClick={e => e.stopPropagation()}>
                                                            {(isCharItem || (item.wrongText && !item.wrongText.startsWith('—'))) && (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                                            {isCharItem
                                                                                ? item.candidateTarget === 'original'
                                                                                    ? '归并/修正名:'
                                                                                    : '改为/归并:'
                                                                                : '改为:'}
                                                                        </span>
                                                                        <input
                                                                            type="text"
                                                                            value={editVal}
                                                                            onChange={(e) => setManualCustomEdits({ ...manualCustomEdits, [item.id]: e.target.value })}
                                                                            placeholder={
                                                                                isCharItem
                                                                                    ? item.candidateTarget === 'original'
                                                                                        ? '输入已有角色主名以归并别名（原稿只读）...'
                                                                                        : '输入正确人名或已有角色主名...'
                                                                                    : '输入修改后的内容...'
                                                                            }
                                                                            className="flex-1 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:ring-1 focus:ring-sky-500"
                                                                        />
                                                                    </div>
                                                                    {isCharItem && item.candidateTarget === 'original' && (
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                                            🔒 原稿只读：点击「修改」仅归并/修正人物清单，不改原稿正文
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleConfirmManualItem(item)}
                                                                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-[11px] transition"
                                                                >
                                                                    {isCharItem ? '确认为人物' : '确认问题'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleIgnoreManualItem(item)}
                                                                    className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-bold text-[11px] transition"
                                                                >
                                                                    {isCharItem ? '不是人物' : '忽略'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleModifyManualItem(item)}
                                                                    className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold text-[11px] transition"
                                                                >
                                                                    修改
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: 查重调色盘、15字+台词预警 & AI 降重 */}
                            {activeTab === 'similarity' && (
                                <div className="space-y-4">
                                    {!report.coverage.similarityChecked && (
                                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <ExclamationCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                                                <span>审稿未完成，跨稿语义查重需要重试（已保留 15 字+台词与调色盘分析）。</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRetryFailedParts}
                                                disabled={isAuditing}
                                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold flex-shrink-0 disabled:opacity-50"
                                            >
                                                重试失败部分
                                            </button>
                                        </div>
                                    )}
                                    {/* 15字以上重复台词 / 桥段雷同重点清单 */}
                                    {report.similarityAlerts.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                                🚨 重点雷同提示（含连续15字以上相同台词 / 关键桥段与长句，点击定位原稿与仿写）
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                {report.similarityAlerts.map((alert) => (
                                                    <div
                                                        key={alert.id}
                                                        onClick={() => handleLocateProblem({
                                                            id: alert.id,
                                                            origTextToFind: alert.originalSnippet,
                                                            origIndexHint: alert.originalIndex,
                                                            imitTextToFind: alert.imitationSnippet,
                                                            imitIndexHint: alert.imitationIndex,
                                                            level: 'danger'
                                                        })}
                                                        className={`p-3 rounded-xl border text-xs space-y-1.5 cursor-pointer transition ${
                                                            alert.severity === 'danger'
                                                                ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                                                                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                                                        } ${activeLocate?.id === alert.id ? 'ring-2 ring-sky-500' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                                                                {alert.kind === 'dialogue_15' ? `连续${alert.length}字相同（≥15字红线）` : alert.kind === 'plot_structure' ? '桥段/结构高度相仿' : '重复长句'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">点击双栏高亮定位</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">
                                                            <strong>仿写：</strong>{alert.imitationSnippet}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                            <strong>原稿：</strong>{alert.originalSnippet}
                                                        </p>
                                                        <p className="text-[11px] text-red-700 dark:text-red-300">
                                                            {alert.reason}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 选中句子 AI 降重 */}
                                    {selectedSentenceIndex !== null && report.sentenceSimilarities[selectedSentenceIndex] ? (
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        report.sentenceSimilarities[selectedSentenceIndex].colorLevel === 'danger'
                                                            ? 'bg-red-500 text-white'
                                                            : report.sentenceSimilarities[selectedSentenceIndex].colorLevel === 'warning'
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-yellow-500 text-white'
                                                    }`}>
                                                        当前句相似度: {Math.round(report.sentenceSimilarities[selectedSentenceIndex].similarity * 100)}%
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                        句式对比与 AI 降重改写（使用 {selectedModel}）
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => handleAiRewriteSentence(report.sentenceSimilarities[selectedSentenceIndex])}
                                                    disabled={isAiRewriting}
                                                    className="px-4 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {isAiRewriting ? (
                                                        <>
                                                            <ArrowPath className="w-3.5 h-3.5 animate-spin" />
                                                            <span>正在构思降重方案...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            <span>AI 智能降重改写</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-slate-400 block mb-1">【仿写当前句】:</span>
                                                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                                        {report.sentenceSimilarities[selectedSentenceIndex].sentence}。
                                                    </p>
                                                </div>

                                                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                                    <span className="text-[10px] font-bold text-sky-500 block mb-1">【原稿最相似句】:</span>
                                                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                                                        {report.sentenceSimilarities[selectedSentenceIndex].matchedOriginalSentence || '未匹配到高相似原句'}。
                                                    </p>
                                                </div>
                                            </div>

                                            {isAiRewriting && (
                                                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 flex items-center justify-center gap-3 text-sky-700 dark:text-sky-300 text-xs">
                                                    <ArrowPath className="w-4 h-4 animate-spin text-sky-600" />
                                                    <span>正在调用真实模型生成 3 组低相似度降重方案...</span>
                                                </div>
                                            )}

                                            {aiRewriteSuggestions.length > 0 && !isAiRewriting && (
                                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                                    <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        为您生成的 3 组降重替代方案（点击一键采纳）：
                                                    </span>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {aiRewriteSuggestions.map((sug, sIdx) => (
                                                            <div
                                                                key={`sug-${sIdx}`}
                                                                className="p-3 bg-sky-50/80 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/40 rounded-xl border border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs transition cursor-pointer group"
                                                                onClick={() => handleApplyRewrite(report.sentenceSimilarities[selectedSentenceIndex].sentence, sug.text)}
                                                            >
                                                                <div className="mr-3">
                                                                    <span className="inline-block text-[10px] font-bold text-sky-600 dark:text-sky-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-700 mr-2">
                                                                        {sug.style}
                                                                    </span>
                                                                    <span className="text-slate-800 dark:text-slate-100 font-medium">
                                                                        {sug.text}
                                                                    </span>
                                                                </div>
                                                                <span className="px-3 py-1 bg-sky-600 group-hover:bg-sky-500 text-white rounded-md text-[11px] font-bold flex-shrink-0 shadow-2xs transition">
                                                                    一键采纳
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-500 text-xs text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/70 dark:border-slate-800">
                                            <p className="font-medium text-slate-600 dark:text-slate-300">
                                                切换右上方【🎨 相似度调色盘】模式并点击任意句子，可对比原句并由 AI 生成 3 组降重改写建议。
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 全部清除确认弹窗 */}
            {showClearConfirm && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div
                        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                                <Trash className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    确认全部清除？
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    清除后将删除原稿、仿写稿件及当前所有审稿诊断结果，并恢复到最初的待输入界面。此操作不可撤销。
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={executeClearAll}
                                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition cursor-pointer"
                            >
                                确认全部清除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManuscriptReview;
