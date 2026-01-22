
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Script, Scene, ScriptSettings, Workflow, Asset, PromptCategory } from '../../types';
import { Film, ArrowPath, Check, ChevronLeft, ChevronRight, AdjustmentsHorizontal, Sparkles, DocumentText, Database, Play, Pencil, X, Copy, Stop, ChevronDown, ChevronUp, Workflow as WorkflowIcon, InformationCircle, ChatBubbleOvalLeftEllipsis, DocumentPlus, UserCircle, Fire, Tag, Heart } from '../Icon';
import WritingToolbar from './WritingToolbar';
import { saveChapterToDB, updateProject, fetchChapters, fetchChapterContent, deleteChapterFromDB, updateChapterOrder, fetchMaterials, incrementWorkflowUsage, fetchWorkflows, getCurrentUserId } from '../../services/supabaseService';
import { createPortal } from 'react-dom';
import FollowUpModal from '../FollowUpModal';
import CustomSelect from '../CustomSelect';
import { generateTextStream } from '../../services/geminiService';
import AssetSelectionModal from '../AssetSelectionModal';
import LoadingOverlay from '../LoadingOverlay';
import { GENRE_TAGS } from '../../constants';

interface ScriptWritingPageProps {
    script: Script;
    onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

// --- Helper: Reading Mode Renderer ---
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
    const cleanText = text
        .replace(/#+\s/g, '') 
        .replace(/\*\*|\*/g, '') 
        .replace(/`{1,3}.*?`{1,3}/gs, '') 
        .replace(/<think>[\s\S]*?<\/think>/g, '') 
        .trim();

    return (
        <div className={`whitespace-pre-wrap font-sans leading-relaxed text-sm ${className}`}>
            {cleanText.split('\n').map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={index} className="h-2" />;
                
                const isSceneHeader = /^(EXT\.|INT\.|内景|外景|场景)/i.test(trimmed);
                const isCharacter = /^[A-Z\u4e00-\u9fa5]+(\s*\(.*?\))?：/.test(trimmed);
                
                if (isSceneHeader) {
                    return <div key={index} className="font-black text-gray-900 dark:text-white mt-4 mb-1 text-base border-l-4 border-blue-500 pl-2">{trimmed}</div>;
                }
                if (isCharacter) {
                    return <div key={index} className="font-bold text-gray-800 dark:text-gray-200 mt-1">{trimmed}</div>;
                }
                return <div key={index} className="text-gray-600 dark:text-gray-300 mb-0.5">{trimmed}</div>;
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

// Helper to look up genre label
const getGenreLabel = (id: string) => {
    const found = GENRE_TAGS.find(g => g.id === id);
    return found ? found.label : id;
};

const ScriptWritingPage: React.FC<ScriptWritingPageProps> = ({ script: initialScript, onBack }) => {
    // Core Data
    const [script, setScript] = useState<Script>(initialScript);
    const [activeScene, setActiveScene] = useState<Scene | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    
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
    
    // Workflow State
    const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
    const [workflowFormState, setWorkflowFormState] = useState<Record<string, string>>({});
    const [stepResults, setStepResults] = useState<Record<string, string>>({}); // Store result per step
    const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
    const [visibleStepIndex, setVisibleStepIndex] = useState<number>(-1); // Control how many steps are visible
    const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({}); // Control collapse state

    // Asset Selection
    const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isAssetModalOpen, setAssetModalOpen] = useState(false);
    const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false); // Changed to Modal state

    // UI State
    const [wordCount, setWordCount] = useState(0);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
    
    const [loadingMessage, setLoadingMessage] = useState('正在处理...');
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const resultRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const [activeFollowUp, setActiveFollowUp] = useState<{ target: string; context: string; initialMode: 'selection' | 'full' } | null>(null);

    // --- Persistence Helper ---
    const persistState = useCallback(() => {
        if (!script.id) return;
        const stateToSave = {
            workflowId: selectedWorkflow?.id,
            formState: workflowFormState,
            results: stepResults,
            visibleIndex: visibleStepIndex
        };
        localStorage.setItem(`qisimiaoxie_script_run_${script.id}`, JSON.stringify(stateToSave));
    }, [script.id, selectedWorkflow?.id, workflowFormState, stepResults, visibleStepIndex]);

    // Save state on changes
    useEffect(() => {
        persistState();
    }, [persistState]);

    // --- Initialization ---
    useEffect(() => {
        const loadInitialData = async () => {
            const uid = await getCurrentUserId();
            setCurrentUserId(uid);

            // Load Chapters
            const data = await fetchChapters(script.id);
            if (data) {
               const mapped: Scene[] = data.map((c: any) => ({
                   id: c.id,
                   title: c.title,
                   content: '', 
                   isContentLoaded: false
               }));
               setScript(prev => ({ ...prev, scenes: mapped }));
               
               let loadedData: any = script.scriptData;
               if (loadedData && loadedData.settings) {
                   setSettings(loadedData.settings);
               }
            }
            // Load Assets
            const userAssets = await fetchMaterials();
            setAssets(userAssets.map((item: any) => ({
                id: item.id,
                name: item.name || item.title,
                type: item.type === 'idea' ? 'inspiration' : item.type,
                content: item.content,
                tags: item.tags || []
            })));

            // Load Workflows with proper parsing
            const workflowsData = await fetchWorkflows({ category: 'all' });
            let mappedWorkflows: Workflow[] = [];
            if (workflowsData) {
                mappedWorkflows = workflowsData.map((wf: any) => {
                    let content: any = {};
                    try {
                        content = typeof wf.content === 'string' ? JSON.parse(wf.content) : wf.content;
                    } catch(e) {
                        console.error("Workflow content parse error", e);
                    }
                    
                    let authorName = '匿名用户';
                    if (wf.profiles?.username) authorName = wf.profiles.username;
                    else if (wf.user_id === uid) authorName = '我';

                    return {
                        id: wf.id,
                        title: wf.title,
                        description: wf.description,
                        usageCount: wf.usage_count || 0,
                        heat: wf.usage_count || 0,
                        author: authorName,
                        userId: wf.user_id,
                        category: wf.main_category,
                        subCategories: wf.sub_categories || [],
                        fields: content?.fields || [], // IMPORTANT: Parse fields for form generation
                        steps: content?.steps || [],   // IMPORTANT: Parse steps for execution
                        createdAt: wf.created_at
                    };
                });
                setAvailableWorkflows(mappedWorkflows);
            }

            // Restore State from LocalStorage
            const savedStateStr = localStorage.getItem(`qisimiaoxie_script_run_${script.id}`);
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    if (savedState.workflowId) {
                        const wf = mappedWorkflows.find(w => w.id === savedState.workflowId);
                        if (wf) {
                            setSelectedWorkflow(wf);
                            setWorkflowFormState(savedState.formState || {});
                            setStepResults(savedState.results || {});
                            setVisibleStepIndex(savedState.visibleIndex ?? -1);
                        }
                    }
                } catch (e) {
                    console.error("Failed to restore state", e);
                }
            }
        };
        loadInitialData();
    }, [script.id]);

