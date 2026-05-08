
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Script, Scene, ScriptSettings, Workflow, Asset, Prompt, PromptCategory, PromptSubCategory } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, Database, Play, Pencil, X, Stop, ChevronDown, ChevronUp, Workflow as WorkflowIcon, ChatBubbleOvalLeftEllipsis, DocumentArrowDown, UserCircle, Fire, Plus, InformationCircle, Box, Copy, Trash, Heart, Search, CloudArrowUp, Settings, BookOpen } from '../Icon';
import WritingToolbar, { ToolbarAction } from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, fetchMaterials, incrementWorkflowUsage, fetchWorkflows, fetchPrompts, getCurrentUserId, saveScriptWorkflowState, fetchScriptWorkflowState, deleteScriptWorkflowState, incrementPromptHeat, fetchWorkflowFavorites } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';
import CustomSelect from '../CustomSelect';
import { generateTextStream } from '../../services/geminiService';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';
import { GENRE_TAGS } from '../../constants';
import ScriptAIPanel from './ScriptAIPanel'; // Import AI Panel
import PromptSelectionModal from '../PromptSelectionModal';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

const NO_MARKDOWN_INSTRUCTION = "\n\n【重要指令】：请以纯文本格式输出剧本，严禁使用Markdown格式（如 **加粗**、# 标题 等）。请直接按剧本格式输出场景、动作和对白。";
const FORCE_LONG_INSTRUCTION = "\n\n【专业创作指令】：\n1. **深度扩写模式**：请采用“分层迭代生成”策略。不要概括情节，而是通过大量的细节描写（环境烘托、动作拆解、心理独白、感官体验）来丰富内容。如果用户要求长篇幅，请务必通过极其细腻的描写来达到字数要求，严禁敷衍或提前收尾。\n2. **字数突破**：请充分利用输出长度限制，将每一个细小的动作和心理变化都展开撰写，确保单次输出尽可能充实且逻辑严密。\n3. **剧本格式**：请直接按剧本格式输出场景、动作和对白，严禁使用Markdown格式（如 **加粗**、# 标题 等）。\n4. **逻辑一致性**：严格遵循前文设定的角色性格、世界观和逻辑。";

const WORKFLOW_CATEGORIES: { id: string; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'short-story', label: '短篇' },
    { id: 'long-story', label: '长篇' },
    { id: 'script', label: '剧本' },
    { id: 'general', label: '通用' },
];

