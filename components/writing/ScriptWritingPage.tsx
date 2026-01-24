
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Script, Scene, ScriptSettings, Workflow, Asset, Prompt, PromptCategory } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, Database, Play, Pencil, X, Stop, ChevronDown, ChevronUp, Workflow as WorkflowIcon, ChatBubbleOvalLeftEllipsis, DocumentArrowDown, UserCircle, Fire, Plus, InformationCircle, Box, Copy, Trash, Heart, Search } from '../Icon';
import WritingToolbar from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, fetchMaterials, incrementWorkflowUsage, fetchWorkflows, getCurrentUserId, saveScriptWorkflowState, fetchScriptWorkflowState, incrementPromptHeat, fetchWorkflowFavorites } from '../../services/supabaseService';
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
const FORCE_LONG_INSTRUCTION = "\n\n【重要指令】：请尽可能详细、深入地撰写，展开环境、心理、动作等细节，严禁省略或概括。请充分利用输出长度限制，生成长篇幅的完整内容。";

const WORKFLOW_CATEGORIES: { id: string; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'short-story', label: '短篇' },
    { id: 'long-story', label: '长篇' },
    { id: 'script', label: '剧本' },
    { id: 'general', label: '通用' },
];

// Editable Content Component for each step
const EditableStepContent: React.FC<{
    initialContent: string;
    onSave: (newContent: string) => void;
    onContextMenu: (e: React.MouseEvent, text: string) => void;
}> = ({ initialContent, onSave, onContextMenu }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    // Initial render formatting helper (simple HTML conversion)
    const formatInitial = (text: string) => {
        const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        // Simply return the clean text wrapped in divs to maintain reading flow, avoiding complex MD parsing
        // since we asked AI for plain text. 
        return clean.split('\n').map(line => {
            const trimmed = line.trim();
            if(!trimmed) return '<div><br/></div>';
            return `<div>${trimmed}</div>`;
        }).join('');
    };

    useEffect(() => {
        if (editorRef.current && initialContent) {
            // Only set HTML initially to avoid cursor jumps on re-renders if we controlled it
            if (editorRef.current.innerText.trim() === '') {
                 editorRef.current.innerHTML = formatInitial(initialContent);
            }
        }
    }, []);

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
            onContextMenu(e, text);
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onContextMenu={handleRightClick}
            className="whitespace-pre-wrap font-sans leading-relaxed text-sm outline-none focus:bg-yellow-50/10 transition-colors p-1 rounded min-h-[50px] max-w-none"
        />
    );
};

// FormattedText for non-editable display (Prompt Mode Result)
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    return (
        <div className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
            {cleanedText.split('\n').map((line, index) => {
                // Heuristic formatting for script-like content
                const isSceneHeader = /^(EXT\.|INT\.|内景|外景|场景)/i.test(line);
                const isCharacter = /^[A-Z\u4e00-\u9fa5]+(\s*\(.*?\))?：/.test(line); // Name + colon
                
                let className = "";
                if (isSceneHeader) className = "font-bold bg-gray-100 dark:bg-gray-800/50 p-1 rounded my-2";
                else if (isCharacter) className = "font-bold mt-2";
                
                return <div key={index} className={className}>{line || <br/>}</div>;
            })}
        </div>
    );
};

const MODEL_OPTIONS = [
    { value: "deepseek-chat", label: "奇思版 (DeepSeek V3)" },
    { value: "gemini-3-flash-preview", label: "妙写版 (Gemini 3 Flash)" },
    { value: "doubao-flash", label: "速写版 (豆包)" }
];

const LANGUAGE_OPTIONS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" }
];

const CATEGORY_LABELS: Record<string, string> = {
    'long-story': '长篇', 'short-story': '短篇', 'script': '剧本', 'general': '通用',
};

const getGenreLabel = (id: string) => {
    const found = GENRE_TAGS.find(g => g.id === id);
    return found ? found.label : id;
};