    useEffect(() => {
        const loadContent = async () => {
            if (activeScene && !activeScene.isContentLoaded) {
                setIsContentLoading(true);
                const content = await fetchChapterContent(activeScene.id);
                setScript(prev => ({
                    ...prev,
                    scenes: prev.scenes.map(s => s.id === activeScene.id ? { ...s, content, isContentLoaded: true } : s)
                }));
                setActiveScene(prev => prev ? { ...prev, content, isContentLoaded: true } : null);
                
                setIsContentLoading(false);
            }
        };
        loadContent();
    }, [activeScene?.id]);

    // Reset form when workflow changes manually (not restoration)
    const handleWorkflowChange = (wf: Workflow) => {
        setSelectedWorkflow(wf);
        // Only reset if it's a different workflow to avoid overwriting restored state
        // But since we set it from null, we check fields
        if (Object.keys(workflowFormState).length === 0) {
             const initial: Record<string, string> = {};
             wf.fields?.forEach(f => { initial[f.variable] = ''; });
             setWorkflowFormState(initial);
        }
        // If we switched workflows manually (not restore), clear results
        // This logic is simplified: assume user clicked list item implies switch
    };

    // Save Data
    const persistScriptData = async (newSettings?: ScriptSettings) => {
        const updatedData = {
            settings: newSettings || settings,
            planning: {
                synopsis: '', 
                characterSettings: '',
                worldview: '',
                outline: '' 
            }
        };
        await updateProject(script.id, { 
            // @ts-ignore
            script_data: updatedData 
        });
        setScript(prev => ({ ...prev, scriptData: updatedData }));
    };