// Helper to strip markdown
const stripMarkdown = (text: string) => {
    return text
        .replace(/#+\s/g, '')
        .replace(/\*\*|\*/g, '')
        .replace(/>\s/g, '')
        .replace(/`{1,3}.*?`{1,3}/gs, '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim();
};

// Editable Content Component for each step
const EditableStepContent: React.FC<{
    initialContent: string;
    onSave: (newContent: string) => void;
    onContextMenu: (e: React.MouseEvent, text: string, fullText: string) => void;
}> = ({ initialContent, onSave, onContextMenu }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Initial render formatting helper (simple HTML conversion)
    const formatInitial = (text: string) => {
        const clean = stripMarkdown(text.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
        // Reduce excessive newlines
        const normalized = clean.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return normalized.split('\n').map(line => {
            const trimmed = line.trim();
            if(!trimmed) return '<div class="mb-1"><br/></div>'; // Reduced margin from mb-2 to mb-1
            return `<div class="mb-1">${trimmed}</div>`; // Reduced margin from mb-2 to mb-1
        }).join('');
    };

    useEffect(() => {
        if (editorRef.current) {
             editorRef.current.innerHTML = formatInitial(initialContent);
        }
    }, []); // Only runs once on mount for editing

    const handleBlur = () => {
        if (editorRef.current) {
            onSave(editorRef.current.innerText);
        }
    };

    const handleRightClick = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text) {
            e.preventDefault();
            onContextMenu(e, text, editorRef.current?.innerText || initialContent);
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onContextMenu={handleRightClick}
            className="whitespace-pre-wrap font-sans leading-relaxed text-sm outline-none focus:bg-yellow-50/10 transition-colors p-2 rounded min-h-[50px] max-w-none text-gray-800 dark:text-gray-200"
        />
    );
};

// Streaming Text Component - optimized for updates
const StreamingText: React.FC<{ text: string; isGenerating: boolean }> = ({ text, isGenerating }) => {
    return (
        <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-200 leading-relaxed text-sm p-2 relative">
            {stripMarkdown(text)}
            {isGenerating && (
                <span className="inline-flex items-center ml-2 text-sky-500 align-middle">
                    <ArrowPath className="w-4 h-4 animate-spin" />
                </span>
            )}
            {!isGenerating && text && (
                 <div className="mt-4 mb-2 text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1 animate-fade-in">
                    <Check className="w-3.5 h-3.5" /> 生成完成
                 </div>
            )}
        </div>
    );
};

const MODEL_OPTIONS = [
    { value: "deepseek-chat", label: "奇思版 (DeepSeek V3)" },
    { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3 Flash)" },
    { value: "gemini-3.1-pro-preview", label: "进阶版 (Gemini 3 Pro)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

const LANGUAGE_OPTIONS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "英文" }
];

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇', 'short-story': '短篇', 'script': '剧本', 'general': '通用',
};

const getGenreLabel = (id: string) => {
    const found = GENRE_TAGS.find(g => g.id === id);
    return found ? found.label : id;
};

const ContextMenu: React.FC<{
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    onAction: (action: 'polish' | 'expand' | 'ask' | 'rewrite-auto' | 'rewrite-req') => void;
}> = ({ x, y, visible, onClose, onAction }) => {
    if (!visible) return null;

    return createPortal(
        <div 
            className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[140px] animate-fade-in"
            style={{ top: y, left: x }}
            onMouseLeave={onClose}
            onClick={(e) => e.stopPropagation()}
        >
            <button onClick={() => { onAction('ask'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <ChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" /> 智能追问
            </button>
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase">AI 改写</div>
            <button onClick={() => { onAction('rewrite-auto'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <ArrowPath className="w-3.5 h-3.5" /> 一键重新生成
            </button>
            <button onClick={() => { onAction('rewrite-req'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> 输入要求重写
            </button>
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
            <button onClick={() => { onAction('polish'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> 润色
            </button>
            <button onClick={() => { onAction('expand'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> 扩写
            </button>
        </div>,
        document.body
    );
};

const FormattedText = ({ text }: { text: string }) => {
    if (!text) return null;
    return <div className="whitespace-pre-wrap break-words text-sm tracking-wide leading-7">{text}</div>;
};

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    // Core Data
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isScriptLoading, setIsScriptLoading] = useState(true);
    
    // Setup State - Updated Defaults
    const [settings, setSettings] = useState<ScriptSettings>({
        format: 'live_action',
        totalEpisodes: '40', // Updated Default
        outputLanguage: 'zh',
        model: 'deepseek-chat'
    });

    // Model Config State
    const [temperature, setTemperature] = useState(1);
    const [topP, setTopP] = useState(0.95);
    const [maxOutputTokens, setMaxOutputTokens] = useState(8192);
    const [showModelConfig, setShowModelConfig] = useState(false);
    
    // Generation Mode & State
    const [generationMode, setGenerationMode] = useState<'workflow' | 'prompt'>('workflow');
    
    // Workflow State
    const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [workflowFormState, setWorkflowFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({});
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [visibleStepIndex, setVisibleStepIndex] = useState<number>(-1);
    const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

    const [executedWorkflow, setExecutedWorkflow] = useState<Workflow | null>(null);
    const [executedPrompt, setExecutedPrompt] = useState<Prompt | null>(null);

    // Prompt Mode State
    const [promptInput, setPromptInput] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [promptFormState, setPromptFormState] = useState<Record<string, string>>({});
    const [promptResultText, setPromptResultText] = useState('');

    // Asset Selection
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false);
    const [isPromptSelectionModalOpen, setIsPromptSelectionModalOpen] = useState(false);

    // Workflow Modal specific states
    const [workflowCategory, setWorkflowCategory] = useState<string>('all');
    const [workflowGenre, setWorkflowGenre] = useState<string>('all');
    const [workflowSearch, setWorkflowSearch] = useState('');
    const [workflowFavorites, setWorkflowFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // UI State
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(true); // Changed default to true
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('正在处理...');
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [isSourceAssetModalOpen, setIsSourceAssetModalOpen] = useState(false);

    const handleSourceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            setScript(prev => ({ ...prev, sourceContent: content }));
            if (script.id) {
                await updateProject(script.id, { source_content: content });
            }
        };
        reader.readAsText(file);
    }, [script.id]);

    const handleSelectSourceAsset = useCallback(async (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            const content = asset.content;
            setScript(prev => ({ ...prev, sourceContent: content, sourceAssetId: assetId }));
            if (script.id) {
                await updateProject(script.id, { 
                    source_content: content,
                    source_asset_id: assetId 
                });
            }
        }
        setIsSourceAssetModalOpen(false);
    }, [assets, script.id]);
    
    // Editor State
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string; fullText: string; stepVar?: string }>({ x: 0, y: 0, visible: false, text: '', fullText: '', stepVar: '' });
    const [aiTrigger, setAiTrigger] = useState<{ type: 'polish' | 'expand' | 'ask', text: string } | null>(null);
    
    const [followUpModal, setFollowUpModal] = useState<{ open: boolean; targetText: string; context: string; stepVar: string; rewriteMode?: boolean }>({
        open: false, targetText: '', context: '', stepVar: '', rewriteMode: false
    });

    // Title editing state
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(script.title);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const dbSaveTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastStepPromptsRef = useRef<Record<string, string>>({});
    const lastPromptRef = useRef<string>('');

    const filteredWorkflows = useMemo(() => {
        return availableWorkflows.filter(wf => {
            const matchesCategory = workflowCategory === 'all' || wf.category === workflowCategory || (workflowCategory === 'script' && wf.category === 'script');
            const matchesGenre = workflowGenre === 'all' || (wf.subCategories && wf.subCategories.includes(workflowGenre as PromptSubCategory));
            const matchesSearch = !workflowSearch || wf.title.toLowerCase().includes(workflowSearch.toLowerCase());
            const matchesFavorite = !showFavoritesOnly || workflowFavorites.has(wf.id);
            return matchesCategory && matchesSearch && matchesFavorite && matchesGenre;
        });
    }, [availableWorkflows, workflowCategory, workflowGenre, workflowSearch, showFavoritesOnly, workflowFavorites]);

    useEffect(() => {
        if (isWorkflowModalOpen) {
            fetchWorkflowFavorites().then(ids => setWorkflowFavorites(new Set(ids)));
        }
    }, [isWorkflowModalOpen]);

    const saveCurrentState = useCallback(async () => {
        if (!script.id) return;
        setSaveStatus('saving');
        try {
            if (selectedWorkflow || Object.keys(stepResults).length > 0 || promptResultText || selectedPrompt) {
                await saveScriptWorkflowState(
                    script.id,
                    selectedWorkflow?.id,
                    workflowFormState,
                    stepResults,
                    visibleStepIndex,
                    selectedPrompt?.id,
                    promptFormState,
                    promptResultText,
                    generationMode
                );
            }
            setSaveStatus('saved');
        } catch (e) {
            console.error("Save failed", e);
            setSaveStatus('error');
        }
    }, [script.id, selectedWorkflow?.id, workflowFormState, stepResults, visibleStepIndex, selectedPrompt?.id, promptFormState, promptResultText, generationMode]);

    const persistState = useCallback(() => {
        if (!script.id) return;
        if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current);
        setSaveStatus('saving');
        dbSaveTimeoutRef.current = setTimeout(() => {
            saveCurrentState();
        }, 1500); 
    }, [saveCurrentState]);

    useEffect(() => { persistState(); }, [persistState]);

    useEffect(() => {
        if (scrollContainerRef.current && isGenerating) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
            
            if (isNearBottom) {
                scrollContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
            }
        }
    }, [stepResults, visibleStepIndex, promptResultText, isGenerating]);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsScriptLoading(true);
            const uid = await getCurrentUserId();
            setCurrentUserId(uid);
            const data = await fetchChapters(script.id);
            if (data) {
               setScript(prev => ({ ...prev, scenes: data.map((c: any) => ({ id: c.id, title: c.title, content: '', isContentLoaded: false })) }));
               let loadedData: any = script.scriptData;
               if (loadedData && loadedData.settings) setSettings(loadedData.settings);
            }
            const userAssets = await fetchMaterials();
            setAssets(userAssets.map((item: any) => ({ id: item.id, name: item.name || item.title, type: item.type === 'idea' ? 'inspiration' : item.type, content: item.content, tags: item.tags || [] })));

            const workflowsData = await fetchWorkflows({ category: 'all' });
            const promptsResponse = await fetchPrompts({ category: 'all' });
            let mappedWorkflows: Workflow[] = [];
            let mappedPrompts: Prompt[] = [];
            
            if (workflowsData) {
                mappedWorkflows = workflowsData.map((wf: any) => {
                    let content: any = {};
                    try { content = typeof wf.content === 'string' ? JSON.parse(wf.content) : wf.content; } catch(e) {}
                    return {
                        id: wf.id,
                        title: wf.title,
                        description: wf.description,
                        usageCount: wf.usage_count || 0,
                        heat: wf.usage_count || 0,
                        author: wf.profiles?.username || (wf.user_id === uid ? '我' : '匿名'),
                        userId: wf.user_id,
                        category: wf.main_category,
                        subCategories: wf.sub_categories || [],
                        fields: content?.fields || [],
                        steps: content?.steps || [],
                        createdAt: wf.created_at
                    };
                });
                setAvailableWorkflows(mappedWorkflows);
            }

            if (promptsResponse && Array.isArray(promptsResponse)) {
                mappedPrompts = promptsResponse.map((p: any) => {
                    let content: any = {};
                    try { content = typeof p.content === 'string' ? JSON.parse(p.content) : p.content; } catch(e) {}
                    return {
                        id: p.id,
                        title: p.title,
                        description: p.description,
                        content: p.content,
                        template: content.template || '',
                        fields: content.fields || [],
                        category: p.main_category,
                        subCategories: p.sub_category ? [p.sub_category as any] : [],
                        heat: p.usage_count || 0,
                        creator: p.user_id === uid ? ('user' as const) : ('system' as const),
                        userId: p.user_id,
                        authorName: p.profiles?.username || (p.user_id === uid ? '我' : '匿名'),
                        createdAt: p.created_at
                    };
                });
            }

            const savedState = await fetchScriptWorkflowState(script.id);
            if (savedState) {
                const fState = savedState.form_state || {};
                const sResults = savedState.step_results || {};

                // Restore Generation Mode
                if (fState.__generation_mode) {
                    setGenerationMode(fState.__generation_mode);
                }

                // Restore Workflow state
                if (savedState.workflow_id) {
                    const wf = mappedWorkflows.find(w => w.id === savedState.workflow_id);
                    if (wf) {
                        setSelectedWorkflow(wf);
                        setExecutedWorkflow(wf);
                    }
                }
                
                // Restore Prompt state
                if (fState.__selected_prompt_id) {
                    const p = mappedPrompts.find(pr => pr.id === fState.__selected_prompt_id);
                    if (p) {
                        setSelectedPrompt(p);
                        setExecutedPrompt(p);
                    }
                }
                setPromptFormState(fState.__prompt_form || {});
                setPromptResultText(sResults.__prompt_result || '');
                // Filter out internal fields for Workflow state
                const cleanWFForm = { ...fState };
                delete cleanWFForm.__prompt_form;
                delete cleanWFForm.__selected_prompt_id;
                delete cleanWFForm.__generation_mode;
                setWorkflowFormState(cleanWFForm);
                
                const cleanStepResults = { ...sResults };
                delete cleanStepResults.__prompt_result;
                setStepResults(cleanStepResults);
                
                setVisibleStepIndex(savedState.visible_index ?? -1);
            }
            setIsScriptLoading(false);
        };
        loadInitialData();
    }, [script.id]);

    const handleBack = async () => {
        // Clear timeout to prevent saving
        if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current);
        // Save state before exit
        await saveCurrentState();
        onBack();
    };

    const handleWorkflowChange = (wf: Workflow) => {
        setSelectedWorkflow(wf);
        if (Object.keys(workflowFormState).length === 0) {
             const initial: Record<string, string> = {};
             wf.fields?.forEach(f => { initial[f.variable] = ''; });
             setWorkflowFormState(initial);
        }
    };

    const handlePromptChange = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        const initial: Record<string, string> = {};
        prompt.fields?.forEach(f => { initial[f.id] = ''; });
        setPromptFormState(initial);
    };

    // New Helper: Handle File Input
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string, isWorkflow: boolean) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const readers = files.map((f: any) => { // 'file' here is inferred as File
                const file = f as File;
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        resolve(`【文件: ${file.name}】\n${ev.target?.result as string}\n`);
                    };
                    reader.readAsText(file);
                });
            });

            Promise.all(readers).then(contents => {
                const combinedContent = contents.join('\n');
                if (isWorkflow) {
                    setWorkflowFormState(prev => ({
                        ...prev,
                        [fieldId]: (prev[fieldId] || '') + combinedContent
                    }));
                } else {
                    setPromptFormState(prev => ({
                        ...prev,
                        [fieldId]: (prev[fieldId] || '') + combinedContent
                    }));
                }
            });
        }
    };

    const runStepGeneration = async (stepIndex: number, context: Record<string, string>, assetContext: string, basicInfo: string, isContinue = false) => {
        // Use executedWorkflow if set, otherwise fallback to selectedWorkflow
        const activeWorkflow = executedWorkflow || selectedWorkflow;
        if (!activeWorkflow || !activeWorkflow.steps) return;
        const step = activeWorkflow.steps[stepIndex];
        
        const controller = new AbortController(); 
        abortControllerRef.current = controller;
        setIsGenerating(true);
        setGenerationError(null);
        setCurrentStepIndex(stepIndex);
        
        // STRICTLY sequential visibility: only reveal up to current step
        setVisibleStepIndex(stepIndex);

        try {
            let finalPrompt = '';
            
            // Generate context from PREVIOUS steps for continuity
            let prevStepsContext = '';
            if (activeWorkflow && activeWorkflow.steps) {
                const prevSteps = activeWorkflow.steps.slice(0, stepIndex);
                if (prevSteps.length > 0) {
                    prevStepsContext = "【创作背景 - 前序章节回顾】\n" + prevSteps.map(s => {
                        const res = stepResults[s.outputVariable];
                        if (!res) return '';
                        // Take the last 800 chars of each previous step to maintain context without exceeding token limits
                        return `--- ${s.name} (已完成) ---\n${res.length > 800 ? '...' + res.slice(-800) : res}\n`;
                    }).filter(Boolean).join('\n') + "\n";
                }
            }

            if (isContinue) {
                const currentResult = stepResults[step.outputVariable] || '';
                const tail = currentResult.slice(-3000);
                const originalPrompt = lastStepPromptsRef.current[step.outputVariable] || '';
                
                finalPrompt = `【原始创作任务】：
${originalPrompt}

【已生成内容末尾】：
...${tail}

【续写指令】：
请严格基于【原始创作任务】的要求，紧接着【已生成内容末尾】处开始无缝续写。
要求：
1. 请确保生成的剧情、人设、台词风格与【已生成内容末尾】完美衔接。
2. 严禁重复上文内容，严禁从头开始。
3. 保持与上文完全一致的剧本格式、风格和逻辑。
4. 直接输出续写内容，不要有任何开场白。

${FORCE_LONG_INSTRUCTION}`;
            } else {
                let prompt = step.prompt;
                Object.keys(context).forEach(key => { prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), context[key] || ''); });
                
                // Prepend continuity context to ensure format and content consistency
                const continuityInstruction = prevStepsContext ? `
【连贯性要求】：
当前正在生成剧本的下一部分。请务必参考下方的【创作背景】，确保：
1. 人物性格、语言风格、场景逻辑与前文保持高度一致。
2. 严格延续前文使用的剧本排版格式（如：场景号、对白缩进等）。
3. 剧情紧接上文，不要出现跳跃或逻辑断裂。

${prevStepsContext}
` : '';

                const corePrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${continuityInstruction}${prompt}`;
                finalPrompt = `${corePrompt}${FORCE_LONG_INSTRUCTION}`;
                lastStepPromptsRef.current[step.outputVariable] = corePrompt;
            }

            let stepOutput = isContinue ? (stepResults[step.outputVariable] || '') : '';
            const stream = generateTextStream(finalPrompt, { model: settings.model, temperature, topP, maxOutputTokens, signal: controller.signal });
            
            for await (const chunk of stream) { 
                stepOutput += chunk; 
                setStepResults(prev => ({ ...prev, [step.outputVariable]: stepOutput })); 
            }
            return stepOutput;
        } catch (e: any) {
            console.error(e);
            setGenerationError(e.message || String(e));
            throw e;
        } finally {
            setIsGenerating(false);
            setCurrentStepIndex(null);
        }
    };

    const handleRunGeneration = async (startFromIndex?: number, isContinue = false) => {
        if (isGenerating && !isContinue) { handleStop(); return; }
        
        // Prepare contexts
        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
        // Updated Basic Info Construction
        const basicInfo = `【剧本基础信息】\n总集数：${settings.totalEpisodes}\n输出语言：${settings.outputLanguage === 'zh' ? '中文' : '英文'}\n\n`;

        // Use executedWorkflow or fallback to selectedWorkflow
        const activeWorkflow = executedWorkflow || selectedWorkflow;

        if (generationMode === 'workflow') {
            if (!activeWorkflow || !activeWorkflow.steps) return;
            // Lock in the workflow for execution if not already
            if (!executedWorkflow && selectedWorkflow) {
                setExecutedWorkflow(selectedWorkflow);
            }

            let startStepIndex = 0;
            if (typeof startFromIndex === 'number') {
                startStepIndex = startFromIndex;
            } else if (isContinue) {
                startStepIndex = Math.max(0, visibleStepIndex);
            } else {
                // If regenerating (no index provided), force reset state
                if (!isContinue) {
                    setStepResults({});
                    setVisibleStepIndex(-1);
                }
            }

            let currentContext: Record<string, string> = { ...workflowFormState };
            
            // Hydrate context with previous results if resuming/partial run
            activeWorkflow.steps.forEach((s, idx) => { 
                if (idx < startStepIndex && stepResults[s.outputVariable]) currentContext[s.outputVariable] = stepResults[s.outputVariable]; 
            });

            try {
                if (startStepIndex === 0) incrementWorkflowUsage(activeWorkflow.id);
                
                // If continuing specific step (usually the last visible one)
                if (isContinue) {
                     await runStepGeneration(startStepIndex, currentContext, assetContext, basicInfo, true);
                     return; 
                }

                // Normal sequential flow
                for (let i = startStepIndex; i < activeWorkflow.steps.length; i++) {
                    if (abortControllerRef.current?.signal.aborted) break;
                    
                    const output = await runStepGeneration(i, currentContext, assetContext, basicInfo);
                    if (output) currentContext[activeWorkflow.steps[i].outputVariable] = output;
                }
            } catch (e) { console.error(e); }

        } else {
            // Prompt Mode Logic (Existing)
            setExecutedPrompt(selectedPrompt);
            
            let promptText = selectedPrompt ? (selectedPrompt.template || selectedPrompt.content) : promptInput;
            
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                Object.keys(promptFormState).forEach(key => {
                    promptText = promptText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), promptFormState[key] || '');
                });
            }

            let finalPrompt = '';
            if (isContinue) {
                const tail = promptResultText.slice(-3000);
                const originalPrompt = lastPromptRef.current;
                finalPrompt = `【原始创作任务】：
${originalPrompt}

【已生成内容末尾】：
...${tail}

【续写指令】：
请严格基于【原始创作任务】的要求，紧接着【已生成内容末尾】处开始无缝续写。
要求：
1. 请确保生成的剧情、人设、台词风格与【已生成内容末尾】完美衔接。
2. 严禁重复上文内容，严禁从头开始。
3. 保持与上文完全一致的剧本格式、风格和逻辑。
4. 直接输出续写内容，不要有任何开场白。

${FORCE_LONG_INSTRUCTION}`;
            } else {
                const corePrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${promptText}`;
                finalPrompt = `${corePrompt}${FORCE_LONG_INSTRUCTION}`;
                lastPromptRef.current = corePrompt;
                setPromptResultText('');
            }

            setIsGenerating(true);
            setGenerationError(null);
            const controller = new AbortController();
            abortControllerRef.current = controller;

            try {
                const stream = generateTextStream(finalPrompt, { model: settings.model, temperature, topP, maxOutputTokens, signal: controller.signal });
                for await (const chunk of stream) { 
                    setPromptResultText(prev => prev + chunk); 
                }
            } catch (e: any) { 
                console.error(e); 
                setGenerationError(e.message || String(e));
            } finally { setIsGenerating(false); }
        }
    };

    const handleStop = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); setIsGenerating(false); setCurrentStepIndex(null); };

    const handleDownloadWord = (content: string, title: string) => {
        const plainText = stripMarkdown(content);
        
        const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>${title}</title>
            <style>
                body { font-family: 'Songti SC', 'SimSun', serif; font-size: 12pt; line-height: 1.5; }
                div { margin-bottom: 0.5em; }
            </style>
            </head><body>
            ${plainText.split('\n').map(line => {
                const l = line.trim();
                if(!l) return '<p><br/></p>';
                if(/^(EXT\.|INT\.|内景|外景|场景)/i.test(l)) return `<p style="font-weight:bold; background:#f0f0f0; padding:5px;">${l}</p>`;
                if(/^[A-Z\u4e00-\u9fa5]+(\s*\(.*?\))?：/.test(l)) return `<p style="font-weight:bold;">${l}</p>`;
                return `<p>${l}</p>`;
            }).join('')}
            </body></html>
        `;
        
        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.doc`; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStepContentChange = (stepVar: string, newContent: string) => {
        setStepResults(prev => ({ ...prev, [stepVar]: newContent }));
    };

    const handleAiRewrite = async (targetText: string, fullText: string, requirements?: string, stepVar?: string) => {
        if (isGenerating) return;
        setIsGenerating(true);
        setGenerationError(null);
        
        // Find context
        const index = fullText.indexOf(targetText);
        const before = fullText.slice(Math.max(0, index - 1000), index);
        const after = fullText.slice(index + targetText.length, index + targetText.length + 1000);

        const prompt = `【原始任务背景】：
${lastPromptRef.current || (stepVar ? lastStepPromptsRef.current[stepVar] : '')}

【上下文 - 前文】：
...${before}

【待改写片段】：
${targetText}

【上下文 - 后文】：
${after}...

【改写指令】：
${requirements ? `请根据以下补充要求改写【待改写片段】：\n${requirements}` : '请直接重新生成【待改写片段】，使其表达更生动、情节更精彩，并确保与前文和后文衔接自然。'}
要求：
1. 直接输出改写后的内容，不要有任何废话或解释。
2. 保持与全文一致的剧本格式和风格。

${FORCE_LONG_INSTRUCTION}`;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        let result = '';
        try {
            const stream = generateTextStream(prompt, { model: settings.model, temperature: 0.8, topP: 0.95, maxOutputTokens: 8192, signal: controller.signal });
            for await (const chunk of stream) {
                result += chunk;
            }
            
            // Apply replacement
            if (stepVar) {
                setStepResults(prev => ({
                    ...prev,
                    [stepVar]: prev[stepVar].replace(targetText, result)
                }));
            } else if (generationMode === 'prompt') {
                setPromptResultText(prev => prev.replace(targetText, result));
            }
        } catch (e: any) {
            console.error(e);
            setGenerationError(e.message || String(e));
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const handleContextMenuAction = (action: 'polish' | 'expand' | 'ask' | 'rewrite-auto' | 'rewrite-req') => {
        if (!contextMenu.text) return;

        if (action === 'ask' || action === 'rewrite-req') {
            setFollowUpModal({
                open: true,
                targetText: contextMenu.text,
                context: contextMenu.fullText,
                stepVar: contextMenu.stepVar || '',
                rewriteMode: action === 'rewrite-req'
            });
        } else if (action === 'rewrite-auto') {
            handleAiRewrite(contextMenu.text, contextMenu.fullText, undefined, contextMenu.stepVar);
        } else {
            setAiTrigger({ type: action, text: contextMenu.text });
            setRightSidebarOpen(true);
        }
    };

    const handleFollowUpApply = (newText: string, type: 'insert' | 'replace') => {
        if (followUpModal.stepVar) {
             setStepResults(prev => {
                const currentContent = prev[followUpModal.stepVar] || '';
                let updatedContent = currentContent;
                if (type === 'replace' && followUpModal.targetText) {
                    updatedContent = currentContent.replace(followUpModal.targetText, newText);
                } else {
                    updatedContent = currentContent + '\n\n' + newText;
                }
                return { ...prev, [followUpModal.stepVar]: updatedContent };
            });
        } else if (generationMode === 'prompt') {
             setPromptResultText(prev => prev + '\n\n' + newText);
        } else {
            navigator.clipboard.writeText(newText);
            alert("结果已复制到剪贴板。");
        }
    };

    const handleInsertToScript = (text: string) => {
        if (generationMode === 'prompt') {
             setPromptResultText(prev => prev + '\n' + text);
        } else {
             navigator.clipboard.writeText(text);
             alert('已复制到剪贴板，请手动粘贴到目标位置');
        }
    };

    const handleToolbarAction = (action: ToolbarAction) => {
        if (['bold', 'italic'].includes(action)) {
            document.execCommand(action);
        } else if (action === 'copy') {
            const activeWF = executedWorkflow || selectedWorkflow;
            const allText = generationMode === 'workflow' 
                ? activeWF?.steps?.map(s => stepResults[s.outputVariable]).filter(Boolean).join('\n\n')
                : promptResultText;
            
            if (allText) {
                navigator.clipboard.writeText(allText);
                alert('全文已复制到剪贴板');
            } else {
                alert('各章节/提示词暂无生成内容可供复制');
            }
        }
    };

    const handleTitleSave = async () => {
        setScript(p => ({...p, title: tempTitle}));
        await updateProject(script.id, { title: tempTitle });
        setIsEditingTitle(false);
    };

    // --- Render ---

    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 font-sans w-[320px] relative">
            
            {/* Fixed Header for Alignment */}
            <div className="flex-shrink-0 h-12 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <span className="text-sm font-black text-sky-700 dark:text-sky-200 flex items-center gap-2">
                    <AdjustmentsHorizontal className="w-4 h-4 text-sky-500" /> 创作配置
                </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-6">
                {/* 1. Model Configuration */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2">
                            1. 模型
                        </h3>
                        <button 
                            onClick={() => setShowModelConfig(!showModelConfig)} 
                            className={`text-xs font-bold px-2 py-1 rounded transition-colors ${showModelConfig ? 'bg-sky-100 text-sky-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        >
                            参数
                        </button>
                    </div>
                    <div className="pl-1 space-y-3">
                        <div>
                            <CustomSelect value={settings.model} onChange={(v) => setSettings(s => ({...s, model: v}))} options={MODEL_OPTIONS} className="z-50" />
                        </div>
                        {showModelConfig && (
                            <div className="p-3 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800 space-y-3 animate-fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex justify-between"><span>随机度 (Temperature): {temperature}</span></label>
                                    <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                    <p className="text-[9px] text-gray-400 mt-0.5">控制创造性：值越高越发散（适合创意），值越低越严谨（适合逻辑）。</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex justify-between"><span>核采样 (Top P): {topP}</span></label>
                                    <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                    <p className="text-[9px] text-gray-400 mt-0.5">控制词汇多样性：降低该值可减少偏门词汇的出现。</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-sky-600 dark:text-sky-400 flex justify-between"><span>最大长度 (Tokens): {maxOutputTokens}</span></label>
                                    <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-500" />
                                    <p className="text-[9px] text-gray-400 mt-0.5">限制单次请求生成的最大文本量（包括标点和换行）。</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Basic Info - Updated Labels and Defaults handled in State */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2">2. 基础信息</h3>
                    <div className="grid grid-cols-2 gap-3 pl-1">
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-400">总集数</label><input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none" /></div>
                        <div className="space-y-1"><label className="text-xs font-bold text-gray-400">语言</label><div className="relative z-40"><CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} /></div></div>
                    </div>
                </div>

                {/* 3. Generation Mode Config */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-sky-600 dark:text-sky-400 flex items-center gap-2">3. 创作配置</h3>
                    
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setGenerationMode('workflow')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${generationMode === 'workflow' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            工作流模式
                        </button>
                        <button 
                            onClick={() => setGenerationMode('prompt')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${generationMode === 'prompt' ? 'bg-white dark:bg-gray-700 text-sky-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            提示词模式
                        </button>
                    </div>

                    <div className="space-y-4 pl-1">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">关联素材</label>
                            <button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-xl border border-dashed text-xs transition-all text-left flex justify-between items-center group ${selectedAssetIds.size > 0 ? 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:border-sky-300'}`}>
                                <span className="truncate font-bold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '选择角色/剧情/世界观...'}</span>
                                <Database className={`w-4 h-4 group-hover:scale-110 transition-transform ${selectedAssetIds.size > 0 ? 'text-sky-500' : 'text-gray-400'}`} />
                            </button>
                        </div>

                        {generationMode === 'workflow' ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">选择工作流</label>
                                    <button onClick={() => setWorkflowModalOpen(true)} className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedWorkflow ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-sky-300'}`}>
                                        <span className="truncate font-bold">{selectedWorkflow ? selectedWorkflow.title : '选择生成流程...'}</span>
                                        <ChevronDown className={`w-4 h-4 ${selectedWorkflow ? 'text-sky-500' : 'text-gray-400'}`} />
                                    </button>
                                </div>
                                {selectedWorkflow && selectedWorkflow.fields && selectedWorkflow.fields.length > 0 && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="flex justify-between items-center pb-2">
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 参数填写</span>
                                            <button onClick={() => { setSelectedWorkflow(null); setWorkflowFormState({}); }} className="text-xs text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                        </div>
                                        {selectedWorkflow.fields.map((field) => (
                                            <div key={field.id} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block">
                                                        {field.label}
                                                        {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                                    </label>
                                                    {field.maxLength && <span className={`text-[9px] ${(workflowFormState[field.variable]?.length || 0) > field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>{workflowFormState[field.variable]?.length || 0}/{field.maxLength}</span>}
                                                </div>
                                                {field.type === 'file' ? (
                                                    <div className="w-full">
                                                        <input 
                                                            type="file"
                                                            multiple
                                                            accept=".txt,.md,.json,.csv"
                                                            onChange={(e) => handleFileChange(e, field.variable, true)}
                                                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 transition-colors"
                                                        />
                                                        {workflowFormState[field.variable] && (
                                                            <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 truncate pl-2">
                                                                已加载 {workflowFormState[field.variable].length} 字符
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : field.type === 'textarea' ? <textarea value={workflowFormState[field.variable] || ''} onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none h-24 resize-y" placeholder={field.description || `请输入${field.label}...`} maxLength={field.maxLength} /> : <input type="text" value={workflowFormState[field.variable] || ''} onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none" placeholder={field.description || `请输入${field.label}...`} maxLength={field.maxLength} />}
                                                {field.description && (
                                                    <p className="text-[9px] text-sky-500 dark:text-sky-400 flex items-start gap-1 leading-tight mt-0.5">
                                                        <InformationCircle className="w-3 h-3 shrink-0" />
                                                        {field.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">选择提示词</label>
                                    <button onClick={() => setIsPromptSelectionModalOpen(true)} className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedPrompt ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-sky-300'}`}>
                                        <span className="truncate font-bold">{selectedPrompt ? selectedPrompt.title : '选择提示词模板...'}</span>
                                        <Box className={`w-4 h-4 ${selectedPrompt ? 'text-sky-500' : 'text-gray-400'}`} />
                                    </button>
                                </div>

                                {selectedPrompt ? (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="flex justify-between items-center pb-2">
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 模板参数</span>
                                            <button onClick={() => { setSelectedPrompt(null); setPromptFormState({}); }} className="text-xs text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                        </div>
                                        {selectedPrompt.fields.map((field, index) => (
                                            <div key={field.id} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">
                                                        <span className="mr-1 opacity-50">{index + 1}.</span>
                                                        {field.label}
                                                        {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                                    </label>
                                                    {field.maxLength && <span className={`text-[9px] ${(promptFormState[field.id]?.length || 0) > field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>{promptFormState[field.id]?.length || 0}/{field.maxLength}</span>}
                                                </div>
                                                {field.type === 'file' ? (
                                                    <div className="w-full">
                                                        <input 
                                                            type="file"
                                                            multiple
                                                            accept=".txt,.md,.json,.csv"
                                                            onChange={(e) => handleFileChange(e, field.id, false)}
                                                            className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 transition-colors"
                                                        />
                                                        {promptFormState[field.id] && (
                                                            <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 truncate pl-2">
                                                                已加载 {promptFormState[field.id].length} 字符
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : field.type === 'textarea' ? <textarea value={promptFormState[field.id] || ''} onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))} maxLength={field.maxLength} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none h-24 resize-y" placeholder={field.placeholder || `请输入${field.label}...`} /> : <input type="text" value={promptFormState[field.id] || ''} onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))} maxLength={field.maxLength} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none" placeholder={field.placeholder || `请输入${field.label}...`} />}
                                                {field.description && (
                                                    <p className="text-[9px] text-sky-500 dark:text-sky-400 flex items-start gap-1 leading-tight mt-0.5">
                                                        <InformationCircle className="w-3 h-3 shrink-0" />
                                                        {field.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">自定义要求</label>
                                        <textarea 
                                            value={promptInput}
                                            onChange={e => setPromptInput(e.target.value)}
                                            placeholder="请输入具体的剧本创作要求，例如：写一场关于..."
                                            className="w-full h-32 p-3 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none resize-y shadow-sm"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {isGenerating ? (
                    <button onClick={handleStop} className="w-full py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs"><Stop className="w-3.5 h-3.5" /> 停止生成</button>
                ) : (
                    <div className="flex gap-2 flex-col">
                        {generationMode === 'workflow' ? (
                            (!selectedWorkflow && !executedWorkflow) ? (
                                <>
                                    <button onClick={() => handleRunGeneration()} className="w-full py-2 bg-sky-50 text-sky-600 border border-sky-200 font-bold rounded-xl hover:bg-sky-100 transition-all flex items-center justify-center gap-1 shadow-sm text-xs"><Film className="w-3.5 h-3.5" /> 分集创作</button>
                                    <button onClick={() => handleRunGeneration()} className="w-full py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-1 text-xs"><Play className="w-3.5 h-3.5" /> 一键全集</button>
                                </>
                            ) : (
                                // When workflow is active/done, show Resume/Regenerate options
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleRunGeneration()} className="py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-1 text-xs">
                                        <ArrowPath className="w-3.5 h-3.5" /> 重新生成
                                    </button>
                                    <button onClick={() => handleRunGeneration(undefined, true)} className="py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 transition-all flex items-center justify-center gap-1 text-xs">
                                        <Play className="w-3.5 h-3.5" /> 继续生成
                                    </button>
                                </div>
                            )
                        ) : (
                            <div className="flex gap-2">
                                {!promptResultText ? (
                                    <button onClick={() => handleRunGeneration()} className="w-full py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-1 text-xs"><Sparkles className="w-3.5 h-3.5" /> 立即生成</button>
                                ) : (
                                    <>
                                        <button onClick={() => handleRunGeneration()} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-1 text-xs">
                                            <ArrowPath className="w-3.5 h-3.5" /> 重新生成
                                        </button>
                                        <button onClick={() => handleRunGeneration(undefined, true)} className="flex-1 py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 transition-all flex items-center justify-center gap-1 text-xs">
                                            <Play className="w-3.5 h-3.5" /> 继续生成
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative font-sans" onClick={() => setContextMenu(prev => ({...prev, visible: false}))}>
            <LoadingOverlay isVisible={showLoadingOverlay} message={loadingMessage} onClose={() => setShowLoadingOverlay(false)} />
            
            {/* Comparison Modal */}
            {isComparisonModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 pointer-events-none">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setIsComparisonModalOpen(false)} />
                    <div className="bg-white dark:bg-gray-900 w-full max-w-6xl h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-10 pointer-events-auto animate-modal-up border border-gray-200 dark:border-gray-800">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">剧本改编对比</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Script Adaptation Comparison</p>
                                </div>
                            </div>
                            <button onClick={() => setIsComparisonModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Original */}
                            <div className="flex-1 flex flex-col border-r border-gray-100 dark:border-gray-800 overflow-hidden">
                                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                        原文剧本 (小说/素材)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => document.getElementById('source-upload-modal')?.click()}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                                            title="上传本地文件"
                                        >
                                            <CloudArrowUp className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => setIsSourceAssetModalOpen(true)}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
                                            title="从素材库导入"
                                        >
                                            <Database className="w-4 h-4" />
                                        </button>
                                        <input 
                                            type="file" 
                                            id="source-upload-modal" 
                                            className="hidden" 
                                            accept=".txt,.md"
                                            onChange={handleSourceUpload}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 text-sm leading-relaxed text-gray-600 dark:text-gray-400 bg-gray-50/30 dark:bg-black/20 custom-scrollbar font-serif">
                                    <div className="whitespace-pre-wrap">
                                        {script.sourceContent || (generationMode === 'workflow' 
                                            ? (workflowFormState['novel_content'] || workflowFormState['novel_text'] || workflowFormState['小说内容'] || workflowFormState['小说原文'] || '暂无原文内容')
                                            : (promptFormState['novel_text'] || promptFormState['novel_content'] || promptFormState['小说原文'] || promptFormState['小说内容'] || '暂无原文内容'))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right: Adapted */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 py-3 bg-purple-50/50 dark:bg-purple-900/10 flex items-center justify-between border-b border-purple-100/50 dark:border-purple-800/50">
                                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        改编后剧本
                                    </span>
                                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-600 px-2 py-0.5 rounded font-bold">AI 改编</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 custom-scrollbar">
                                    <div className="space-y-4">
                                        {generationMode === 'workflow' ? (
                                            (executedWorkflow || selectedWorkflow)?.steps?.map((step) => {
                                                const content = stepResults[step.outputVariable];
                                                if (!content) return null;
                                                return (
                                                    <div key={step.id} className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-900/5">
                                                        <div className="text-[10px] font-black text-purple-400 uppercase mb-2 border-b border-purple-100/30 pb-1">{step.name}</div>
                                                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                                            {content}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            promptResultText ? (
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                                    {promptResultText}
                                                </div>
                                            ) : (
                                                <div className="text-center py-20 text-gray-400 text-sm italic">暂无适配生成内容</div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-center">
                            <p className="text-[10px] text-gray-400 font-medium">对比视图仅供参考，AI 改编内容已根据剧情深度优化。改编的情节点已自动进行视听语言转换。</p>
                        </div>
                    </div>
                </div>
            )}

            <FollowUpModal 
                isOpen={followUpModal.open} 
                onClose={() => setFollowUpModal(prev => ({ ...prev, open: false }))} 
                targetText={followUpModal.targetText}
                context={followUpModal.context || (selectedWorkflow?.steps?.find(s => s.outputVariable === followUpModal.stepVar)?.prompt || '')} 
                initialMode={followUpModal.targetText ? 'selection' : 'full'}
                onApply={handleFollowUpApply}
                rewriteMode={followUpModal.rewriteMode}
            />

            <ContextMenu 
                {...contextMenu} 
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={handleContextMenuAction}
            />

            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptSelectionModalOpen} onClose={() => setIsPromptSelectionModalOpen(false)} onSelect={handlePromptChange} />
            
            <AssetSelectionModal 
                isOpen={isSourceAssetModalOpen} 
                onClose={() => setIsSourceAssetModalOpen(false)} 
                assets={assets} 
                selectedAssetIds={script.sourceAssetId ? new Set([script.sourceAssetId]) : new Set()} 
                onToggleAsset={(id) => handleSelectSourceAsset(id)} 
            />
            
            {/* ... Workflow Modal with Top Bar ... */}
            {isWorkflowModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWorkflowModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        
                        {/* 1. Modal Top Bar */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                            <div className="flex items-center justify-between gap-4">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
                                    <WorkflowIcon className="w-6 h-6 text-sky-500" />
                                    选择剧本工作流
                                </h3>
                                
                                {/* Categories Tabs Inline */}
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0">
                                    {WORKFLOW_CATEGORIES.map(cat => (
                                        <button 
                                            key={cat.id} 
                                            onClick={() => setWorkflowCategory(cat.id)} 
                                            className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${workflowCategory === cat.id ? 'bg-sky-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-2 hidden sm:block"></div>
                                    <button 
                                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                                        className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${showFavoritesOnly ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                                    >
                                        <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} /> 收藏
                                    </button>
                                </div>

                                {/* Search Inline */}
                                <div className="relative w-48 shrink-0">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-3.5 h-3.5 text-gray-400" /></span>
                                    <input 
                                        type="text" 
                                        placeholder="搜索工作流..." 
                                        value={workflowSearch} 
                                        onChange={e => setWorkflowSearch(e.target.value)} 
                                        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-gray-800 text-xs rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-sky-500 outline-none" 
                                    />
                                </div>

                                <button onClick={() => setWorkflowModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 shrink-0">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            
                            {/* Row 2: Genre Tags */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                <span className="text-sm font-bold text-gray-400 mr-1 shrink-0">题材:</span>
                                <button onClick={() => setWorkflowGenre('all')} className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all whitespace-nowrap ${workflowGenre === 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}>全部</button>
                                {GENRE_TAGS.map(tag => (
                                    <button 
                                        key={tag.id} 
                                        onClick={() => setWorkflowGenre(tag.id)} 
                                        className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all whitespace-nowrap ${workflowGenre === tag.id ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-purple-300'}`}
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50 dark:bg-black/20">
                            {filteredWorkflows.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredWorkflows.map(wf => (
                                        <div 
                                            key={wf.id} 
                                            onClick={() => { setSelectedWorkflow(wf); setWorkflowModalOpen(false); }}
                                            className={`bg-white dark:bg-gray-900 rounded-2xl p-4 border transition-all cursor-pointer group flex flex-col h-[190px] ${
                                                selectedWorkflow?.id === wf.id 
                                                ? 'border-sky-500 ring-2 ring-sky-500/20' 
                                                : 'border-gray-100 dark:border-gray-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-xl'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex gap-2 mb-1 opacity-0"></div>
                                                <div className="h-6"></div>
                                            </div>
                                            
                                            <div className="-mt-8">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-1 group-hover:text-sky-600 transition-colors pr-2">{wf.title}</h3>
                                                    {selectedWorkflow?.id === wf.id && <div className="bg-sky-500 text-white rounded-full p-0.5 shrink-0 mt-1"><Check className="w-3 h-3" /></div>}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed flex-grow">
                                                    {wf.description || '暂无描述'}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 gap-2">
                                                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 font-bold border border-sky-100 whitespace-nowrap dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800">
                                                            {CATEGORY_LABELS[wf.category] || '全类型'}
                                                        </span>
                                                        {wf.subCategories && wf.subCategories.length > 0 && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold border border-purple-100 whitespace-nowrap dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                                                                {getGenreLabel(wf.subCategories[0] as string)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-shrink-0 truncate">
                                                        <div className="flex items-center gap-0.5"><Fire className="w-3 h-3 text-orange-400" /> {wf.usageCount}</div>
                                                        <div className="flex items-center gap-0.5 truncate"><UserCircle className="w-3 h-3" /> {wf.author}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                    <WorkflowIcon className="w-16 h-16 mb-4 opacity-10" />
                                    <p>暂无可用工作流</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header - Updated Layout */}
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-14 justify-between px-4">
                <div className="flex items-center gap-3">
                    <Film className="w-5 h-5 text-sky-500" />
                    {/* Editable Title */}
                    {isEditingTitle ? (
                        <input 
                            value={tempTitle} 
                            onChange={(e) => setTempTitle(e.target.value)} 
                            onBlur={handleTitleSave}
                            onKeyDown={(e) => { if(e.key === 'Enter') handleTitleSave(); }}
                            autoFocus 
                            className="text-base font-bold bg-gray-50 dark:bg-gray-800 border border-sky-300 rounded px-2 py-0.5 focus:outline-none min-w-[150px] max-w-[200px]" 
                        />
                    ) : (
                        <div className="flex items-center gap-1 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                            <span className="font-bold text-base text-gray-900 dark:text-white truncate max-w-[150px]">{script.title}</span>
                            <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                        </div>
                    )}
                </div>
                
                {/* Center - Workflow Navigation or Empty */}
                <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar mx-4">
                    {generationMode === 'workflow' && (
                        <div className="flex items-center bg-gray-50 dark:bg-gray-900 p-1 rounded-lg">
                            {(executedWorkflow || selectedWorkflow)?.steps ? (
                                (executedWorkflow || selectedWorkflow)?.steps?.map((step, idx) => (
                                    <div key={step.id} className="flex items-center">
                                        <button 
                                            onClick={() => {
                                                if (stepRefs.current[idx]) {
                                                    stepRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                                                currentStepIndex === idx 
                                                ? 'bg-white dark:bg-gray-800 text-sky-600 shadow-sm ring-1 ring-sky-500/20' 
                                                : (stepResults[step.outputVariable] ? 'text-green-600' : 'text-gray-400 hover:text-gray-900')
                                            }`}
                                        >
                                            {stepResults[step.outputVariable] ? (
                                                <div className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5" />
                                                </div>
                                            ) : (
                                                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[9px]">
                                                    {idx + 1}
                                                </span>
                                            )}
                                            {step.name}
                                        </button>
                                        {idx < ((executedWorkflow || selectedWorkflow)?.steps?.length || 0) - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-gray-400 px-4">请先选择工作流</span>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold mr-2">
                        {saveStatus === 'saving' ? (
                            <span className="text-sky-500 animate-pulse flex items-center gap-1"><CloudArrowUp className="w-3.5 h-3.5" /> 保存中...</span>
                        ) : saveStatus === 'saved' ? (
                            <span className="text-green-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> 已自动保存</span>
                        ) : (
                            <span className="text-red-400">保存失败</span>
                        )}
                    </div>
                    <button onClick={handleBack} className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative gap-1"> {/* Gap added here */}
                {/* Left Sidebar - Width increased to 320px */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-[320px]' : 'w-0'}`}>
                    {renderSetupSidebar()}
                </aside>

                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-[320px]' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Content Area */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden h-full">
                     {/* Content Header Area */}
                     <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex justify-between items-center shrink-0 h-12 relative">
                         <div className="flex items-center gap-4 pl-4 w-1/4">
                             <h2 className="text-base font-bold text-sky-500 dark:text-sky-400 flex items-center gap-2 truncate">
                                 {activeScene?.title || '剧本正文'}
                             </h2>
                         </div>
                         
                         {/* Centered area: Toolbar */}
                         <div className="flex-1 flex justify-center">
                             <WritingToolbar onAction={handleToolbarAction} alignment={alignment} />
                         </div>

                         <div className="flex items-center gap-2 w-1/4 justify-end">
                             {script.type === 'adaptation' && (
                                 <button 
                                    onClick={() => setIsComparisonModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors mr-1"
                                 >
                                     <ArrowPath className="w-3.5 h-3.5" />
                                     改编对比
                                 </button>
                             )}
                             <div className="relative">
                                 {/* Replace Episode Selector with Download */}
                                 <button 
                                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                                 >
                                     <DocumentArrowDown className="w-3.5 h-3.5" />
                                     下载
                                     <ChevronDown className="w-3 h-3" />
                                 </button>
                                 
                                 {isDownloadMenuOpen && (
                                     <>
                                         <div className="fixed inset-0 z-40" onClick={() => setIsDownloadMenuOpen(false)} />
                                         <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-1 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                             <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 mb-1">
                                                 选择下载内容
                                             </div>
                                             {generationMode === 'workflow' && (executedWorkflow || selectedWorkflow)?.steps ? (
                                                 (executedWorkflow || selectedWorkflow)?.steps?.map((step) => {
                                                     const result = stepResults[step.outputVariable];
                                                     return (
                                                         <button 
                                                             key={step.id}
                                                             onClick={() => { 
                                                                 if(result) handleDownloadWord(result, `${script.title}_${step.name}`); 
                                                                 else alert("该步骤暂无生成内容");
                                                                 setIsDownloadMenuOpen(false); 
                                                             }}
                                                             className={`w-full text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors truncate ${result ? 'text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-gray-700' : 'text-gray-400 cursor-not-allowed'}`}
                                                         >
                                                             {step.name}
                                                         </button>
                                                     );
                                                 })
                                             ) : (
                                                 promptResultText ? (
                                                     <button 
                                                         onClick={() => { handleDownloadWord(promptResultText, `${script.title}_生成结果`); setIsDownloadMenuOpen(false); }}
                                                         className="w-full text-left px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors truncate text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-gray-700"
                                                     >
                                                         提示词生成结果
                                                     </button>
                                                 ) : (
                                                     <div className="p-2 text-center text-xs text-gray-400">暂无内容可下载</div>
                                                 )
                                             )}
                                         </div>
                                     </>
                                 )}
                             </div>
                         </div>
                     </div>
                     
                     {/* Main Output Container - Full Height, Separators */}
                     <div className="flex-1 overflow-y-auto p-0 custom-scrollbar relative scroll-smooth bg-white dark:bg-gray-900 h-full" ref={scrollContainerRef}>
                         {/* Loading State for Script Body */}
                         {isScriptLoading && (
                             <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-50">
                                 <div className="flex flex-col items-center gap-3">
                                     <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                                     <p className="text-xs font-bold text-gray-500">剧本加载中...</p>
                                 </div>
                             </div>
                         )}

                         {/* Mode: Prompt Generation - Single Result Display */}
                         {generationMode === 'prompt' && (
                             <div className="w-full min-h-full flex flex-col bg-white dark:bg-gray-900">
                                 {/* Result Header Removed */}
                                 {/* Result Body - Full height */}
                                 <div className="flex-1 p-8 relative group overflow-y-auto custom-scrollbar min-h-[500px]">
                                     {generationError && (
                                         <div className="mb-6 p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex flex-col items-center gap-4 animate-fade-in">
                                             <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                                                 <InformationCircle className="w-6 h-6" />
                                             </div>
                                             <div className="text-center">
                                                 <h4 className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">生成失败</h4>
                                                 <p className="text-xs text-red-500 dark:text-red-400/80 max-w-md mx-auto">{generationError}</p>
                                             </div>
                                             <button 
                                                 onClick={() => handleRunGeneration()}
                                                 className="px-6 py-2 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-500 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-red-500/20"
                                             >
                                                 <ArrowPath className="w-4 h-4" /> 重新尝试生成
                                             </button>
                                         </div>
                                     )}

                                     {isGenerating && !promptResultText ? (
                                         <div className="flex flex-col items-center justify-center h-full text-sky-500 pt-20 animate-pulse">
                                             <div className="w-16 h-16 mb-6 relative">
                                                 <Sparkles className="w-16 h-16 absolute inset-0 opacity-20" />
                                                 <ArrowPath className="w-16 h-16 animate-spin" />
                                             </div>
                                             <h3 className="text-lg font-bold mb-2">正在为您精心创作...</h3>
                                             <p className="text-sm text-sky-400 opacity-80">AI 正在根据您的提示词构建精彩内容</p>
                                         </div>
                                     ) : promptResultText ? (
                                         <div className="mb-8">
                                             {isGenerating ? (
                                                 <StreamingText text={promptResultText} isGenerating={true} />
                                             ) : (
                                                 <EditableStepContent 
                                                     initialContent={promptResultText}
                                                     onSave={(val) => setPromptResultText(val)}
                                                     onContextMenu={(e, text, fullText) => {
                                                         setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text, fullText });
                                                     }}
                                                 />
                                             )}
                                             
                                             <div className="mt-8 flex items-center gap-4">
                                                 <button 
                                                     type="button"
                                                     onClick={() => {
                                                         if(window.confirm('确定要清空结果吗？')) setPromptResultText('');
                                                     }}
                                                     className="p-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-lg hover:text-red-500 transition-colors border border-gray-100 dark:border-gray-700"
                                                     title="清空"
                                                 >
                                                     <Trash className="w-5 h-5" />
                                                 </button>
                                                 
                                                 <button 
                                                     onClick={() => handleInsertToScript(promptResultText)}
                                                     className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-full shadow-lg hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2 text-sm"
                                                 >
                                                     <Plus className="w-5 h-5" /> 插入到正文
                                                 </button>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="flex flex-col items-center justify-center h-full text-gray-400 pt-20">
                                             <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                                             <p>请在左侧填写提示词并开始生成</p>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         )}

                         {/* Mode: Workflow Generation - Single Container with Dividers */}
                         {generationMode === 'workflow' && (executedWorkflow || selectedWorkflow) && !isScriptLoading && (
                             <div className="w-full mx-auto min-h-full flex flex-col bg-white dark:bg-gray-900 pb-32">
                                 {(executedWorkflow || selectedWorkflow)?.steps?.map((step, index) => {
                                     if (index > visibleStepIndex) return null;

                                     const result = stepResults[step.outputVariable];
                                     const isGeneratingThis = currentStepIndex === index && isGenerating;
                                     const isCollapsed = collapsedSteps[step.id];
                                     
                                     return (
                                         <div 
                                            key={step.id} 
                                            ref={(el: HTMLDivElement | null) => { stepRefs.current[index] = el; }}
                                            className={`transition-opacity duration-500 ${index > 0 ? 'border-t-4 border-gray-100 dark:border-gray-800' : ''}`}
                                         >
                                             {!isCollapsed && (
                                                 <div className="p-8 relative group min-h-[100px]">
                                                     {/* Floating Step Badge */}
                                                     <div className="absolute left-2 top-2 text-[10px] font-bold text-gray-300 pointer-events-none select-none">
                                                         Step {index + 1}
                                                     </div>

                                                     {generationError && currentStepIndex === index ? (
                                                          <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex flex-col items-center gap-3 animate-fade-in text-center mx-auto max-w-2xl">
                                                              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                                                                  <InformationCircle className="w-5 h-5" />
                                                                  本级剧本生成失败
                                                              </div>
                                                              <p className="text-xs text-red-500 dark:text-red-400/80 max-w-md">{generationError}</p>
                                                              <button 
                                                                  onClick={() => handleRunGeneration(index)}
                                                                  className="mt-2 px-5 py-2 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-500 transition-all active:scale-95 flex items-center gap-2"
                                                              >
                                                                  <ArrowPath className="w-3.5 h-3.5" /> 立即重试
                                                              </button>
                                                          </div>
                                                     ) : result ? (
                                                         <div className="relative">
                                                             {/* Removed Hover Controls as requested */}
                                                             
                                                             {/* Streaming vs Static */}
                                                             {isGeneratingThis ? (
                                                                 <StreamingText text={result} isGenerating={true} />
                                                             ) : (
                                                                 <EditableStepContent 
                                                                    initialContent={result} 
                                                                    onSave={(newContent) => handleStepContentChange(step.outputVariable, newContent)}
                                                                    onContextMenu={(e, text, fullText) => {
                                                                        setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text, fullText, stepVar: step.outputVariable });
                                                                    }}
                                                                 />
                                                             )}
                                                         </div>
                                                      ) : isGeneratingThis ? (
                                                         <div className="flex flex-col items-center justify-center py-12 text-sky-500 text-sm animate-pulse gap-3">
                                                             <div className="relative flex items-center justify-center">
                                                                 <Sparkles className="w-8 h-8 opacity-20" />
                                                                 <ArrowPath className="w-8 h-8 animate-spin absolute" />
                                                             </div>
                                                             <span className="font-bold">正在创作本章节内容...</span>
                                                             <p className="text-[11px] opacity-60">AI 正在努力为您编织精彩情节</p>
                                                         </div>
                                                      ) : (
                                                         <div className="text-gray-400 text-xs italic p-4 text-center">等待生成...</div>
                                                      )}
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                         
                         {/* Fallback */}
                         {generationMode === 'workflow' && !selectedWorkflow && !executedWorkflow && !isScriptLoading && (
                             <div className="flex flex-col items-center justify-center h-full text-gray-400 pt-20">
                                 <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
                                 <p>请在左侧选择一个工作流开始创作</p>
                             </div>
                         )}
                         
                     </div>
                </main>

                {/* Right Sidebar */}
                <button 
                    onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md flex items-center justify-center text-gray-400 hover:text-sky-500 transition-all shadow-sm ${isRightSidebarOpen ? 'right-[280px]' : 'right-0'}`}
                >
                    {isRightSidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </button>

                <aside className={`flex-shrink-0 bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isRightSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
                    <ScriptAIPanel 
                        onInsert={(text) => {
                            if (generationMode === 'workflow' && selectedWorkflow?.steps && currentStepIndex !== null) {
                                alert("请手动复制内容到对应步骤");
                            } else {
                                handleInsertToScript(text);
                            }
                        }}
                        selectedText={aiTrigger?.text}
                        externalAction={aiTrigger}
                    />
                </aside>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