// Helper function to strip markdown manually just in case
const stripMarkdown = (text: string) => {
    return text
        .replace(/#+\s/g, '') // Remove headers
        .replace(/\*\*|\*/g, '') // Remove bold/italic
        .replace(/>\s/g, '') // Remove blockquotes
        .replace(/`{1,3}.*?`{1,3}/gs, '') // Remove code blocks
        .replace(/<think>[\s\S]*?<\/think>/g, '') // Remove thinking blocks
        .trim();
};

// Context Menu Component
const ContextMenu: React.FC<{
    x: number;
    y: number;
    visible: boolean;
    onClose: () => void;
    onAction: (action: 'polish' | 'expand' | 'ask') => void;
}> = ({ x, y, visible, onClose, onAction }) => {
    if (!visible) return null;

    return createPortal(
        <div 
            className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[120px] animate-fade-in"
            style={{ top: y, left: x }}
            onMouseLeave={onClose}
            onClick={(e) => e.stopPropagation()}
        >
            <button onClick={() => { onAction('ask'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <ChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" /> 追问
            </button>
            <button onClick={() => { onAction('polish'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> 润色
            </button>
            <button onClick={() => { onAction('expand'); onClose(); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:text-sky-600 transition-colors flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> 扩写
            </button>
        </div>,
        document.body
    );
};

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    // Core Data
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isScriptLoading, setIsScriptLoading] = useState(true); // Loading state for the script itself
    
    // Setup State
    const [settings, setSettings] = useState<ScriptSettings>({
        format: 'live_action',
        totalEpisodes: '12',
        durationPerEpisode: '45',
        scenesPerEpisodeLimit: '30',
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
    const [stepResults, setStepResults] = useState<Record<string, string>>({}); // Store result per step
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [visibleStepIndex, setVisibleStepIndex] = useState<number>(-1); // Control how many steps are visible
    const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({}); // Control collapse state

    // Independent Execution State (Decoupling)
    // executedWorkflow holds the workflow structure that is currently being displayed in the right panel.
    // It updates when a generation starts.
    const [executedWorkflow, setExecutedWorkflow] = useState<Workflow | null>(null);
    const [executedPrompt, setExecutedPrompt] = useState<Prompt | null>(null);

    // Prompt Mode State
    const [promptInput, setPromptInput] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [promptFormState, setPromptFormState] = useState<Record<string, string>>({});
    const [promptResultText, setPromptResultText] = useState(''); // Store result for simple prompt mode

    // Asset Selection
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false); // Changed to Modal state
    const [isPromptSelectionModalOpen, setIsPromptSelectionModalOpen] = useState(false);

    // Workflow Modal specific states
    const [workflowCategory, setWorkflowCategory] = useState<string>('all');
    const [workflowSearch, setWorkflowSearch] = useState('');
    const [workflowFavorites, setWorkflowFavorites] = useState<Set<string>>(new Set());
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // UI State
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isRightSidebarOpen, setRightSidebarOpen] = useState(false); // New Right Sidebar
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('正在处理...');
    const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
    
    // Editor State
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

    // Context Menu & AI interaction
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' });
    const [aiTrigger, setAiTrigger] = useState<{ type: 'polish' | 'expand' | 'ask', text: string } | null>(null);
    
    // FollowUp Modal State
    const [followUpModal, setFollowUpModal] = useState<{ open: boolean; targetText: string; context: string; stepVar: string; }>({
        open: false, targetText: '', context: '', stepVar: ''
    });

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const dbSaveTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Filter available workflows for the modal
    const filteredWorkflows = useMemo(() => {
        return availableWorkflows.filter(wf => {
            const matchesCategory = workflowCategory === 'all' || wf.category === workflowCategory || (workflowCategory === 'script' && wf.category === 'script');
            const matchesSearch = !workflowSearch || wf.title.toLowerCase().includes(workflowSearch.toLowerCase());
            const matchesFavorite = !showFavoritesOnly || workflowFavorites.has(wf.id);
            return matchesCategory && matchesSearch && matchesFavorite;
        });
    }, [availableWorkflows, workflowCategory, workflowSearch, showFavoritesOnly, workflowFavorites]);

    // Load favorites when modal opens
    useEffect(() => {
        if (isWorkflowModalOpen) {
            fetchWorkflowFavorites().then(ids => setWorkflowFavorites(new Set(ids)));
        }
    }, [isWorkflowModalOpen]);

    // --- Persistence Helper ---
    // Debounced save to Supabase
    const persistState = useCallback(() => {
        if (!script.id) return;
        if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current);
        
        dbSaveTimeoutRef.current = setTimeout(async () => {
            if (selectedWorkflow || Object.keys(stepResults).length > 0) {
                await saveScriptWorkflowState(
                    script.id,
                    selectedWorkflow?.id,
                    workflowFormState,
                    stepResults,
                    visibleStepIndex
                );
            }
        }, 1500); 
    }, [script.id, selectedWorkflow?.id, workflowFormState, stepResults, visibleStepIndex]);

    useEffect(() => { persistState(); }, [persistState]);

    // Scroll to bottom on load and generation
    useEffect(() => {
        if (scrollContainerRef.current && isGenerating) {
            // Check if user is near bottom or if it's initial load/generation
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            
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
            let mappedWorkflows: Workflow[] = [];
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

            const savedState = await fetchScriptWorkflowState(script.id);
            if (savedState && savedState.workflow_id) {
                const wf = mappedWorkflows.find(w => w.id === savedState.workflow_id);
                if (wf) {
                    setSelectedWorkflow(wf);
                    // Also restore execution context to show previous results
                    setExecutedWorkflow(wf);
                    setWorkflowFormState(savedState.form_state || {});
                    setStepResults(savedState.step_results || {});
                    setVisibleStepIndex(savedState.visible_index ?? -1);
                }
            }
            setIsScriptLoading(false);
        };
        loadInitialData();
    }, [script.id]);

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
        // Reset form
        const initial: Record<string, string> = {};
        prompt.fields?.forEach(f => { initial[f.id] = ''; });
        setPromptFormState(initial);
    };

    const handleRunGeneration = async () => {
        if (isGenerating) { handleStop(); return; }
        
        setIsGenerating(true);
        const controller = new AbortController(); 
        abortControllerRef.current = controller;
        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
        const basicInfo = `【剧本基础信息】\n总集数：${settings.totalEpisodes}\n单集时长：${settings.durationPerEpisode}min\n语言：${settings.outputLanguage}\n\n`;

        if (generationMode === 'workflow') {
            if (!selectedWorkflow || !selectedWorkflow.steps) return;
            
            // Set executed workflow to decouple from selection
            setExecutedWorkflow(selectedWorkflow);

            const startStepIndex = Object.keys(stepResults).length < selectedWorkflow.steps.length ? Object.keys(stepResults).length : 0;
            if (startStepIndex === 0) { setStepResults({}); setVisibleStepIndex(-1); }

            setCurrentStepIndex(startStepIndex);
            setVisibleStepIndex(Math.max(visibleStepIndex, startStepIndex));

            let currentContext: Record<string, string> = { ...workflowFormState };
            if (startStepIndex > 0) {
                 selectedWorkflow.steps.forEach((s, idx) => { if (idx < startStepIndex && stepResults[s.outputVariable]) currentContext[s.outputVariable] = stepResults[s.outputVariable]; });
            }

            try {
                incrementWorkflowUsage(selectedWorkflow.id);
                for (let i = startStepIndex; i < selectedWorkflow.steps!.length; i++) {
                    if (controller.signal.aborted) break;
                    setCurrentStepIndex(i);
                    setVisibleStepIndex(i);
                    const step = selectedWorkflow.steps![i];
                    let prompt = step.prompt;
                    Object.keys(currentContext).forEach(key => { prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), currentContext[key] || ''); });
                    
                    const finalPrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${prompt}${NO_MARKDOWN_INSTRUCTION}`;
                    
                    let stepOutput = '';
                    const stream = generateTextStream(finalPrompt, { model: settings.model, temperature, topP, maxOutputTokens, signal: controller.signal });
                    for await (const chunk of stream) { stepOutput += chunk; setStepResults(prev => ({ ...prev, [step.outputVariable]: stepOutput })); }
                    currentContext[step.outputVariable] = stepOutput;
                }
            } catch (e) { console.error(e); } finally { setIsGenerating(false); setCurrentStepIndex(null); }

        } else {
            // Prompt Mode
            setExecutedPrompt(selectedPrompt);
            setPromptResultText('');
            let promptText = selectedPrompt ? (selectedPrompt.template || selectedPrompt.content) : promptInput;
            
            if (selectedPrompt) {
                incrementPromptHeat(selectedPrompt.id);
                Object.keys(promptFormState).forEach(key => {
                    promptText = promptText.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), promptFormState[key] || '');
                });
            }

            const finalPrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${promptText}${FORCE_LONG_INSTRUCTION}`;

            try {
                const stream = generateTextStream(finalPrompt, { model: settings.model, temperature, topP, maxOutputTokens, signal: controller.signal });
                for await (const chunk of stream) { 
                    setPromptResultText(prev => prev + chunk); 
                }
            } catch (e) { console.error(e); } finally { setIsGenerating(false); }
        }
    };

    const handleStop = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); setIsGenerating(false); setCurrentStepIndex(null); };

    // --- New Features Implementation ---

    const handleDownloadWord = (content: string, title: string) => {
        // Strip markdown BEFORE generating HTML for Word to ensure plain text reading view
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
        link.download = `${title}.doc`; // Word opens .doc as HTML seamlessly
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStepContentChange = (stepVar: string, newContent: string) => {
        setStepResults(prev => ({ ...prev, [stepVar]: newContent }));
    };

    const handleContextMenuAction = (action: 'polish' | 'expand' | 'ask') => {
        if (action === 'ask' && contextMenu.text) {
            setFollowUpModal({
                open: true,
                targetText: contextMenu.text,
                context: '', 
                stepVar: '' 
            });
        } else if (contextMenu.text) {
            setAiTrigger({ type: action, text: contextMenu.text });
            setRightSidebarOpen(true);
        }
    };

    const handleOpenDeepAsk = (text: string, stepVar: string) => {
        setFollowUpModal({
            open: true,
            targetText: '', // Full context mode usually
            context: text,
            stepVar: stepVar
        });
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
             // For prompt mode, simplistic append
             setPromptResultText(prev => prev + '\n\n' + newText);
        } else {
            // Fallback: Copy to clipboard or alert
            navigator.clipboard.writeText(newText);
            alert("结果已复制到剪贴板。");
        }
    };

    const episodeGroups = useMemo(() => {
        const groups = [];
        for (let i = 0; i < script.scenes.length; i += 5) {
            groups.push(script.scenes.slice(i, i + 5));
        }
        return groups;
    }, [script.scenes]);

    const handleCreateEpisode = async () => {
        const newOrder = script.scenes.length + 1;
        const tempId = `new-${Date.now()}`;
        const newTitle = `第 ${newOrder} 集`;
        const newId = await saveChapterToDB(script.id, tempId, newTitle, '', newOrder);

        if (newId) {
            const newScene: Scene = {
                id: newId,
                title: newTitle,
                content: '',
                isContentLoaded: true
            };
            setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
            setActiveScene(newScene);
            setSaveStatus('saved');
        }
    };

    const toggleCollapse = (stepId: string) => {
        setCollapsedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
    };

    const handleInsertToScript = (text: string) => {
        // Insert generated text into current episode
        if (!editorRef.current) {
            alert('请先选择一个集数进行编辑');
            return;
        }
        
        // This is a simplified insertion. In a real rich editor, we'd use selection ranges.
        // For contentEditable, we append or replace.
        const currentText = editorRef.current.innerText;
        editorRef.current.innerText = currentText ? currentText + '\n\n' + text : text;
        
        // Trigger save logic handled by parent effect monitoring changes on title/content if needed
        // Since we don't have direct access to handleContentInput from here easily without refactoring,
        // we assume the user will make further edits or we rely on specific event triggers if we were fully rigorous.
        // For now, this updates the DOM which is what matters for visual confirmation.
    };

    // --- Render ---

    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 font-sans w-[380px] relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 space-y-8">
                {/* 1. Model Configuration */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <AdjustmentsHorizontal className="w-4 h-4" />
                            1. 模型配置
                        </h3>
                        <button 
                            onClick={() => setShowModelConfig(!showModelConfig)} 
                            className={`text-xs font-bold px-2 py-1 rounded transition-colors ${showModelConfig ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        >
                            参数
                        </button>
                    </div>
                    <div className="pl-1 space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">选择基座模型</label>
                            <CustomSelect value={settings.model} onChange={(v) => setSettings(s => ({...s, model: v}))} options={MODEL_OPTIONS} className="z-50" />
                        </div>
                        {showModelConfig && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 space-y-3 animate-fade-in">
                                {/* ... Range inputs ... */}
                                <div className="space-y-1"><label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between"><span>随机度 (Temperature): {temperature}</span></label><input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between"><span>核采样 (Top P): {topP}</span></label><input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between"><span>最大长度 (Tokens): {maxOutputTokens}</span></label><input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Basic Info */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2"><DocumentText className="w-4 h-4" /> 2. 剧本基本信息</h3>
                    <div className="grid grid-cols-2 gap-3 pl-1">
                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400">总集数</label><input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400">单集时长(min)</label><input type="text" value={settings.durationPerEpisode} onChange={e => setSettings(s => ({...s, durationPerEpisode: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400">场次限制</label><input type="number" value={settings.scenesPerEpisodeLimit} onChange={e => setSettings(s => ({...s, scenesPerEpisodeLimit: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold text-gray-400">语言</label><div className="relative z-40"><CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} /></div></div>
                    </div>
                </div>

                {/* 3. Generation Mode Config */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2"><WorkflowIcon className="w-4 h-4" /> 3. 创作配置</h3>
                    
                    {/* Mode Switcher */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button 
                            onClick={() => setGenerationMode('workflow')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${generationMode === 'workflow' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            工作流模式
                        </button>
                        <button 
                            onClick={() => setGenerationMode('prompt')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${generationMode === 'prompt' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            提示词模式
                        </button>
                    </div>

                    <div className="space-y-4 pl-1">
                        {/* Common Asset Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">关联素材</label>
                            <button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-xl border border-dashed text-xs transition-all text-left flex justify-between items-center group ${selectedAssetIds.size > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}>
                                <span className="truncate font-bold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '选择角色/剧情/世界观...'}</span>
                                <Database className={`w-4 h-4 group-hover:scale-110 transition-transform ${selectedAssetIds.size > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                            </button>
                        </div>

                        {generationMode === 'workflow' ? (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">选择工作流</label>
                                    <button onClick={() => setWorkflowModalOpen(true)} className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedWorkflow ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}`}>
                                        <span className="truncate font-bold">{selectedWorkflow ? selectedWorkflow.title : '选择生成流程...'}</span>
                                        <ChevronDown className={`w-4 h-4 ${selectedWorkflow ? 'text-blue-500' : 'text-gray-400'}`} />
                                    </button>
                                </div>
                                {selectedWorkflow && selectedWorkflow.fields && selectedWorkflow.fields.length > 0 && (
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 animate-fade-in shadow-sm">
                                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 参数填写</span>
                                            <button onClick={() => { setSelectedWorkflow(null); setWorkflowFormState({}); }} className="text-[10px] text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                        </div>
                                        {selectedWorkflow.fields.map((field) => (
                                            <div key={field.id} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">
                                                        {field.label}
                                                        {field.required !== false && <span className="text-red-500 ml-0.5">* (必填)</span>}
                                                    </label>
                                                    {field.maxLength && <span className={`text-[9px] ${(workflowFormState[field.variable]?.length || 0) > field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>{workflowFormState[field.variable]?.length || 0}/{field.maxLength}</span>}
                                                </div>
                                                {field.type === 'textarea' ? <textarea value={workflowFormState[field.variable] || ''} onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24" placeholder={field.description || `请输入${field.label}...`} maxLength={field.maxLength} /> : <input type="text" value={workflowFormState[field.variable] || ''} onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder={field.description || `请输入${field.label}...`} maxLength={field.maxLength} />}
                                                {field.description && (
                                                    <p className="text-[9px] text-blue-500 dark:text-blue-400 flex items-start gap-1 leading-tight mt-0.5">
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
                            // Prompt Mode UI
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">选择提示词</label>
                                    <button onClick={() => setIsPromptSelectionModalOpen(true)} className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedPrompt ? 'bg-sky-50 border-sky-300 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-sky-300'}`}>
                                        <span className="truncate font-bold">{selectedPrompt ? selectedPrompt.title : '选择提示词模板...'}</span>
                                        <Box className={`w-4 h-4 ${selectedPrompt ? 'text-sky-500' : 'text-gray-400'}`} />
                                    </button>
                                </div>

                                {selectedPrompt ? (
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 animate-fade-in shadow-sm">
                                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 模板参数</span>
                                            <button onClick={() => { setSelectedPrompt(null); setPromptFormState({}); }} className="text-[10px] text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                        </div>
                                        {selectedPrompt.fields.map((field) => (
                                            <div key={field.id} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">
                                                        {field.label}
                                                    </label>
                                                </div>
                                                {field.type === 'textarea' ? <textarea value={promptFormState[field.id] || ''} onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none h-20" placeholder={field.placeholder || `请输入${field.label}...`} /> : <input type="text" value={promptFormState[field.id] || ''} onChange={(e) => setPromptFormState(p => ({...p, [field.id]: e.target.value}))} className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none" placeholder={field.placeholder || `请输入${field.label}...`} />}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">自定义要求</label>
                                        <textarea 
                                            value={promptInput}
                                            onChange={e => setPromptInput(e.target.value)}
                                            placeholder="请输入具体的剧本创作要求，例如：写一场关于..."
                                            className="w-full h-32 p-3 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none shadow-sm"
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
                    <div className="flex gap-2">
                        {generationMode === 'workflow' ? (
                            <>
                                <button onClick={() => handleRunGeneration()} className="flex-1 py-2 bg-blue-50 text-blue-600 border border-blue-200 font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-1 shadow-sm text-xs"><Film className="w-3.5 h-3.5" /> 分集创作</button>
                                <button onClick={() => handleRunGeneration()} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1 text-xs"><Play className="w-3.5 h-3.5" /> 一键全集</button>
                            </>
                        ) : (
                            <button onClick={() => handleRunGeneration()} className="w-full py-2 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-1 text-xs"><Sparkles className="w-3.5 h-3.5" /> 立即生成</button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative font-sans" onClick={() => setContextMenu(prev => ({...prev, visible: false}))}>
            <LoadingOverlay isVisible={showLoadingOverlay} message={loadingMessage} onClose={() => setShowLoadingOverlay(false)} />
            
            <FollowUpModal 
                isOpen={followUpModal.open} 
                onClose={() => setFollowUpModal(prev => ({ ...prev, open: false }))} 
                targetText={followUpModal.targetText}
                context={followUpModal.context || (selectedWorkflow?.steps?.find(s => s.outputVariable === followUpModal.stepVar)?.prompt || '')} 
                initialMode={followUpModal.targetText ? 'selection' : 'full'}
                onApply={handleFollowUpApply}
            />

            <ContextMenu 
                {...contextMenu} 
                onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))} 
                onAction={handleContextMenuAction}
            />

            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            <PromptSelectionModal isOpen={isPromptSelectionModalOpen} onClose={() => setIsPromptSelectionModalOpen(false)} onSelect={handlePromptChange} />
            
            {/* ... Workflow Modal with Top Bar ... */}
            {isWorkflowModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWorkflowModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        
                        {/* 1. Modal Top Bar */}
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <WorkflowIcon className="w-5 h-5 text-blue-500" />
                                    选择剧本工作流
                                </h3>
                                <button onClick={() => setWorkflowModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                                {/* Categories */}
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full sm:w-auto">
                                    {WORKFLOW_CATEGORIES.map(cat => (
                                        <button 
                                            key={cat.id} 
                                            onClick={() => setWorkflowCategory(cat.id)} 
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${workflowCategory === cat.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-2 hidden sm:block"></div>
                                    <button 
                                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} 
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${showFavoritesOnly ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'}`}
                                    >
                                        <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : ''}`} /> 我的收藏
                                    </button>
                                </div>

                                {/* Search */}
                                <div className="relative w-full sm:w-64">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="w-3.5 h-3.5 text-gray-400" /></span>
                                    <input 
                                        type="text" 
                                        placeholder="搜索工作流..." 
                                        value={workflowSearch} 
                                        onChange={e => setWorkflowSearch(e.target.value)} 
                                        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-gray-800 text-xs rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                                    />
                                </div>
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
                                            className={`bg-white dark:bg-gray-900 rounded-2xl p-4 border transition-all cursor-pointer group flex flex-col h-[210px] ${
                                                selectedWorkflow?.id === wf.id 
                                                ? 'border-blue-500 ring-2 ring-blue-500/20' 
                                                : 'border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xl'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex gap-2 mb-1 opacity-0"></div>
                                                <div className="h-6"></div>
                                            </div>
                                            
                                            <div className="-mt-8">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors pr-2">{wf.title}</h3>
                                                    {selectedWorkflow?.id === wf.id && <div className="bg-blue-500 text-white rounded-full p-0.5 shrink-0 mt-1"><Check className="w-3 h-3" /></div>}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed flex-grow">
                                                    {wf.description || '暂无描述'}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 gap-2">
                                                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                                                    <div className="flex gap-1 flex-shrink-0">
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold border border-blue-100 whitespace-nowrap dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
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

            {/* Header */}
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-14 justify-between px-4">
                <div className="flex items-center gap-3">
                    <Film className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-base text-gray-900 dark:text-white truncate max-w-[150px]">{script.title}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar mx-4">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-900 p-1 rounded-lg">
                        {generationMode === 'workflow' ? (
                            // Use executedWorkflow to allow persistence of stepper even if input selectedWorkflow is cleared
                            (executedWorkflow || selectedWorkflow)?.steps ? (
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
                                                ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-blue-500/20' 
                                                : (stepResults[step.outputVariable] ? 'text-green-600' : 'text-gray-500 hover:text-gray-900')
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${stepResults[step.outputVariable] ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                                {idx + 1}
                                            </span>
                                            {step.name}
                                        </button>
                                        {idx < ((executedWorkflow || selectedWorkflow)?.steps?.length || 0) - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                                    </div>
                                ))
                            ) : (
                                <span className="text-xs text-gray-400 px-4">请先选择工作流</span>
                            )
                        ) : (
                            <span className="text-xs font-bold text-sky-600 px-4 flex items-center gap-1"><Sparkles className="w-3 h-3"/> 提示词创作模式</span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="px-4 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-[380px]' : 'w-0'}`}>
                    {renderSetupSidebar()}
                </aside>

                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-[380px]' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Content Area */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden">
                     {/* Toolbar */}
                     <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex justify-between items-center shrink-0 h-12 relative">
                         <div className="flex items-center gap-4 pl-4 w-1/3">
                             <h2 className="text-base font-bold text-sky-500 dark:text-sky-400 flex items-center gap-2 truncate">
                                 {activeScene?.title || '剧本正文'}
                             </h2>
                             {saveStatus === 'saving' && <span className="text-xs text-blue-500 animate-pulse whitespace-nowrap">保存中...</span>}
                             {saveStatus === 'saved' && <span className="text-xs text-green-500 whitespace-nowrap">已保存</span>}
                         </div>
                         
                         <div className="absolute left-1/2 -translate-x-1/2">
                             <WritingToolbar onAction={() => {}} alignment={alignment} />
                         </div>

                         <div className="flex items-center gap-2 w-1/3 justify-end">
                             <div className="relative">
                                 <button 
                                    onClick={() => setIsEpisodeSelectorOpen(!isEpisodeSelectorOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 rounded-lg text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                                 >
                                     {activeScene?.title || "选择集数"}
                                     <ChevronDown className="w-3 h-3" />
                                 </button>
                                 
                                 {isEpisodeSelectorOpen && (
                                     <>
                                         <div className="fixed inset-0 z-40" onClick={() => setIsEpisodeSelectorOpen(false)} />
                                         <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 p-1 max-h-60 overflow-y-auto custom-scrollbar animate-fade-in">
                                             <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700 mb-1 flex justify-between items-center">
                                                 <span>剧本集数</span>
                                                 <button onClick={() => { handleCreateEpisode(); setIsEpisodeSelectorOpen(false); }} className="text-blue-500 hover:underline">+ 新建</button>
                                             </div>
                                             {script.scenes.length > 0 ? (
                                                 episodeGroups.map((group, groupIdx) => (
                                                     <div key={groupIdx} className="mb-1">
                                                         <button className="w-full text-left px-3 py-1.5 text-xs font-bold text-sky-600 bg-sky-50/50 hover:bg-sky-100 dark:text-sky-400 dark:bg-sky-900/20 dark:hover:bg-sky-900/40 rounded-md mb-1 cursor-default">
                                                             第 {groupIdx * 5 + 1} - {Math.min((groupIdx + 1) * 5, script.scenes.length)} 集
                                                         </button>
                                                         <div className="pl-2 space-y-0.5 border-l-2 border-sky-100 dark:border-sky-900 ml-2">
                                                             {group.map((scene) => (
                                                                 <button 
                                                                     key={scene.id}
                                                                     onClick={() => { setActiveScene(scene); setIsEpisodeSelectorOpen(false); }}
                                                                     className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors truncate ${activeScene?.id === scene.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                                 >
                                                                     {scene.title}
                                                                 </button>
                                                             ))}
                                                         </div>
                                                     </div>
                                                 ))
                                             ) : ( <div className="p-3 text-center text-xs text-gray-400">暂无集数</div> )}
                                         </div>
                                     </>
                                 )}
                             </div>
                         </div>
                     </div>
                     
                     {/* Main Output Container */}
                     <div className="flex-1 overflow-y-auto p-0 custom-scrollbar relative scroll-smooth" ref={scrollContainerRef}>
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
                             <div className="w-full h-full flex flex-col bg-white dark:bg-gray-900">
                                 {/* Result Header */}
                                 <div className="flex items-center justify-between gap-3 px-6 py-3 sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shrink-0">
                                     <div className="flex items-center gap-3">
                                         <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold shrink-0">
                                             <Sparkles className="w-3.5 h-3.5" />
                                         </div>
                                         <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide truncate">生成结果</h3>
                                         {isGenerating && <ArrowPath className="w-4 h-4 text-sky-500 animate-spin" />}
                                     </div>
                                     
                                     {promptResultText && (
                                         <div className="flex items-center gap-2">
                                             <button 
                                                 type="button"
                                                 onClick={() => handleDownloadWord(promptResultText, `${script.title}_Generated`)}
                                                 className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20 rounded-lg transition-colors"
                                                 title="下载为 Word"
                                             >
                                                 <DocumentArrowDown className="w-3.5 h-3.5" /> 
                                                 <span className="hidden sm:inline">下载</span>
                                             </button>
                                             
                                             <button 
                                                 type="button"
                                                 onClick={() => {
                                                     navigator.clipboard.writeText(promptResultText);
                                                     alert('已复制到剪贴板');
                                                 }}
                                                 className="p-1.5 text-gray-400 hover:text-sky-500 rounded-lg transition-colors"
                                                 title="复制"
                                             >
                                                 <Copy className="w-4 h-4" />
                                             </button>
                                             <button 
                                                 type="button"
                                                 onClick={() => {
                                                     if(window.confirm('确定要清空结果吗？')) setPromptResultText('');
                                                 }}
                                                 className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                                 title="清空"
                                             >
                                                 <Trash className="w-4 h-4" />
                                             </button>
                                         </div>
                                     )}
                                 </div>

                                 {/* Result Body - Full height */}
                                 <div className="flex-1 p-8 relative group overflow-y-auto custom-scrollbar min-h-[500px]">
                                     {promptResultText ? (
                                         <div className="mb-8">
                                             <FormattedText text={promptResultText} />
                                         </div>
                                     ) : (
                                         <div className="flex flex-col items-center justify-center h-full text-gray-400 pt-20">
                                             <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                                             <p>请在左侧填写提示词并开始生成</p>
                                         </div>
                                     )}
                                     
                                     {!isGenerating && promptResultText && (
                                         <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-center gap-4 pb-8">
                                             <button 
                                                 onClick={() => handleInsertToScript(promptResultText)}
                                                 className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-full shadow-lg hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2 text-sm"
                                             >
                                                 <Plus className="w-4 h-4" /> 插入到正文
                                             </button>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         )}

                         {/* Mode: Workflow Generation */}
                         {/* Use executedWorkflow to persist output even if input selectedWorkflow is cleared */}
                         {generationMode === 'workflow' && (executedWorkflow || selectedWorkflow) && !isScriptLoading && (
                             <div className="space-y-0 pb-32 w-full mx-auto">
                                 {(executedWorkflow || selectedWorkflow)?.steps?.map((step, index) => {
                                     if (index > visibleStepIndex && !stepResults[step.outputVariable]) return null;

                                     const result = stepResults[step.outputVariable];
                                     const isGeneratingThis = currentStepIndex === index && isGenerating;
                                     const isCollapsed = collapsedSteps[step.id];
                                     
                                     return (
                                         <div 
                                            key={step.id} 
                                            ref={(el: HTMLDivElement | null) => { stepRefs.current[index] = el; }}
                                            className={`transition-opacity duration-500 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 ${!result && !isGeneratingThis ? 'opacity-50' : 'opacity-100'}`}
                                         >
                                             {/* 3. Hide Headers, keep container for scroll ref */}
                                             
                                             {!isCollapsed && (
                                                 <div className="p-8 relative group min-h-[100px] overflow-y-auto custom-scrollbar">
                                                     {result ? (
                                                         <div className="relative">
                                                             {/* Optional: Add hover controls since header is gone */}
                                                             <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white/90 dark:bg-black/80 p-1 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 z-10">
                                                                 <button 
                                                                    type="button"
                                                                    onClick={() => handleOpenDeepAsk(result, step.outputVariable)} 
                                                                    className="p-1.5 text-sky-500 hover:bg-sky-50 rounded"
                                                                    title="追问"
                                                                 ><ChatBubbleOvalLeftEllipsis className="w-4 h-4"/></button>
                                                                 <button 
                                                                    type="button"
                                                                    onClick={() => handleDownloadWord(result, `${script.title}_${step.name}`)}
                                                                    className="p-1.5 text-sky-500 hover:bg-sky-50 rounded"
                                                                    title="下载"
                                                                 ><DocumentArrowDown className="w-4 h-4"/></button>
                                                             </div>
                                                             
                                                             <EditableStepContent 
                                                                initialContent={result} 
                                                                onSave={(newContent) => handleStepContentChange(step.outputVariable, newContent)}
                                                                onContextMenu={(e, text) => {
                                                                    setContextMenu({ x: e.clientX, y: e.clientY, visible: true, text });
                                                                }}
                                                             />
                                                         </div>
                                                     ) : isGeneratingThis ? (
                                                         <div className="flex flex-col items-center justify-center py-8 text-blue-500 text-sm animate-pulse gap-2">
                                                             <Sparkles className="w-6 h-6" /> 
                                                             <span>正在生成内容...</span>
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
                         
                         {/* Fallback for Workflow mode if nothing selected AND no executed workflow */}
                         {generationMode === 'workflow' && !selectedWorkflow && !executedWorkflow && !isScriptLoading && (
                             <div className="flex flex-col items-center justify-center h-full text-gray-400 pt-20">
                                 <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
                                 <p>请在左侧选择一个工作流开始创作</p>
                             </div>
                         )}
                         
                         {isGenerating && generationMode === 'workflow' && (
                             <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse z-50">
                                 <ArrowPath className="w-4 h-4 animate-spin" />
                                 正在按步骤生成剧本...
                                 <button onClick={handleStop} className="ml-2 hover:text-red-200"><X className="w-4 h-4"/></button>
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