    // --- Generation Logic ---
    const handleRunWorkflow = async (mode: 'single' | 'full' = 'single') => {
        if (!selectedWorkflow || !selectedWorkflow.steps) return;
        if (isGenerating) { handleStop(); return; }

        // Start from first step or continue? For now, restart entire flow or next missing step
        // To be simple, we restart from current visible index or 0
        const startStepIndex = Object.keys(stepResults).length < selectedWorkflow.steps.length ? Object.keys(stepResults).length : 0;
        
        if (startStepIndex === 0) {
             setStepResults({});
             setVisibleStepIndex(-1);
        }

        setIsGenerating(true);
        setCurrentStepIndex(startStepIndex);
        // Ensure at least this step is visible
        setVisibleStepIndex(Math.max(visibleStepIndex, startStepIndex));

        const assetContext = Array.from(selectedAssetIds).map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => `【参考素材：${a!.name}】\n${a!.content}`).join('\n\n');
        const basicInfo = `【剧本基础信息】\n总集数：${settings.totalEpisodes}\n单集时长：${settings.durationPerEpisode}min\n语言：${settings.outputLanguage}\n\n`;
        
        let currentContext: Record<string, string> = { ...workflowFormState };
        // Pre-fill with existing results if continuing
        if (startStepIndex > 0) {
             selectedWorkflow.steps.forEach((s, idx) => {
                 if (idx < startStepIndex && stepResults[s.outputVariable]) {
                     currentContext[s.outputVariable] = stepResults[s.outputVariable];
                 }
             });
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            incrementWorkflowUsage(selectedWorkflow.id);

            for (let i = startStepIndex; i < selectedWorkflow.steps!.length; i++) {
                if (controller.signal.aborted) break;
                setCurrentStepIndex(i);
                setVisibleStepIndex(i); // Reveal current step
                
                // Auto scroll to current step
                setTimeout(() => {
                    if (stepRefs.current[i]) {
                        stepRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
                
                const step = selectedWorkflow.steps![i];
                let prompt = step.prompt;

                // Replace variables
                Object.keys(currentContext).forEach(key => {
                    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), currentContext[key] || '');
                });

                const finalPrompt = `${basicInfo}${assetContext ? `【关联素材】\n${assetContext}\n\n` : ''}${prompt}`;
                
                let stepOutput = '';
                const stream = generateTextStream(finalPrompt, { 
                    model: settings.model, 
                    temperature: temperature, 
                    topP: topP, 
                    maxOutputTokens: maxOutputTokens,
                    signal: controller.signal 
                });

                for await (const chunk of stream) {
                    stepOutput += chunk;
                    setStepResults(prev => ({ ...prev, [step.outputVariable]: stepOutput }));
                }

                // Store result for next steps
                currentContext[step.outputVariable] = stepOutput;
                
                // If mode is single step, pause here? The prompt asks for "step by step display", not "pause after each".
                // Assuming continuous run, just revealing sequentially.
            }

        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            setCurrentStepIndex(null);
        }
    };

    const handleCreateEpisode = async () => {
        const newOrder = script.scenes.length + 1;
        const epTitle = `第${newOrder}集`;
        const newId = await saveChapterToDB(script.id, `new-ep-${Date.now()}`, epTitle, '', newOrder);
        
        if (newId) {
            const newScene: Scene = { id: newId, title: epTitle, content: '', isContentLoaded: true };
            setScript(prev => ({ ...prev, scenes: [...prev.scenes, newScene] }));
            setActiveScene(newScene);
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        setIsGenerating(false);
        setCurrentStepIndex(null);
    };

    const scrollToStep = (index: number) => {
        if (stepRefs.current[index]) {
            stepRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleTriggerFollowUp = (stepContent: string, variable: string) => {
        const selection = window.getSelection();
        let text = '';
        if (selection && selection.toString().trim()) {
            text = selection.toString().trim();
        }
        
        setActiveFollowUp({
            target: text,
            context: stepContent,
            initialMode: text ? 'selection' : 'full'
        });
    };

    const handleDownloadStep = (content: string, title: string) => {
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${title}.txt`;
        document.body.appendChild(element); 
        element.click();
        document.body.removeChild(element);
    };

    const toggleCollapse = (stepId: string) => {
        setCollapsedSteps(prev => ({...prev, [stepId]: !prev[stepId]}));
    };

    // Helper for episode grouping
    const episodeGroups = useMemo(() => {
        const groups = [];
        for (let i = 0; i < script.scenes.length; i += 5) {
            groups.push(script.scenes.slice(i, i + 5));
        }
        return groups;
    }, [script.scenes]);

    const renderSetupSidebar = () => (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 font-sans w-96 relative">
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
                            <CustomSelect 
                                value={settings.model} 
                                onChange={(v) => setSettings(s => ({...s, model: v}))} 
                                options={MODEL_OPTIONS} 
                                className="z-50"
                            />
                        </div>
                        
                        {showModelConfig && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 space-y-3 animate-fade-in">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between">
                                        <span>随机度 (Temperature): {temperature}</span>
                                    </label>
                                    <input type="range" min="0" max="1.5" step="0.1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    <p className="text-[10px] text-gray-400">控制创造性。值越高越发散、有创意；值越低越严谨。</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between">
                                        <span>核采样 (Top P): {topP}</span>
                                    </label>
                                    <input type="range" min="0" max="1" step="0.05" value={topP} onChange={e => setTopP(parseFloat(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                    <p className="text-[10px] text-gray-400">控制词汇多样性。值较低时，倾向于选择常见词汇。</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex justify-between">
                                        <span>最大长度 (Tokens): {maxOutputTokens}</span>
                                    </label>
                                    <input type="range" min="1024" max="16384" step="1024" value={maxOutputTokens} onChange={e => setMaxOutputTokens(parseInt(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Basic Info */}
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <DocumentText className="w-4 h-4" />
                        2. 剧本基本信息
                    </h3>
                    <div className="grid grid-cols-2 gap-3 pl-1">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">总集数</label>
                            <input type="number" value={settings.totalEpisodes} onChange={e => setSettings(s => ({...s, totalEpisodes: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">单集时长(min)</label>
                            <input type="text" value={settings.durationPerEpisode} onChange={e => setSettings(s => ({...s, durationPerEpisode: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">场次限制</label>
                            <input type="number" value={settings.scenesPerEpisodeLimit} onChange={e => setSettings(s => ({...s, scenesPerEpisodeLimit: e.target.value}))} className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400">语言</label>
                            <div className="relative z-40">
                                <CustomSelect value={settings.outputLanguage} onChange={(v) => setSettings(s => ({...s, outputLanguage: v as 'zh' | 'en'}))} options={LANGUAGE_OPTIONS} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Workflow & Form */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <WorkflowIcon className="w-4 h-4" />
                        3. 工作流配置
                    </h3>
                    <div className="space-y-4 pl-1">
                        {/* Asset Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">关联素材</label>
                            <button onClick={() => setAssetModalOpen(true)} className={`w-full p-3 rounded-xl border border-dashed text-xs transition-all text-left flex justify-between items-center group ${selectedAssetIds.size > 0 ? 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}>
                                <span className="truncate font-bold">{selectedAssetIds.size > 0 ? `已关联 ${selectedAssetIds.size} 项素材` : '选择角色/剧情/世界观...'}</span>
                                <Database className={`w-4 h-4 group-hover:scale-110 transition-transform ${selectedAssetIds.size > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                            </button>
                        </div>

                        {/* Workflow Selection (Replaced Dropdown with Modal Trigger) */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">选择工作流</label>
                            <button 
                                onClick={() => setWorkflowModalOpen(true)}
                                className={`w-full p-3 rounded-xl border text-xs text-left flex justify-between items-center group shadow-sm transition-all ${selectedWorkflow ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'}`}
                            >
                                <span className="truncate font-bold">{selectedWorkflow ? selectedWorkflow.title : '选择生成流程...'}</span>
                                <ChevronDown className={`w-4 h-4 ${selectedWorkflow ? 'text-blue-500' : 'text-gray-400'}`} />
                            </button>
                        </div>
                        
                        {/* Dynamic Workflow Form - Properly Rendered */}
                        {selectedWorkflow && selectedWorkflow.fields && selectedWorkflow.fields.length > 0 && (
                            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4 animate-fade-in shadow-sm">
                                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
                                    <span className="text-xs font-black text-gray-700 dark:text-gray-200 flex items-center gap-1"><AdjustmentsHorizontal className="w-3 h-3"/> 参数填写</span>
                                    <button onClick={() => { 
                                        setSelectedWorkflow(null); 
                                        setWorkflowFormState({}); 
                                        setStepResults({}); 
                                        setVisibleStepIndex(-1);
                                    }} className="text-[10px] text-gray-400 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </div>
                                {selectedWorkflow.fields.map((field) => (
                                    <div key={field.id} className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[11px] font-bold text-gray-600 dark:text-gray-300 block">
                                                {field.label}
                                                {field.required !== false && <span className="text-red-500 ml-0.5">*</span>}
                                            </label>
                                            {field.maxLength && (
                                                <span className={`text-[9px] ${(workflowFormState[field.variable]?.length || 0) > field.maxLength ? 'text-red-500' : 'text-gray-400'}`}>
                                                    {workflowFormState[field.variable]?.length || 0}/{field.maxLength}
                                                </span>
                                            )}
                                        </div>
                                        {field.type === 'textarea' ? (
                                            <textarea 
                                                value={workflowFormState[field.variable] || ''}
                                                onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24"
                                                placeholder={field.description || `请输入${field.label}...`}
                                                maxLength={field.maxLength}
                                            />
                                        ) : (
                                            <input 
                                                type="text"
                                                value={workflowFormState[field.variable] || ''}
                                                onChange={(e) => setWorkflowFormState(p => ({...p, [field.variable]: e.target.value}))}
                                                className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder={field.description || `请输入${field.label}...`}
                                                maxLength={field.maxLength}
                                            />
                                        )}
                                        {field.description && <p className="text-[10px] text-gray-400 leading-tight">{field.description}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Empty state prompt */}
                        {selectedWorkflow && (!selectedWorkflow.fields || selectedWorkflow.fields.length === 0) && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400 italic">
                                此工作流无需额外参数输入，请直接点击下方按钮开始生成。
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Action Area - More Compact */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {isGenerating ? (
                    <button 
                        onClick={handleStop} 
                        className="w-full py-2 bg-red-500 text-white font-bold rounded-xl shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 active:scale-95 text-xs"
                    >
                        <Stop className="w-3.5 h-3.5" /> 停止生成
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => handleRunWorkflow('single')} 
                            className="flex-1 py-2 bg-blue-50 text-blue-600 border border-blue-200 font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-1 shadow-sm text-xs"
                        >
                            <Film className="w-3.5 h-3.5" /> 分集创作
                        </button>
                        <button 
                            onClick={() => handleRunWorkflow('full')} 
                            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1 text-xs"
                        >
                            <Play className="w-3.5 h-3.5" /> 一键全集
                        </button>
                        <button 
                            onClick={() => handleRunWorkflow('single')} 
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1 text-xs whitespace-nowrap"
                            title="重新生成"
                        >
                            <ArrowPath className="w-3.5 h-3.5" /> 重新生成
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden relative font-sans">
            <LoadingOverlay isVisible={showLoadingOverlay} message={loadingMessage} onClose={() => setShowLoadingOverlay(false)} />
            
            <FollowUpModal 
                isOpen={!!activeFollowUp} 
                onClose={() => setActiveFollowUp(null)} 
                targetText={activeFollowUp?.target || ''}
                context={editorRef.current?.innerText || ''}
                initialMode={'selection'}
                onApply={(text, type) => {
                    setActiveFollowUp(null);
                }}
            />

            {/* Selection Modals */}
            <AssetSelectionModal isOpen={isAssetModalOpen} onClose={() => setAssetModalOpen(false)} assets={assets} selectedAssetIds={selectedAssetIds} onToggleAsset={(id) => setSelectedAssetIds(prev => { const next = new Set(prev); if(next.has(id)) next.delete(id); else next.add(id); return next; })} />
            
            {/* WORKFLOW SELECTION MODAL */}
            {isWorkflowModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setWorkflowModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <WorkflowIcon className="w-5 h-5 text-blue-500" />
                                选择剧本工作流
                            </h3>
                            <button onClick={() => setWorkflowModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50 dark:bg-black/20">
                            {availableWorkflows.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {availableWorkflows.map(wf => (
                                        <div 
                                            key={wf.id} 
                                            onClick={() => { handleWorkflowChange(wf); setWorkflowModalOpen(false); }}
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

            {/* Header with Steps */}
            <header className="flex-shrink-0 bg-white dark:bg-black flex border-b border-gray-200 dark:border-gray-800 z-20 shadow-sm h-14 justify-between px-4">
                <div className="flex items-center gap-3">
                    <Film className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-base text-gray-900 dark:text-white truncate max-w-[150px]">{script.title}</span>
                </div>
                
                <div className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar mx-4">
                    <div className="flex items-center bg-gray-50 dark:bg-gray-900 p-1 rounded-lg">
                        {selectedWorkflow?.steps ? (
                            selectedWorkflow.steps.map((step, idx) => (
                                <div key={step.id} className="flex items-center">
                                    <button 
                                        onClick={() => scrollToStep(idx)}
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
                                    {idx < selectedWorkflow.steps!.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 mx-1" />}
                                </div>
                            ))
                        ) : (
                            <span className="text-xs text-gray-400 px-4">请先选择工作流</span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="px-4 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">返回</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <aside className={`flex-shrink-0 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 transition-all duration-300 overflow-hidden ${isLeftSidebarOpen ? 'w-96' : 'w-0'}`}>
                    {renderSetupSidebar()}
                </aside>

                {/* Sidebar Toggle */}
                <button 
                    onClick={() => setLeftSidebarOpen(!isLeftSidebarOpen)}
                    className={`absolute z-30 top-1/2 -translate-y-1/2 w-4 h-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-md flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all shadow-sm ${isLeftSidebarOpen ? 'left-96' : 'left-0'}`}
                >
                    {isLeftSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {/* Main Content Area */}
                <main className="flex-1 bg-gray-50 dark:bg-gray-950 flex flex-col relative overflow-hidden">
                     {/* Content Header & Toolbar */}
                     <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-2 flex justify-between items-center shrink-0 h-12 relative">
                         <div className="flex items-center gap-4 pl-4 w-1/3">
                             <h2 className="text-base font-bold text-sky-500 dark:text-sky-400 flex items-center gap-2 truncate">
                                 {activeScene?.title || '剧本正文'}
                             </h2>
                             {saveStatus === 'saving' && <span className="text-xs text-blue-500 animate-pulse whitespace-nowrap">保存中...</span>}
                             {saveStatus === 'saved' && <span className="text-xs text-green-500 whitespace-nowrap">已保存</span>}
                         </div>
                         
                         {/* Centered Toolbar */}
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
                                             ) : (
                                                 <div className="p-3 text-center text-xs text-gray-400">暂无集数</div>
                                             )}
                                         </div>
                                     </>
                                 )}
                             </div>
                         </div>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative scroll-smooth" ref={scrollContainerRef}>
                         {/* Default State */}
                         {!selectedWorkflow && (
                             <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                 <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
                                 <p>请在左侧选择一个工作流开始创作</p>
                             </div>
                         )}

                         {/* Workflow Steps Output - Sequential */}
                         {selectedWorkflow && (
                             <div className="space-y-6 pb-32 max-w-4xl mx-auto">
                                 {selectedWorkflow.steps?.map((step, index) => {
                                     // Logic: Show step if it has content (completed) OR if it is the current running step
                                     // Also we need to show steps that have been "reached" if we are implementing step-by-step persistence
                                     if (index > visibleStepIndex && !stepResults[step.outputVariable]) return null;

                                     const result = stepResults[step.outputVariable];
                                     const isGeneratingThis = currentStepIndex === index && isGenerating;
                                     const isCollapsed = collapsedSteps[step.id];
                                     
                                     return (
                                         <div 
                                            key={step.id} 
                                            ref={(el: HTMLDivElement | null) => { stepRefs.current[index] = el; }}
                                            className={`transition-opacity duration-500 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 ${!result && !isGeneratingThis ? 'opacity-50' : 'opacity-100'}`}
                                         >
                                             {/* Sticky Header */}
                                             <div className="flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
                                                 <div className="flex items-center gap-3">
                                                     <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${result ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                         {result ? <Check className="w-3 h-3"/> : index + 1}
                                                     </div>
                                                     <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide truncate">{step.name}</h3>
                                                     {isGeneratingThis && <ArrowPath className="w-4 h-4 text-blue-500 animate-spin" />}
                                                 </div>
                                                 
                                                 <div className="flex items-center gap-2">
                                                     {result && (
                                                         <>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleTriggerFollowUp(result, step.outputVariable)} 
                                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-900/40 rounded-lg transition-colors"
                                                                title="智能追问"
                                                            >
                                                                <ChatBubbleOvalLeftEllipsis className="w-3.5 h-3.5" /> 
                                                                <span className="hidden sm:inline">追问</span>
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleDownloadStep(result, `${script.title}_${step.name}`)}
                                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                                                title="下载为TXT"
                                                            >
                                                                <ArrowPath className="w-3.5 h-3.5 rotate-180" /> 
                                                                <span className="hidden sm:inline">下载</span>
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => { /* ... save logic ... */ }}
                                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                                title="存入正文"
                                                            >
                                                                <DocumentPlus className="w-3.5 h-3.5" /> 
                                                                <span className="hidden sm:inline">存入</span>
                                                            </button>
                                                         </>
                                                     )}
                                                     <button 
                                                        onClick={() => toggleCollapse(step.id)}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                                                     >
                                                         {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                                     </button>
                                                 </div>
                                             </div>

                                             {!isCollapsed && (
                                                 <div 
                                                     className="p-4 relative group min-h-[100px]"
                                                 >
                                                     <div 
                                                        ref={(el: HTMLDivElement | null) => { resultRefs.current[step.outputVariable] = el; }}
                                                        onMouseUp={() => handleTriggerFollowUp(result, step.outputVariable)}
                                                     >
                                                         {result ? (
                                                             <FormattedText text={result} />
                                                         ) : isGeneratingThis ? (
                                                             <div className="flex flex-col items-center justify-center py-8 text-blue-500 text-sm animate-pulse gap-2">
                                                                 <Sparkles className="w-6 h-6" /> 
                                                                 <span>正在生成内容...</span>
                                                             </div>
                                                         ) : (
                                                             <div className="text-gray-400 text-xs italic p-4 text-center">等待生成...</div>
                                                         )}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                         
                         {isGenerating && (
                             <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse z-50">
                                 <ArrowPath className="w-4 h-4 animate-spin" />
                                 正在按步骤生成剧本...
                                 <button onClick={handleStop} className="ml-2 hover:text-red-200"><X className="w-4 h-4"/></button>
                             </div>
                         )}
                     </div>
                </main>
            </div>
        </div>
    );
};

export default ScriptWritingPage;
